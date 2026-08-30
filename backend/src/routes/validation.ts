import { z } from "zod";

// Proteção contra valores absurdos (item 12) — limites generosos mas reais.
const precoPositivo = z.number().finite().gt(0).lt(1_000_000);
const quantidadePositiva = z.number().finite().gt(0).lt(10_000_000);

export const operacaoInputSchema = z.object({
  mercadoria: z.object({
    produto: z.enum(["SOJA", "MILHO", "TRIGO", "OUTRO"]),
    quantidadeSacas: quantidadePositiva,
    pesoPorSacaKg: z.number().finite().gt(0).lt(200).default(60),
    classificacao: z.string().optional(),
  }),
  compra: z.object({
    precoPorSaca: precoPositivo,
    municipioOrigem: z.string().min(1),
    estadoOrigem: z.string().length(2),
    fornecedor: z.string().optional(),
    regimeTributario: z.string().optional(),
    condicaoPagamento: z.string().optional(),
    dataPrevistaPagamento: z.string().optional(),
  }),
  venda: z.object({
    precoPorSaca: precoPositivo,
    municipioDestino: z.string().min(1),
    estadoDestino: z.string().length(2),
    comprador: z.string().optional(),
    condicaoPagamento: z.string().optional(),
    dataPrevistaRecebimento: z.string().optional(),
  }),
  logistica: z.object({
    distanciaKm: z.number().finite().gte(0).optional(),
    fretePorTonelada: z.number().finite().gte(0).optional(),
    freteTotalInformado: z.number().finite().gte(0).optional(),
    tipoVeiculo: z.string().optional(),
    capacidadeCargaTon: z.number().finite().gt(0).optional(),
    pedagios: z.number().finite().gte(0).optional(),
    outrosCustosLogisticos: z.number().finite().gte(0).optional(),
  }),
  comissao: z
    .object({
      comissaoVendaPorSaca: z.number().finite().gte(0).optional(),
      comissaoOriginacaoPorSaca: z.number().finite().gte(0).optional(),
      classificadorPorSaca: z.number().finite().gte(0).optional(),
    })
    .optional(),
  despesasAdicionais: z
    .array(
      z.object({
        descricao: z.string().min(1),
        valorPorSaca: z.number().finite().gte(0).optional(),
        valorTotal: z.number().finite().gte(0).optional(),
      })
    )
    .optional(),
  tipoOperacao: z.string().optional(),
});

export const simularCenariosSchema = z.object({
  operacao: operacaoInputSchema,
  cenarios: z
    .array(
      z.object({
        nome: z.string().min(1),
        precoCompraPorSaca: precoPositivo,
        precoVendaPorSaca: precoPositivo,
        fretePorTonelada: z.number().finite().gte(0),
      })
    )
    .min(1)
    .max(10),
});
