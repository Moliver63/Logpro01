export type Produto = "SOJA" | "MILHO" | "TRIGO" | "SORGO" | "OUTRO";

export interface OperacaoInput {
  mercadoria: {
    produto: Produto;
    quantidadeSacas: number;
    pesoPorSacaKg: number;
    classificacao?: string;
  };
  compra: {
    precoPorSaca: number;
    municipioOrigem: string;
    estadoOrigem: string;
    fornecedor?: string;
    condicaoPagamento?: string;
    dataPrevistaPagamento?: string;
  };
  venda: {
    precoPorSaca: number;
    municipioDestino: string;
    estadoDestino: string;
    comprador?: string;
    condicaoPagamento?: string;
    dataPrevistaRecebimento?: string;
  };
  logistica: {
    distanciaKm?: number;
    fretePorTonelada?: number;
    freteTotalInformado?: number;
    tipoVeiculo?: string;
    pedagios?: number;
    outrosCustosLogisticos?: number;
    numeroEixos?: number;
  };
  comissao?: {
    comissaoVendaPorSaca?: number;
    comissaoOriginacaoPorSaca?: number;
    classificadorPorSaca?: number;
  };
  despesasAdicionais?: { descricao: string; valorTotal?: number; valorPorSaca?: number }[];
  tipoOperacao?: string;
  dataOperacao?: string;
}

export interface ValorRastreado {
  valor: number;
  origem: "informado_usuario" | "calculado_sistema" | "api_externa" | "estimado";
  observacao?: string;
}

export interface ItemTributarioCalculado {
  regraId: string;
  nome: string;
  tributo: string;
  base: number;
  aliquotaPercentual?: number;
  valorBruto: number;
  beneficioAplicado?: string;
  valorComBeneficio: number;
  versaoRegra: number;
  fonte: string;
}

export interface LinhaCusto {
  descricao: string;
  valorPorSaca: number;
  valorTotal: number;
  origem: string;
}

export interface ResultadoPisoMinimo {
  aplicavel: boolean;
  valorPiso?: number;
  regraId?: string;
  fonte?: string;
  freteInformadoAbaixoDoPiso?: boolean;
  pendencia?: string;
}

export interface ResultadoOperacao {
  receitaTotal: ValorRastreado;
  custoMercadoria: ValorRastreado;
  custoLogistico: ValorRastreado;
  custoTributario: ValorRastreado;
  outrosCustos: ValorRastreado;
  custoTotal: ValorRastreado;
  resultado: ValorRastreado;
  margemPercentual: number;
  resultadoPorSaca: number;
  resultadoPorTonelada: number;
  precoMinimoVendaPorSaca: number;
  viavel: boolean;
  calculoCompleto: boolean;
  linhasCusto: LinhaCusto[];
  tributos: {
    itens: ItemTributarioCalculado[];
    totalTributos: number;
    pendencias: string[];
  };
  frete: {
    fretePorTonelada: number;
    freteTotal: number;
    provedor: string;
    origemDado: string;
  };
  pisoMinimoAntt: ResultadoPisoMinimo;
  pendenciasTributarias: string[];
  pendenciasOperacionais: string[];
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

export interface ResultadoReferenciaPreco {
  aplicavel: boolean;
  valorPorSaca?: number;
  moeda?: "BRL";
  cotacaoOrigemUsdPorBushel?: number;
  taxaCambioUsdBrl?: number;
  dataReferencia?: string;
  fonte?: string;
  pendencia?: string;
}
