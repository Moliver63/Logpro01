import type {
  RegraTributaria,
  ItemTributarioCalculado,
  ResultadoTributario,
  Produto,
} from "../../types/domain.js";

export interface TaxEngineQuery {
  estadoOrigem: string;
  estadoDestino: string;
  produto: Produto;
  tipoOperacao: string;
  valorPorSaca: number; // preço de compra por saca — base mais comum
  quantidadeSacas: number;
  dataBase?: string; // ISO date; usa data da operacao quando disponivel
  dataOperacao?: string; // alias aceito por compatibilidade semantica
}

/**
 * Arredonda para 2 casas. Aplicado a cada valor tributário individual, não
 * só ao total — sem isso, imprecisão de ponto flutuante vaza direto pra
 * memória de cálculo exibida ao usuário (ex: SENAR aparecendo como
 * 7000.000000000001 em vez de 7000,00).
 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Tributos e fundos que o motor sabe monitorar. Usado só para detectar
 * lacunas de cadastro (item 4: "se não existir regra, retornar pendência")
 * — NÃO significa que todos incidem em toda operação; apenas que, se o
 * cadastro para este cenário estiver zerado, o usuário precisa ser avisado
 * em vez de receber um total tributário silenciosamente incompleto.
 */
export const TRIBUTOS_MONITORADOS = [
  "ICMS",
  "PIS",
  "COFINS",
  "FETHAB",
  "SENAR",
  "FUNDES",
  "FUNDED",
  "FUNRURAL",
] as const;

/**
 * tax_engine
 *
 * Regra de ouro (item 4 da especificação): este módulo NUNCA infere ou
 * "chuta" um tributo para um cenário sem regra cadastrada. Se não existir
 * regra ativa e vigente para (origem, destino, produto, tipoOperacao),
 * o tributo entra na lista de `pendencias` e NÃO compõe o total.
 *
 * As regras são injetadas (não hardcoded aqui) para permitir troca por um
 * repositório real (Postgres via Drizzle) sem tocar na lógica de cálculo.
 */
export class TaxEngine {
  constructor(private readonly regras: RegraTributaria[]) {}

  calcular(query: TaxEngineQuery): ResultadoTributario {
    const dataBase = dataBaseDaQuery(query);
    const candidatas = this.regras.filter((r) => this.combina(r, query, dataBase));

    // Agrupa por tributo: se houver mais de uma regra vigente para o mesmo
    // tributo no mesmo cenário, isso é uma inconsistência de cadastro — não
    // decidimos sozinhos qual vale, sinalizamos como pendência.
    const porTributo = new Map<string, RegraTributaria[]>();
    for (const r of candidatas) {
      const lista = porTributo.get(r.tributo) ?? [];
      lista.push(r);
      porTributo.set(r.tributo, lista);
    }

    const itens: ItemTributarioCalculado[] = [];
    const pendencias: string[] = [];

    for (const [tributo, regras] of porTributo) {
      if (regras.length > 1) {
        pendencias.push(
          `Múltiplas regras vigentes e ativas para ${tributo} em ${query.estadoOrigem}→${query.estadoDestino}/${query.produto}. ` +
            `Cadastro ambíguo — regra tributária não pôde ser aplicada automaticamente, requer validação manual.`
        );
        continue;
      }
      itens.push(this.aplicar(regras[0], query));
    }

    const totalTributos = round2(itens.reduce((acc, i) => acc + i.valorComBeneficio, 0));

    // Se NENHUMA regra bateu para este cenário, não é "custo zero" — é
    // cadastro ausente. Sinaliza explicitamente em vez de deixar o total
    // parecer completo.
    if (candidatas.length === 0) {
      pendencias.push(
        `Regra tributária não cadastrada ou pendente de validação: nenhum tributo cadastrado para ` +
          `${query.produto} ${query.estadoOrigem}→${query.estadoDestino} (${query.tipoOperacao}). ` +
          `O total tributário abaixo é R$ 0,00 por ausência de cadastro, não por isenção real.`
      );
    } else {
      // Mesmo com alguma cobertura, avisa quais dos tributos monitorados
      // seguem sem regra para este cenário específico — pode ser normal
      // (nem todo tributo incide em toda operação) mas precisa ser visível.
      const semCobertura = this.tributosSemCobertura(query, [...TRIBUTOS_MONITORADOS]).filter(
        (t) => !itens.some((i) => i.tributo === t)
      );
      for (const t of semCobertura) {
        pendencias.push(
          `Regra tributária não cadastrada ou pendente de validação: ${t} para ` +
            `${query.produto} ${query.estadoOrigem}→${query.estadoDestino}.`
        );
      }
    }

    return { itens, totalTributos, pendencias };
  }

