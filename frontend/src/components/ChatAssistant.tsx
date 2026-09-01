import { useState, useRef, useEffect } from "react";
import { enviarMensagemChat, type MensagemChat } from "../api/client";
import type { ResultadoOperacao } from "../types";
import { ResultDashboard } from "./ResultDashboard";
import { CalculationMemory } from "./CalculationMemory";

interface Turno {
  role: "user" | "assistant";
  content: string;
  resultadoOperacao?: ResultadoOperacao | null;
}

const MENSAGEM_INICIAL: Turno = {
  role: "assistant",
  content:
    "Me conta a operação: produto, sacas, preço de compra, preço de venda, origem, destino e frete. Pode escrever do jeito que sair.",
};

export function ChatAssistant({ onConsultaRegistrada }: { onConsultaRegistrada?: () => void } = {}) {
  const [turnos, setTurnos] = useState<Turno[]>([MENSAGEM_INICIAL]);
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turnos, enviando]);

  async function enviar() {
    const texto = entrada.trim();
    if (!texto || enviando) return;

    const novosTurnos: Turno[] = [...turnos, { role: "user", content: texto }];
    setTurnos(novosTurnos);
    setEntrada("");
    setErro(null);
    setEnviando(true);

    try {
      const historico: MensagemChat[] = novosTurnos.map((t) => ({ role: t.role, content: t.content }));
      const resposta = await enviarMensagemChat(historico);
      setTurnos((atual) => [
        ...atual,
        {
          role: "assistant",
          content: resposta.resposta || "Certo.",
          resultadoOperacao: resposta.resultadoOperacao,
        },
      ]);
      // Se o assistente calculou algo, uma consulta nova foi salva.
      if (resposta.resultadoOperacao) onConsultaRegistrada?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao conversar com o assistente.");
    } finally {
      setEnviando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-h-[420px] max-h-[calc(100vh-310px)] space-y-4 overflow-y-auto rounded-card border border-borda bg-white/95 p-4 shadow-sm shadow-navy/[0.04]">
        {turnos.map((turno, i) => (
          <div key={i} className={turno.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`rounded-card px-4 py-3 font-body text-sm leading-relaxed shadow-sm ${
                turno.resultadoOperacao ? "max-w-full" : "max-w-[88%]"
              } ${
                turno.role === "user"
                  ? "bg-azul text-white shadow-azul/10"
                  : "border border-borda bg-papel text-tinta shadow-navy/[0.03]"
              }`}
            >
              <p className="whitespace-pre-wrap">{turno.content}</p>
              {turno.resultadoOperacao && (
                <div className="mt-4 -mx-1">
                  <ResultDashboard resultado={turno.resultadoOperacao} />
                  <div className="mt-3">
                    <CalculationMemory resultado={turno.resultadoOperacao} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="rounded-card border border-borda bg-papel px-4 py-2.5 font-body text-sm text-tintaSuave shadow-sm shadow-navy/[0.03]">
              Pensando…
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {erro && <p className="font-body text-xs text-risco">{erro}</p>}

      <div className="rounded-card border border-borda bg-white p-3 shadow-sm shadow-navy/[0.04]">
        <textarea
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={enviando}
          rows={2}
          placeholder="Ex: 50 mil sacas de soja, compro a 38 em Alto Taquari MT, vendo a 70 em Rancharia SP, frete 220 por tonelada"
          className="min-h-[76px] w-full resize-none rounded-card border border-transparent bg-papel px-3 py-2.5 font-body text-sm text-tinta placeholder:text-tintaSuave/50 focus:border-azul focus:bg-white focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-body text-[11px] text-tintaSuave">
            Enter envia. Shift + Enter quebra linha.
          </span>
          <button
            onClick={enviar}
            disabled={enviando || !entrada.trim()}
            className="rounded-card bg-brand-gradient px-5 py-2.5 font-body text-sm font-semibold text-white shadow-sm shadow-azul/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
