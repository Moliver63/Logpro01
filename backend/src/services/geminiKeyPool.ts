/**
 * geminiKeyPool
 *
 * Mesmo padrão de rotação de chaves que a MecProAI já usa em `server/ai.ts`
 * (lá com até 5 chaves Gemini + 10 chaves Groq). Cada chave gratuita do
 * Gemini tem cota diária baixa (ex: 20 requisições/dia num modelo) — com
 * mais de uma chave, quando uma esgota, a próxima assume, multiplicando a
 * cota efetiva disponível por dia.
 *
 * Suporta GEMINI_API_KEY, GEMINI_API_KEY2, GEMINI_API_KEY3 — configure só
 * as que tiver; não precisa das três.
 */

interface EstadoChave {
  indisponivelAte: number;
}

const estados = new Map<string, EstadoChave>();
const COOLDOWN_COTA_MS = 3 * 60 * 60_000; // 3h — mesma janela conservadora do circuit breaker por cota

function chavesConfiguradas(): string[] {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2, process.env.GEMINI_API_KEY3].filter(
    (k): k is string => !!k && k.trim().length > 0
  );
}

/** Devolve a próxima chave ainda não marcada como esgotada, ou null se todas estiverem indisponíveis. */
export function proximaChaveDisponivel(): string | null {
  const agora = Date.now();
  for (const chave of chavesConfiguradas()) {
    const estado = estados.get(chave);
    if (!estado || estado.indisponivelAte < agora) return chave;
  }
  return null;
}

export function marcarChaveEsgotada(chave: string, cooldownMs = COOLDOWN_COTA_MS): void {
  estados.set(chave, { indisponivelAte: Date.now() + cooldownMs });
}

export function totalChavesConfiguradas(): number {
  return chavesConfiguradas().length;
}

/** Pra diagnóstico — quantas chaves configuradas, quantas disponíveis agora. */
export function statusChaves(): { total: number; disponiveisAgora: number } {
  const agora = Date.now();
  const chaves = chavesConfiguradas();
  const disponiveis = chaves.filter((c) => {
    const estado = estados.get(c);
    return !estado || estado.indisponivelAte < agora;
  });
  return { total: chaves.length, disponiveisAgora: disponiveis.length };
}
