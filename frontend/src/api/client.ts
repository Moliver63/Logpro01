import type { OperacaoInput, ResultadoOperacao, Cenario, ResultadoCenario } from "../types";

const BASE = "/api";

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
