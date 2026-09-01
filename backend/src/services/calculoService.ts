import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { TaxEngine } from "../engines/tax_engine/index.js";
import { FreightEngine } from "../engines/freight_engine/index.js";
import { DealEngine } from "../engines/deal_engine/index.js";
import { PisoMinimoEngine } from "../engines/freight_engine/piso_minimo/index.js";
import { seedPisoMinimoRules } from "../engines/freight_engine/piso_minimo/rules.seed.js";
import { carregarRegrasAtivas } from "../db/taxRulesRepo.js";
import { calcularDistanciaRodoviaria } from "./distanciaService.js";
import { db } from "../db/client.js";
import { operations, operationResults, idempotencyKeys } from "../db/schema.js";
import type { OperacaoInput, ResultadoOperacao } from "../types/domain.js";

/**
 * Única porta de entrada pro cálculo de viabilidade — REST e chat passam
 * pela mesma função, então o comportamento é idêntico não importa a
 * interface usada. Isso é intencional: a IA do chat nunca calcula nada
 * sozinha, ela só coleta dados e chama exatamente esta função.
 */
export async function montarDealEngine(): Promise<DealEngine> {
  const regras = await carregarRegrasAtivas();
  return new DealEngine(new TaxEngine(regras), new FreightEngine(), new PisoMinimoEngine(seedPisoMinimoRules));
}

/**
 * Distância é insumo do piso mínimo ANTT: sem ela o piso não pode ser
 * verificado. Quando o usuário informou os eixos (piso aplicável) mas não
 * a distância, calculamos a distância rodoviária real entre origem e
 * destino via OpenStreetMap/OSRM (fonte gratuita), marcada como
 * `api_externa` até a interface. Se a consulta falhar, o cálculo segue sem
 * distância e o piso vira pendência explícita — nunca um número estimado
 * em silêncio.
 */
export async function prepararLogisticaComDistancia(input: OperacaoInput): Promise<OperacaoInput> {
  const { logistica } = input;
  if (!logistica.numeroEixos) return input;
  if (logistica.distanciaKm != null && logistica.distanciaKm > 0) return input;

  const distancia = await calcularDistanciaRodoviaria(
    { municipio: input.compra.municipioOrigem, uf: input.compra.estadoOrigem },
    { municipio: input.venda.municipioDestino, uf: input.venda.estadoDestino }
  );
  if (!distancia.ok) return input;

  return {
    ...input,
    logistica: {
      ...logistica,
      distanciaKm: distancia.distanciaKm,
      origemDistancia: "api_externa",
    },
  };
}

/** Mesma chave de idempotência reutilizada com dados diferentes. A rota traduz para 409. */
export class ConflitoIdempotenciaError extends Error {
  readonly statusCode = 409;
  constructor() {
    super(
      "A chave de idempotência já foi usada com dados diferentes. " +
        "Gere uma chave nova para cada operação distinta."
    );
    this.name = "ConflitoIdempotenciaError";
  }
}

/**
 * Serialização estável: ordena as chaves de cada objeto recursivamente
 * antes de gerar o hash, para que o mesmo input lógico produza o mesmo
 * hash independente da ordem das propriedades no JSON recebido.
 */
function normalizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(normalizar);
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, normalizar(v)])
    );
  }
  return valor;
}

function hashInput(input: OperacaoInput): string {
  return createHash("sha256").update(JSON.stringify(normalizar(input))).digest("hex");
}

async function buscarReplay(chaveEscopada: string, inputHash: string) {
  const [existente] = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.chave, chaveEscopada))
    .limit(1);
  if (!existente) return null;
  if (existente.inputHash !== inputHash) throw new ConflitoIdempotenciaError();

  const [salvo] = await db
    .select()
    .from(operationResults)
    .where(eq(operationResults.operationId, existente.operationId))
    .limit(1);
  // Toda chave gravada por esta versão tem resultado_json junto (mesma
  // transação). Se não tiver, algo foi apagado fora do fluxo — erro explícito,
  // nunca recalcular em silêncio e devolver um número que não é o original.
  if (!salvo?.resultadoJson) {
    throw new Error(
      `Chave de idempotência aponta para a operação ${existente.operationId}, mas o resultado completo não está persistido.`
    );
  }
  return {
    operationId: existente.operationId,
    resultado: JSON.parse(salvo.resultadoJson) as ResultadoOperacao,
  };
}

