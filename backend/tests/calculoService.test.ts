import { describe, it, expect, beforeEach } from "vitest";
import { executarCalculo } from "../src/services/calculoService.js";
import { db } from "../src/db/client.js";
import { operations, operationResults } from "../src/db/schema.js";
import type { OperacaoInput } from "../src/types/domain.js";
import { execSync } from "node:child_process";

/**
 * REGRESSÃO CRÍTICA
 *
 * Os testes de motor (dealEngine.test.ts) exercitam o DealEngine
 * diretamente e por isso NÃO passam por `executarCalculo` — que é o
 * caminho real usado pela API e pelo chat. Isso deixou escapar um bug em
 * que toda operação válida falhava com 500:
 *
 *   TypeError: Transaction function cannot return a promise
 *
 * Este teste cobre a fronteira entre cálculo e persistência. O bug original
 * era uma transação síncrona do better-sqlite3 recebendo callback `async`;
 * hoje o banco é Postgres (transação assíncrona), mas a fronteira continua
 * sendo o ponto que os testes de motor não alcançam.
 */

const OPERACAO: OperacaoInput = {
  mercadoria: { produto: "SOJA", quantidadeSacas: 50000, pesoPorSacaKg: 60 },
  compra: { precoPorSaca: 38, municipioOrigem: "Alto Taquari", estadoOrigem: "MT" },
  venda: { precoPorSaca: 70, municipioDestino: "Rancharia", estadoDestino: "SP" },
  logistica: { fretePorTonelada: 250 },
  tipoOperacao: "SOBRE_RODAS",
};

// Cria as tabelas e carrega as regras de referência pelo mesmo caminho que
// o ambiente real usa, em vez de duplicar o DDL aqui.
execSync("npx tsx src/db/seed.ts", { stdio: "ignore" });

beforeEach(async () => {
  await db.delete(operationResults);
  await db.delete(operations);
});

describe("executarCalculo — caminho real usado pela API e pelo chat", () => {
  it("calcula e persiste sem lançar", async () => {
    const { operationId, resultado } = await executarCalculo(OPERACAO);

    expect(operationId).toBeTruthy();
    expect(resultado.receitaTotal.valor).toBe(3_500_000);
  });

  it("grava a operação e o resultado no banco", async () => {
    const { operationId } = await executarCalculo(OPERACAO);

    const ops = await db.select().from(operations);
    const results = await db.select().from(operationResults);

    expect(ops.some((o) => o.id === operationId)).toBe(true);
    expect(results.some((r) => r.operationId === operationId)).toBe(true);
  });
});
