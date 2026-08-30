import type {
  OperacaoInput,
  ResultadoOperacao,
  LinhaCusto,
  Cenario,
  ResultadoCenario,
  ValorRastreado,
} from "../../types/domain.js";
import { TaxEngine } from "../tax_engine/index.js";
import { FreightEngine } from "../freight_engine/index.js";

const v = (valor: number, origem: ValorRastreado["origem"], observacao?: string): ValorRastreado => ({
  valor: round2(valor),
  origem,
  observacao,
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export class DealEngine {
  constructor(
    private readonly taxEngine: TaxEngine,
    private readonly freightEngine: FreightEngine = new FreightEngine()
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
      viavel: resultado > 0,
      linhasCusto,
      tributos,
      frete: cotacaoFrete,
      pendenciasTributarias: tributos.pendencias,
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

function linha(descricao: string, valorPorSaca: number, sacas: number): LinhaCusto {
  return {
    descricao,
    valorPorSaca,
    valorTotal: round2(valorPorSaca * sacas),
    origem: "informado_usuario",
  };
}
