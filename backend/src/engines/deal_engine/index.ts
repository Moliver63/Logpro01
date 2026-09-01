import type {
  OperacaoInput,
  ResultadoOperacao,
  LinhaCusto,
  Cenario,
  ResultadoCenario,
  ValorRastreado,
  ResultadoPisoMinimo,
} from "../../types/domain.js";
import { TaxEngine } from "../tax_engine/index.js";
import { FreightEngine } from "../freight_engine/index.js";
import { PisoMinimoEngine } from "../freight_engine/piso_minimo/index.js";

const v = (valor: number, origem: ValorRastreado["origem"], observacao?: string): ValorRastreado => ({
  valor: round2(valor),
  origem,
  observacao,
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Margem mínima operacional exigida pelas planilhas de referência
 * ("Precificação Agrícola" e "PRECIFICAÇÃO OFICIAL", regra de validação:
 * margem < 4% → operação não viável, "não fecha a conta"). Não é pendência
 * de dado nem coeficiente fiscal — é critério comercial do negócio.
 */
export const MARGEM_MINIMA_OPERACIONAL_PERCENTUAL = 4;

export class DealEngine {
  constructor(
    private readonly taxEngine: TaxEngine,
    private readonly freightEngine: FreightEngine = new FreightEngine(),
    private readonly pisoMinimoEngine: PisoMinimoEngine = new PisoMinimoEngine([])
  ) {}

  async calcular(input: OperacaoInput): Promise<ResultadoOperacao> {
    const { mercadoria, compra, venda, logistica, comissao, despesasAdicionais } = input;
    const sacas = mercadoria.quantidadeSacas;
    const toneladas = (sacas * mercadoria.pesoPorSacaKg) / 1000;

    // ---- Receita ----
    const receitaTotal = venda.precoPorSaca * sacas;

    // ---- Custo da mercadoria ----
    const custoMercadoria = compra.precoPorSaca * sacas;

    // ---- Frete (freight_engine) ----
    const cotacaoFrete = await this.freightEngine.getQuote({ ...logistica, toneladas });
    const custoLogistico =
      cotacaoFrete.freteTotal + (logistica.pedagios ?? 0) + (logistica.outrosCustosLogisticos ?? 0);

    // ---- Tributos (tax_engine) ----
    const tributos = this.taxEngine.calcular({
      estadoOrigem: compra.estadoOrigem,
      estadoDestino: venda.estadoDestino,
      produto: mercadoria.produto,
      tipoOperacao: input.tipoOperacao ?? "SOBRE_RODAS",
      valorPorSaca: compra.precoPorSaca,
      quantidadeSacas: sacas,
      dataBase: input.dataOperacao,
    });
    const custoTributario = tributos.totalTributos;

    // ---- Comissões e outros custos ----
    const linhasCusto: LinhaCusto[] = [];

    if (comissao?.comissaoVendaPorSaca) {
      linhasCusto.push(linha("Comissão de venda", comissao.comissaoVendaPorSaca, sacas));
    }
    if (comissao?.comissaoOriginacaoPorSaca) {
      linhasCusto.push(linha("Comissão de originação", comissao.comissaoOriginacaoPorSaca, sacas));
    }
    if (comissao?.classificadorPorSaca) {
      linhasCusto.push(linha("Classificador", comissao.classificadorPorSaca, sacas));
    }
    for (const d of despesasAdicionais ?? []) {
      const valorTotal = d.valorTotal ?? (d.valorPorSaca ?? 0) * sacas;
      linhasCusto.push({
        descricao: d.descricao,
        valorPorSaca: d.valorPorSaca ?? valorTotal / sacas,
        valorTotal: round2(valorTotal),
        origem: "informado_usuario",
      });
    }

    const outrosCustos = linhasCusto.reduce((acc, l) => acc + l.valorTotal, 0);

    // ---- Totais ----
    const custoTotal = custoMercadoria + custoLogistico + custoTributario + outrosCustos;
    const resultado = receitaTotal - custoTotal;
    const margemPercentual = receitaTotal !== 0 ? (resultado / receitaTotal) * 100 : 0;
    const resultadoPorSaca = sacas !== 0 ? resultado / sacas : 0;
    const resultadoPorTonelada = toneladas !== 0 ? resultado / toneladas : 0;

    // Ponto de equilíbrio: preço de venda por saca que zera o resultado,
    // mantendo custo fixo o restante da estrutura.
    const custoTotalSemReceita = custoMercadoria + custoLogistico + custoTributario + outrosCustos;
    const precoMinimoVendaPorSaca = sacas !== 0 ? custoTotalSemReceita / sacas : 0;

    // ---- Piso mínimo ANTT (Lei 13.703/2018) — só roda se número de eixos foi informado ----
    // Distância é obrigatória para o piso valer: calculado sem ela, o piso
    // sairia só com o custo fixo de carga/descarga — um número
    // enganosamente baixo, que aprovaria fretes abaixo do piso real. Sem
    // distância (nem digitada, nem calculada via OSRM no calculoService),
    // o piso vira pendência explícita em vez de parecer validado.
    const pisoMinimoAntt: ResultadoPisoMinimo = !logistica.numeroEixos
      ? { aplicavel: false, pendencia: "Número de eixos não informado — piso mínimo ANTT não verificado." }
      : !logistica.distanciaKm || logistica.distanciaKm <= 0
        ? {
            aplicavel: false,
            pendencia:
              "Distância da rota não informada nem calculada — piso mínimo ANTT não verificado.",
          }
        : this.pisoMinimoEngine.calcular({
            tipoCarga: "GRANEL_SOLIDO", // grãos a granel — soja/milho/trigo caem todos aqui
            numeroEixos: logistica.numeroEixos,
            distanciaKm: logistica.distanciaKm,
            freteInformadoTotal: cotacaoFrete.freteTotal,
            origemDistancia: logistica.origemDistancia ?? "informado_usuario",
          });

    const pendenciasOperacionais = [
      ...tributos.pendencias,
      ...pendenciasFrete(logistica, cotacaoFrete),
      ...pendenciasPiso(pisoMinimoAntt),
      ...pendenciasMargem(margemPercentual),
    ];
    const calculoCompleto = pendenciasOperacionais.length === 0;

    // Viabilidade e completude são coisas diferentes, e juntá-las tornava o
    // produto incapaz de responder a própria pergunta que ele existe para
    // responder: enquanto houver qualquer tributo sem cadastro ou o piso
    // ANTT sem coeficiente vigente, `calculoCompleto` é false — e isso é
    // permanente até alguém cadastrar as regras. Com a regra antiga
    // (`resultado > 0 && calculoCompleto`), NENHUMA operação jamais era
    // marcada como viável, nem a operação de referência com lucro real.
    //
    // Agora `viavel` responde à pergunta financeira ("o resultado é
    // positivo?") e `calculoCompleto` continua dizendo, separadamente, se
    // dá para confiar plenamente no número. A interface mostra os dois.
    //
    // A exceção é o impedimento de fato: frete abaixo do piso mínimo ANTT
    // não é "informação faltando", é uma operação que não pode ser
    // executada como está. Isso continua bloqueando a viabilidade.
    //
    // O segundo impedimento vem das planilhas de referência: margem abaixo
    // do mínimo operacional de 4% é operação que "não fecha a conta" — um
    // lucro de 2% sobre milhões não sobrevive a um mês de custo financeiro
    // ou a uma quebra de classificação. Lucro positivo com margem de 2%
    // não é viável, é armadilha.
    const impedimentoReal =
      (pisoMinimoAntt.aplicavel === true && pisoMinimoAntt.freteInformadoAbaixoDoPiso === true) ||
      margemPercentual < MARGEM_MINIMA_OPERACIONAL_PERCENTUAL;
    const viavel = resultado > 0 && !impedimentoReal;

    return {
      receitaTotal: v(receitaTotal, "calculado_sistema"),
      custoMercadoria: v(custoMercadoria, "calculado_sistema"),
      custoLogistico: v(custoLogistico, cotacaoFrete.origemDado),
      custoTributario: v(custoTributario, "calculado_sistema"),
      outrosCustos: v(outrosCustos, "calculado_sistema"),
      custoTotal: v(custoTotal, "calculado_sistema"),
      resultado: v(resultado, "calculado_sistema"),
      margemPercentual: round2(margemPercentual),
      resultadoPorSaca: round2(resultadoPorSaca),
      resultadoPorTonelada: round2(resultadoPorTonelada),
      precoMinimoVendaPorSaca: round2(precoMinimoVendaPorSaca),
      viavel,
      calculoCompleto,
      linhasCusto,
      tributos,
      frete: cotacaoFrete,
      pisoMinimoAntt,
      pendenciasTributarias: tributos.pendencias,
      pendenciasOperacionais,
    };
  }

  /** Simulador de cenários (item 7): recalcula o resultado para combinações de preço/frete. */
  async simularCenarios(input: OperacaoInput, cenarios: Cenario[]): Promise<ResultadoCenario[]> {
    const resultados: ResultadoCenario[] = [];
    for (const c of cenarios) {
      const variante: OperacaoInput = {
        ...input,
        compra: { ...input.compra, precoPorSaca: c.precoCompraPorSaca },
        venda: { ...input.venda, precoPorSaca: c.precoVendaPorSaca },
        logistica: { ...input.logistica, fretePorTonelada: c.fretePorTonelada, freteTotalInformado: undefined },
      };
      const r = await this.calcular(variante);
      resultados.push({
        ...c,
        margemPercentual: r.margemPercentual,
        resultado: r.resultado.valor,
      });
    }
    return resultados;
  }
}

function pendenciasFrete(
  logistica: OperacaoInput["logistica"],
  cotacaoFrete: ResultadoOperacao["frete"]
): string[] {
  const pendencias: string[] = [];
  if (logistica.fretePorTonelada == null && logistica.freteTotalInformado == null) {
    pendencias.push("Frete real não informado.");
  }
  if ((logistica.fretePorTonelada ?? cotacaoFrete.fretePorTonelada) <= 0 || cotacaoFrete.freteTotal <= 0) {
    pendencias.push("Frete zerado não é aceito para marcar viabilidade.");
  }
  if (cotacaoFrete.origemDado === "estimado") {
    pendencias.push("Frete real ausente. O valor logístico não pode ser tratado como cotação válida.");
  }
  return [...new Set(pendencias)];
}

function pendenciasPiso(piso: ResultadoPisoMinimo): string[] {
  if (piso.pendencia) return [piso.pendencia];
  if (piso.aplicavel && piso.freteInformadoAbaixoDoPiso) {
    return ["Frete informado abaixo do piso mínimo ANTT."];
  }
  if (!piso.aplicavel) {
    return ["Piso mínimo ANTT não validado."];
  }
  return [];
}

function pendenciasMargem(margemPercentual: number): string[] {
  if (margemPercentual >= MARGEM_MINIMA_OPERACIONAL_PERCENTUAL) return [];
  return [
    `Margem de ${round2(margemPercentual)}% abaixo do mínimo operacional de ${MARGEM_MINIMA_OPERACIONAL_PERCENTUAL}% exigido nas planilhas de referência.`,
  ];
}

function linha(descricao: string, valorPorSaca: number, sacas: number): LinhaCusto {
  return {
    descricao,
    valorPorSaca,
    valorTotal: round2(valorPorSaca * sacas),
    origem: "informado_usuario",
  };
}