export async function executarCalculo(
  input: OperacaoInput,
  /** Dono da consulta, quando há sessão. Sem isso a operação fica órfã e não aparece no dashboard de ninguém. */
  userId?: string | null,
  /**
   * Chave de idempotência opcional (header `Idempotency-Key`). Repetir a
   * requisição com a mesma chave e os mesmos dados — duplo clique, retry de
   * rede, F5 na hora errada — devolve a operação
   * original em vez de gravar uma duplicata. A chave é escopada por usuário:
   * duas pessoas podem usar "abc123" sem colidir.
   */
  idempotencyKey?: string | null
): Promise<{ operationId: string; resultado: ResultadoOperacao; replay?: boolean }> {
  const chaveEscopada = idempotencyKey ? `${userId ?? "anon"}:${idempotencyKey}` : null;
  const inputHash = chaveEscopada ? hashInput(input) : null;

  if (chaveEscopada && inputHash) {
    const replay = await buscarReplay(chaveEscopada, inputHash);
    if (replay) return { ...replay, replay: true };
  }

  const dealEngine = await montarDealEngine();
  const resultado = await dealEngine.calcular(await prepararLogisticaComDistancia(input));

  const operationId = randomUUID();
  const agora = new Date().toISOString();

  // No Postgres (node-postgres) a transação é assíncrona — ao contrário do
  // better-sqlite3, que era síncrono e rejeitava callback `async`. Aqui o
  // callback É async e os inserts são aguardados.
  try {
    await db.transaction(async (tx) => {
      await tx.insert(operations).values({
        id: operationId,
        userId: userId ?? null,
        produto: input.mercadoria.produto,
        quantidadeSacas: input.mercadoria.quantidadeSacas,
        criadoEm: agora,
        status: resultado.viavel ? "VIAVEL" : "NAO_VIAVEL",
      });
      await tx.insert(operationResults).values({
        id: randomUUID(),
        operationId,
        receitaTotal: resultado.receitaTotal.valor,
        custoMercadoria: resultado.custoMercadoria.valor,
        custoLogistico: resultado.custoLogistico.valor,
        custoTributario: resultado.custoTributario.valor,
        outrosCustos: resultado.outrosCustos.valor,
        custoTotal: resultado.custoTotal.valor,
        resultado: resultado.resultado.valor,
        margemPercentual: resultado.margemPercentual,
        precoMinimoVendaPorSaca: resultado.precoMinimoVendaPorSaca,
        viavel: resultado.viavel,
        // Resultado completo serializado (memória de cálculo, tributos,
        // pendências). Imutável: um replay de idempotência devolve
        // exatamente este JSON, e o histórico continua mostrando o número
        // calculado com a regra da época mesmo se a regra mudar depois.
        resultadoJson: JSON.stringify(resultado),
        calculadoEm: agora,
      });
      if (chaveEscopada && inputHash) {
        await tx.insert(idempotencyKeys).values({
          chave: chaveEscopada,
          inputHash,
          operationId,
          criadoEm: agora,
        });
      }
    });
  } catch (erro) {
    // Corrida: duas requisições com a mesma chave chegaram ao mesmo tempo.
    // A PK de idempotency_keys derruba a segunda transação (Postgres 23505);
    // em vez de devolver 500, relê a vencedora e devolve o mesmo resultado.
    const codigoPg = (erro as { code?: string }).code;
    if (codigoPg === "23505" && chaveEscopada && inputHash) {
      const replay = await buscarReplay(chaveEscopada, inputHash);
      if (replay) return { ...replay, replay: true };
    }
    throw erro;
  }

  return { operationId, resultado };
}
