import { describe, it, expect, beforeEach } from "vitest";
import { executarCalculo, ConflitoIdempotenciaError } from "../src/services/calculoService.js";
import { db } from "../src/db/client.js";
import { operations, operationResults, idempotencyKeys } from "../src/db/schema.js";
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
  await db.delete(idempotencyKeys);
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

  it("persiste o resultado completo em resultado_json (memória imutável)", async () => {
    const { operationId, resultado } = await executarCalculo(OPERACAO);

    const [salvo] = await db.select().from(operationResults);
    expect(salvo.operationId).toBe(operationId);
    expect(salvo.resultadoJson).toBeTruthy();
    expect(JSON.parse(salvo.resultadoJson!)).toEqual(resultado);
  });
});

describe("idempotência — duplo clique e retry de rede não duplicam operação", () => {
  it("mesma chave + mesmo input devolve a operação original, sem duplicar", async () => {
    const primeira = await executarCalculo(OPERACAO, null, "chave-1");
    const segunda = await executarCalculo(OPERACAO, null, "chave-1");

    expect(segunda.operationId).toBe(primeira.operationId);
    expect(segunda.replay).toBe(true);
    // O replay devolve exatamente o resultado persistido, número por número.
    expect(segunda.resultado).toEqual(primeira.resultado);

    const ops = await db.select().from(operations);
    expect(ops).toHaveLength(1);
  });

  it("mesma chave + input diferente falha com 409, sem gravar nada", async () => {
    await executarCalculo(OPERACAO, null, "chave-1");

    const outraOperacao: OperacaoInput = {
      ...OPERACAO,
      venda: { ...OPERACAO.venda, precoPorSaca: 71 },
    };
    await expect(executarCalculo(outraOperacao, null, "chave-1")).rejects.toBeInstanceOf(
      ConflitoIdempotenciaError
    );

    const ops = await db.select().from(operations);
    expect(ops).toHaveLength(1);
  });

  it("a mesma chave em usuários diferentes não colide", async () => {
    const a = await executarCalculo(OPERACAO, "usuario-a", "chave-1");
    const b = await executarCalculo(OPERACAO, "usuario-b", "chave-1");

    expect(a.operationId).not.toBe(b.operationId);
    const ops = await db.select().from(operations);
    expect(ops).toHaveLength(2);
  });

  it("ordem diferente das chaves do JSON produz o mesmo hash", async () => {
    const primeira = await executarCalculo(OPERACAO, null, "chave-1");

    // Remonta o input com as propriedades em outra ordem — é a mesma
    // operação, então tem que bater no replay, não virar duplicata.
    const reordenado = JSON.parse(
      `{"logistica":${JSON.stringify(OPERACAO.logistica)},"venda":${JSON.stringify(
        OPERACAO.venda
      )},"compra":${JSON.stringify(OPERACAO.compra)},"mercadoria":${JSON.stringify(
        OPERACAO.mercadoria
      )},"tipoOperacao":"SOBRE_RODAS"}`
    ) as OperacaoInput;
    const segunda = await executarCalculo(reordenado, null, "chave-1");

    expect(segunda.operationId).toBe(primeira.operationId);
    expect(segunda.replay).toBe(true);
  });

  it("sem chave, cada chamada grava uma operação nova (comportamento anterior preservado)", async () => {
    const a = await executarCalculo(OPERACAO);
    const b = await executarCalculo(OPERACAO);

    expect(a.operationId).not.toBe(b.operationId);
    expect(a.replay).toBeUndefined();
    const ops = await db.select().from(operations);
    expect(ops).toHaveLength(2);
  });
});
