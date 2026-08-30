/**
 * circuitBreaker
 *
 * Mesmo padrão que a MecProAI já usa em `server/ai.ts` — quando um provedor
 * de IA falha, evita desperdiçar tempo tentando ele de novo a cada
 * mensagem enquanto ele estiver conhecidamente indisponível. Lá isso é
 * feito com um Set de chaves esgotadas checado antes de cada tentativa;
 * aqui formalizo como um circuit breaker de verdade (aberto/fechado, com
 * cooldown exponencial), que é o mesmo princípio só mais explícito.
 *
 * Por provedor, guarda em memória: até quando o circuito está "aberto"
 * (ou seja, pulamos direto pro próximo provedor sem tentar) e quantas
 * falhas seguidas já aconteceram, pra aumentar o cooldown progressivamente
 * em vez de martelar um provedor fora do ar.
 *
 * Estado em memória do processo — reseta a cada redeploy, o que é aceitável
 * aqui (não precisa persistir; um provedor que caiu antes do redeploy pode
 * muito bem ter voltado).
 */

interface EstadoCircuito {
  abertoAte: number; // timestamp ms; 0 = fechado (provedor considerado saudável)
  falhasConsecutivas: number;
}

const estados = new Map<string, EstadoCircuito>();

const COOLDOWN_BASE_MS = 45_000; // 45s na primeira falha
const COOLDOWN_MAX_MS = 5 * 60_000; // nunca passa de 5min, mesmo com muitas falhas seguidas

export function circuitoAberto(provedor: string): boolean {
  const estado = estados.get(provedor);
  if (!estado) return false;
  return Date.now() < estado.abertoAte;
}

/** Chamar quando um provedor falha com erro temporário (503/429/sobrecarga). */
export function registrarFalha(provedor: string): void {
  const atual = estados.get(provedor) ?? { abertoAte: 0, falhasConsecutivas: 0 };
  const falhasConsecutivas = atual.falhasConsecutivas + 1;
  const cooldown = Math.min(COOLDOWN_BASE_MS * 2 ** (falhasConsecutivas - 1), COOLDOWN_MAX_MS);
  estados.set(provedor, { abertoAte: Date.now() + cooldown, falhasConsecutivas });
}

/** Chamar quando um provedor responde com sucesso — fecha o circuito e zera o contador. */
export function registrarSucesso(provedor: string): void {
  estados.set(provedor, { abertoAte: 0, falhasConsecutivas: 0 });
}

/** Pra diagnóstico/debug — mostra o estado atual de todos os provedores já vistos. */
export function statusCircuitos(): Record<string, { aberto: boolean; falhasConsecutivas: number; reabreEm: string | null }> {
  const agora = Date.now();
  const saida: Record<string, { aberto: boolean; falhasConsecutivas: number; reabreEm: string | null }> = {};
  for (const [nome, estado] of estados) {
    saida[nome] = {
      aberto: agora < estado.abertoAte,
      falhasConsecutivas: estado.falhasConsecutivas,
      reabreEm: estado.abertoAte > agora ? new Date(estado.abertoAte).toISOString() : null,
    };
  }
  return saida;
}
