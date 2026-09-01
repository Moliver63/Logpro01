import type {
  OperacaoInput,
  ResultadoOperacao,
  Cenario,
  ResultadoCenario,
  ResultadoReferenciaFreteAntt,
} from "../types";

// Em dev local, o vite.config.ts faz proxy de /api para o backend (localhost:3333),
// então "" + "/api" funciona sem configurar nada. Em produção (Static Site na
// Render), frontend e backend vivem em domínios .onrender.com diferentes — não
// existe proxy — então é preciso apontar explicitamente para a URL pública do
// backend via variável de ambiente VITE_API_URL, configurada no serviço do
// Render (ex: https://logpro-backend.onrender.com).
const API_ROOT = import.meta.env.VITE_API_URL ?? "";
const BASE = `${API_ROOT}/api`;

/** Lançado quando a sessão não existe ou expirou, para a UI voltar ao login. */
export class NaoAutenticadoError extends Error {
  constructor() {
    super("Sessão expirada.");
    this.name = "NaoAutenticadoError";
  }
}

// credentials: "include" é obrigatório para o cookie de sessão viajar — o
// frontend e o backend ficam em domínios diferentes em produção.
async function requisicao<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...init });
  if (res.status === 401) throw new NaoAutenticadoError();
  if (!res.ok) {
    const erro = await res.json().catch(() => ({}));
    throw new Error(erro?.erro ?? `Falha na requisição (${res.status})`);
  }
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return requisicao<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function get<T>(path: string): Promise<T> {
  return requisicao<T>(path);
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
  return get<import("../types").ResultadoReferenciaPreco>(`/price-reference/${produto}`);
}

export async function calcularReferenciaFreteAntt(input: {
  quantidadeSacas?: number;
  pesoPorSacaKg?: number;
  distanciaKm?: number;
  numeroEixos?: number;
  origem?: { municipio: string; uf: string };
  destino?: { municipio: string; uf: string };
}) {
  return post<ResultadoReferenciaFreteAntt>("/freight-reference/antt", input);
}

export interface MensagemChat {
  role: "user" | "assistant";
  content: string;
}

export interface RespostaChat {
  resposta: string;
  resultadoOperacao: ResultadoOperacao | null;
  operationId: string | null;
}

export async function enviarMensagemChat(mensagens: MensagemChat[]): Promise<RespostaChat> {
  return post("/chat", { mensagens });
}

/* ---------------- Autenticação, dashboard e admin ---------------- */

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
  papel: string;
  ativo: boolean;
}

export async function getSessao(): Promise<{
  autenticado: boolean;
  loginDisponivel: boolean;
  usuario: Usuario | null;
}> {
  // Diferente das demais, esta rota responde 200 mesmo deslogado — é ela
  // que a aplicação usa para descobrir se deve mostrar a tela de login.
  const res = await fetch(`${BASE}/auth/me`, { credentials: "include" });
  if (!res.ok) return { autenticado: false, loginDisponivel: false, usuario: null };
  return res.json();
}

export function urlLoginGoogle(): string {
  return `${BASE}/auth/google`;
}

export async function logout(): Promise<void> {
  await requisicao("/auth/logout", { method: "POST" });
}

export interface ConsultaResumo {
  id: string;
  produto: string;
  quantidadeSacas: number;
  criadoEm: string;
  status: string;
  resultado: number | null;
  margemPercentual: number | null;
  viavel: boolean | null;
}

export async function getConsultas(): Promise<{ consultas: ConsultaResumo[] }> {
  return get("/dashboard/consultas");
}

export async function getResumoUsuario(): Promise<{
  total: number;
  viaveis: number;
  naoViaveis: number;
  margemMedia: number;
}> {
  return get("/dashboard/resumo");
}

export interface UsuarioAdmin extends Usuario {
  criadoEm: string;
  ultimoAcessoEm: string | null;
  consultas: number;
}

export async function getUsuariosAdmin(): Promise<{ usuarios: UsuarioAdmin[] }> {
  return get("/admin/usuarios");
}

export async function atualizarUsuarioAdmin(
  id: string,
  mudancas: { ativo?: boolean; papel?: string }
): Promise<{ usuario: UsuarioAdmin }> {
  return requisicao(`/admin/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mudancas),
  });
}

export async function getResumoAdmin(): Promise<{
  totalUsuarios: number;
  ativos: number;
  inativos: number;
  totalConsultas: number;
}> {
  return get("/admin/resumo");
}
