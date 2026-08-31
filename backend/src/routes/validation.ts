import { z } from "zod";

// Proteção contra valores absurdos (item 12) — limites generosos mas reais.
const precoPositivo = z.number().finite().gt(0).lt(1_000_000);
const quantidadePositiva = z.number().finite().gt(0).lt(10_000_000);
const textoCurto = z.string().trim().min(1).max(120);
const textoOpcional = z.string().trim().max(160).optional();
const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use data no formato YYYY-MM-DD.")
  .refine((valor) => {
    const data = new Date(`${valor}T00:00:00.000Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
  }, "Data inválida.");

const UFS_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
]);

const ufSchema = z
  .string()
  .trim()
  .transform((valor) => valor.toUpperCase())
  .refine((valor) => UFS_VALIDAS.has(valor), "UF brasileira inválida.");

const freteSchema = z
  .object({
    distanciaKm: z.number().finite().gte(0).optional(),
    fretePorTonelada: z.number().finite().gte(0).optional(),
    freteTotalInformado: z.number().finite().gte(0).optional(),
    tipoVeiculo: z.string().trim().max(80).optional(),
    capacidadeCargaTon: z.number().finite().gt(0).optional(),
    pedagios: z.number().finite().gte(0).optional(),
    outrosCustosLogisticos: z.number().finite().gte(0).optional(),
    numeroEixos: z.number().int().gte(2).lte(9).optional(),
  })
  .superRefine((logistica, ctx) => {
    const temFretePorTonelada = logistica.fretePorTonelada != null;
    const temFreteTotal = logistica.freteTotalInformado != null;
    if (!temFretePorTonelada && !temFreteTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fretePorTonelada"],
        message: "Informe frete por tonelada ou frete total.",
      });
      return;
    }
    if ((logistica.fretePorTonelada ?? 1) <= 0 || (logistica.freteTotalInformado ?? 1) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fretePorTonelada"],
        message: "Frete zerado não é aceito.",
      });
    }
  });

export const operacaoInputSchema = z.object({
  mercadoria: z.object({
    produto: z.enum(["SOJA", "MILHO", "TRIGO", "SORGO", "OUTRO"]),
    quantidadeSacas: quantidadePositiva,
    pesoPorSacaKg: z.number().finite().gt(0).lt(200).default(60),
    classificacao: textoOpcional,
  }),
  compra: z.object({
    precoPorSaca: precoPositivo,
    municipioOrigem: textoCurto,
    estadoOrigem: ufSchema,
    fornecedor: textoOpcional,
    regimeTributario: textoOpcional,
    condicaoPagamento: textoOpcional,
    dataPrevistaPagamento: dataIso.optional(),
  }),
  venda: z.object({
    precoPorSaca: precoPositivo,
    municipioDestino: textoCurto,
    estadoDestino: ufSchema,
    comprador: textoOpcional,
    condicaoPagamento: textoOpcional,
    dataPrevistaRecebimento: dataIso.optional(),
  }),
  logistica: freteSchema,
  comissao: z
    .object({
      comissaoVendaPorSaca: z.number().finite().gte(0).optional(),
      comissaoOriginacaoPorSaca: z.number().finite().gte(0).optional(),
      classificadorPorSaca: z.number().finite().gte(0).optional(),
    })
    .optional(),
  despesasAdicionais: z
    .array(
      z
        .object({
          descricao: textoCurto,
          valorPorSaca: z.number().finite().gte(0).optional(),
          valorTotal: z.number().finite().gte(0).optional(),
        })
        .refine((d) => d.valorPorSaca != null || d.valorTotal != null, {
          message: "Despesa adicional precisa de valorTotal ou valorPorSaca.",
        })
    )
    .max(30)
    .optional(),
  tipoOperacao: z.string().trim().max(60).optional(),
  dataOperacao: dataIso.optional(),
});

export const simularCenariosSchema = z.object({
  operacao: operacaoInputSchema,
  cenarios: z
    .array(
      z.object({
        nome: textoCurto,
        precoCompraPorSaca: precoPositivo,
        precoVendaPorSaca: precoPositivo,
        fretePorTonelada: z.number().finite().gt(0),
      })
    )
    .min(1)
    .max(10),
});