  /** Lista tributos conhecidos pelo motor sem cobertura para este cenário — usado pela UI para avisar o usuário antes mesmo de calcular. */
  tributosSemCobertura(query: TaxEngineQuery, tributosEsperados: string[]): string[] {
    const dataBase = dataBaseDaQuery(query);
    const cobertos = new Set(
      this.regras.filter((r) => this.combina(r, query, dataBase)).map((r) => r.tributo)
    );
    return tributosEsperados.filter((t) => !cobertos.has(t as never));
  }

  private combina(regra: RegraTributaria, q: TaxEngineQuery, hoje: Date): boolean {
    if (!regra.ativo) return false;
    if (regra.estadoOrigem !== q.estadoOrigem) return false;
    if (regra.estadoDestino !== "*" && regra.estadoDestino !== q.estadoDestino) return false;
    if (regra.produto !== "*" && regra.produto !== q.produto) return false;
    if (regra.tipoOperacao !== "*" && regra.tipoOperacao !== q.tipoOperacao) return false;

    const inicio = new Date(regra.vigenciaInicio);
    if (hoje < inicio) return false;
    if (regra.vigenciaFim && hoje > new Date(regra.vigenciaFim)) return false;

    return true;
  }

  private aplicar(regra: RegraTributaria, q: TaxEngineQuery): ItemTributarioCalculado {
    const base =
      regra.baseDeCalculo === "VALOR_POR_SACA"
        ? q.valorPorSaca * q.quantidadeSacas
        : regra.baseDeCalculo === "VALOR_OPERACAO"
        ? q.valorPorSaca * q.quantidadeSacas
        : q.valorPorSaca * q.quantidadeSacas; // CUSTOM cai no mesmo default por ora

    let valorBruto: number;
    if (regra.valorFixoPorSaca != null) {
      valorBruto = regra.valorFixoPorSaca * q.quantidadeSacas;
    } else if (regra.aliquotaPercentual != null) {
      valorBruto = base * (regra.aliquotaPercentual / 100);
    } else {
      valorBruto = 0;
    }

    let valorComBeneficio = valorBruto;
    let beneficioAplicado: string | undefined;
    if (regra.beneficioFiscal?.percentualReducao) {
      valorComBeneficio = valorBruto * (1 - regra.beneficioFiscal.percentualReducao);
      beneficioAplicado = regra.beneficioFiscal.nome;
    } else if (regra.beneficioFiscal) {
      beneficioAplicado = regra.beneficioFiscal.nome;
    }

    return {
      regraId: regra.id,
      nome: regra.nome,
      tributo: regra.tributo,
      base: round2(base),
      aliquotaPercentual: regra.aliquotaPercentual,
      valorBruto: round2(valorBruto),
      beneficioAplicado,
      valorComBeneficio: round2(valorComBeneficio),
      versaoRegra: regra.versao,
      fonte: regra.fonte,
    };
  }
}

function dataBaseDaQuery(query: TaxEngineQuery): Date {
  const valor = query.dataBase ?? query.dataOperacao;
  return valor ? new Date(`${valor}T00:00:00.000Z`) : new Date();
}
