import type { OperacaoInput, ResultadoOperacao, Cenario, ResultadoCenario } from "../types";

// Em dev local, o vite.config.ts faz proxy de /api para o backend (localhost:3333),
// então "" + "/api" funciona sem configurar nada. Em produção (Static Site na
// Render), frontend e backend vivem em domínios .onrender.com diferentes — não
// existe proxy — então é preciso apontar explicitamente para a URL pública do
// backend via variável de ambiente VITE_API_URL, configurada no serviço do
// Render (ex: https://logpro-backend.onrender.com).
const API_ROOT = import.meta.env.VITE_API_URL ?? "";
const BASE = `${API_ROOT}/api`;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const erro = await res.json().catch(() => ({}));
    throw new Error(erro?.erro ?? `Falha na requisição (${res.status})`);
  }
  return res.json();
}

export async function calcularOperacao(
  input: OperacaoInput
): Promise<{ operationId: string; resultado: ResultadoOperacao }> {
  return post("/operations/calcular", input);
}

export async function simularCenarios(
  operacao: OperacaoInput,
  cenarios: Cenario[]
): Promise<{ cenarios: ResultadoCenario[]; melhorCenario: string }> {
  return post("/operations/simular", { operacao, cenarios });
}

export async function getReferenciaPreco(produto: string) {
  const res = await fetch(`${BASE}/price-reference/${produto}`);
  if (!res.ok) {
    throw new Error(`Falha ao consultar referência de preço (${res.status})`);
  }
  return res.json() as Promise<import("../types").ResultadoReferenciaPreco>;
}
