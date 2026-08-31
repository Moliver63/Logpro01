import { describe, expect, it } from "vitest";
import { operacaoInputSchema } from "../src/routes/validation.js";

const OPERACAO_VALIDA = {
  mercadoria: { produto: "SOJA", quantidadeSacas: 1000, pesoPorSacaKg: 60 },
  compra: { precoPorSaca: 40, municipioOrigem: "Sinop", estadoOrigem: "mt" },
  venda: { precoPorSaca: 70, municipioDestino: "Santos", estadoDestino: "sp" },
  logistica: { fretePorTonelada: 120 },
  tipoOperacao: "SOBRE_RODAS",
  dataOperacao: "2026-08-31",
};

describe("operacaoInputSchema", () => {
  it("normaliza UF para maiúsculo", () => {
    const parsed = operacaoInputSchema.parse(OPERACAO_VALIDA);
    expect(parsed.compra.estadoOrigem).toBe("MT");
    expect(parsed.venda.estadoDestino).toBe("SP");
  });

  it("rejeita UF inválida", () => {
    const parsed = operacaoInputSchema.safeParse({
      ...OPERACAO_VALIDA,
      compra: { ...OPERACAO_VALIDA.compra, estadoOrigem: "XX" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita frete ausente", () => {
    const parsed = operacaoInputSchema.safeParse({ ...OPERACAO_VALIDA, logistica: {} });
    expect(parsed.success).toBe(false);
  });

  it("rejeita frete zerado", () => {
    const parsed = operacaoInputSchema.safeParse({
      ...OPERACAO_VALIDA,
      logistica: { fretePorTonelada: 0 },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita despesa adicional sem valor", () => {
    const parsed = operacaoInputSchema.safeParse({
      ...OPERACAO_VALIDA,
      despesasAdicionais: [{ descricao: "Armazenagem" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita dataOperacao inválida", () => {
    const parsed = operacaoInputSchema.safeParse({ ...OPERACAO_VALIDA, dataOperacao: "2026-02-30" });
    expect(parsed.success).toBe(false);
  });
});
