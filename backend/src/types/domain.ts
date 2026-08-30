/**
 * Tipos de domínio compartilhados entre tax_engine, freight_engine e deal_engine.
 * Mantidos separados da camada de API e do banco — este arquivo não deve
 * importar nada de express, drizzle, etc.
 */

export type Produto = "SOJA" | "MILHO" | "TRIGO" | "OUTRO";

export type OrigemDado = "informado_usuario" | "calculado_sistema" | "api_externa" | "estimado";

/** Toda cifra que chega ao dashboard carrega a proveniência do dado. */
export interface ValorRastreado {
  valor: number;
  origem: OrigemDado;
  observacao?: string;
}

export interface DadosMercadoria {
  produto: Produto;
  quantidadeSacas: number;
  pesoPorSacaKg: number; // padrão 60kg para soja/milho, mas configurável
  classificacao?: string;
}

export interface DadosCompra {
  precoPorSaca: number;
  municipioOrigem: string;
  estadoOrigem: string; // UF
  fornecedor?: string;
  regimeTributario?: string;
  condicaoPagamento?: string;
  dataPrevistaPagamento?: string; // ISO date
}

export interface DadosVenda {
  precoPorSaca: number;
  municipioDestino: string;
  estadoDestino: string; // UF
  comprador?: string;
  condicaoPagamento?: string;
  dataPrevistaRecebimento?: string; // ISO date
}

export interface DadosLogistica {
  distanciaKm?: number;
  fretePorTonelada?: number;
  freteTotalInformado?: number;
  tipoVeiculo?: string;
  capacidadeCargaTon?: number;
  pedagios?: number;
  outrosCustosLogisticos?: number;
  numeroEixos?: number; // usado para checar o piso mínimo ANTT (Lei 13.703/2018)
}

export interface DespesaAdicional {
  descricao: string;
  valorPorSaca?: number;
  valorTotal?: number;
}

export interface DadosComissao {
  comissaoVendaPorSaca?: number;
  comissaoOriginacaoPorSaca?: number;
  classificadorPorSaca?: number;
}

export interface OperacaoInput {
  mercadoria: DadosMercadoria;
  compra: DadosCompra;
  venda: DadosVenda;
  logistica: DadosLogistica;
  comissao?: DadosComissao;
  despesasAdicionais?: DespesaAdicional[];
  tipoOperacao?: string; // usado para casar regras tributárias (ex: "SOBRE_RODAS")
}

/* ---------------- tax_engine ---------------- */

export type TipoTributoOuFundo =
  | "ICMS"
  | "PIS"
  | "COFINS"
  | "FETHAB"
  | "FUNDES"
  | "FUNDED"
  | "SENAR"
  | "FUNRURAL"
  | "OUTRO";

export interface RegraTributaria {
  id: string;
  nome: string;
  tributo: TipoTributoOuFundo;
  estadoOrigem: string;
  estadoDestino: string | "*"; // "*" = qualquer destino
  produto: Produto | "*";
  tipoOperacao: string | "*";
  aliquotaPercentual?: number; // aplicada sobre base de cálculo (%)
  valorFixoPorSaca?: number; // alternativa a alíquota — valor fixo por saca
  baseDeCalculo: "VALOR_OPERACAO" | "VALOR_POR_SACA" | "CUSTOM";
  beneficioFiscal?: {
    nome: string;
    tipo: "REDUCAO_BASE" | "DIFERIMENTO" | "CREDITO" | "ISENCAO";
    percentualReducao?: number; // ex: 0.7 = reduz 70% da base/valor
    fonte: string;
  };
  vigenciaInicio: string; // ISO date
  vigenciaFim?: string; // ISO date, ausente = vigente
  fonte: string;
  versao: number;
  ativo: boolean;
}

export interface ItemTributarioCalculado {
  regraId: string;
  nome: string;
  tributo: TipoTributoOuFundo;
  base: number;
  aliquotaPercentual?: number;
  valorBruto: number;
  beneficioAplicado?: string;
  valorComBeneficio: number;
  versaoRegra: number;
  fonte: string;
}

export interface ResultadoTributario {
  itens: ItemTributarioCalculado[];
  totalTributos: number;
  pendencias: string[]; // cenários sem regra cadastrada
}

/* ---------------- freight_engine ---------------- */

export interface CotacaoFrete {
  fretePorTonelada: number;
  freteTotal: number;
  distanciaKm?: number;
  provedor: string;
  origemDado: OrigemDado;
}

export interface FreightProvider {
  nome: string;
  getQuote(input: DadosLogistica & { toneladas: number }): Promise<CotacaoFrete>;
  getDistance?(origem: string, destino: string): Promise<number>;
}

/* ---------------- piso mínimo ANTT (Lei 13.703/2018) ---------------- */

export type TipoCargaAntt =
  | "GRANEL_SOLIDO"
  | "GRANEL_LIQUIDO"
  | "CARGA_GERAL"
  | "FRIGORIFICADA"
  | "PERIGOSA"
  | "NEOGRANEL";

export type TabelaAntt = "A" | "B" | "C" | "D";

export interface RegraPisoMinimo {
  id: string;
  tabela: TabelaAntt;
  tipoCarga: TipoCargaAntt;
  numeroEixos: number;
  ccdPorKm: number; // coeficiente de custo de deslocamento, R$/km
  ccValorFixo: number; // coeficiente de carga e descarga, R$ fixo
  fonte: string;
  vigenciaInicio: string;
  vigenciaFim?: string;
  versao: number;
  ativo: boolean;
}

export interface ResultadoPisoMinimo {
  aplicavel: boolean;
  valorPiso?: number;
  regraId?: string;
  fonte?: string;
  freteInformadoAbaixoDoPiso?: boolean;
  pendencia?: string;
}

/* ---------------- deal_engine ---------------- */

export interface LinhaCusto {
  descricao: string;
  valorPorSaca: number;
  valorTotal: number;
  origem: OrigemDado;
}

export interface ResultadoOperacao {
  receitaTotal: ValorRastreado;
  custoMercadoria: ValorRastreado;
  custoLogistico: ValorRastreado;
  custoTributario: ValorRastreado;
  outrosCustos: ValorRastreado;
  custoTotal: ValorRastreado;
  resultado: ValorRastreado; // lucro (+) ou prejuízo (-)
  margemPercentual: number;
  resultadoPorSaca: number;
  resultadoPorTonelada: number;
  precoMinimoVendaPorSaca: number; // ponto de equilíbrio
  viavel: boolean;
  linhasCusto: LinhaCusto[];
  tributos: ResultadoTributario;
  frete: CotacaoFrete;
  pisoMinimoAntt: ResultadoPisoMinimo;
  pendenciasTributarias: string[];
}

export interface Cenario {
  nome: string;
  precoCompraPorSaca: number;
  precoVendaPorSaca: number;
  fretePorTonelada: number;
}

export interface ResultadoCenario extends Cenario {
  margemPercentual: number;
  resultado: number;
}
