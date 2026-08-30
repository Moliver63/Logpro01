import { db } from "./client.js";
import { taxRules } from "./schema.js";
import type { RegraTributaria } from "../types/domain.js";

export async function carregarRegrasAtivas(): Promise<RegraTributaria[]> {
  const linhas = await db.select().from(taxRules);
  return linhas.map((l): RegraTributaria => ({
    id: l.id,
    nome: l.nome,
    tributo: l.tributo as RegraTributaria["tributo"],
    estadoOrigem: l.estadoOrigem,
    estadoDestino: l.estadoDestino as RegraTributaria["estadoDestino"],
    produto: l.produto as RegraTributaria["produto"],
    tipoOperacao: l.tipoOperacao,
    aliquotaPercentual: l.aliquotaPercentual ?? undefined,
    valorFixoPorSaca: l.valorFixoPorSaca ?? undefined,
    baseDeCalculo: l.baseDeCalculo as RegraTributaria["baseDeCalculo"],
    beneficioFiscal: l.beneficioFiscalJson ? JSON.parse(l.beneficioFiscalJson) : undefined,
    vigenciaInicio: l.vigenciaInicio,
    vigenciaFim: l.vigenciaFim ?? undefined,
    fonte: l.fonte,
    versao: l.versao,
    ativo: Boolean(l.ativo),
  }));
}
