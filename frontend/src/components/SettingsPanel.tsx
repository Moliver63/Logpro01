import { useEffect, useRef, useState } from "react";
import { getChatStatus } from "../api/client";
import type { StatusChat, StatusProvedorIA } from "../types";

function Bolinha({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-sucesso" : "bg-risco"}`} />;
}

function LinhaProvedor({ nome, status }: { nome: string; status: StatusProvedorIA }) {
  const disponivel = status.configurado && !status.aberto;
  return (
    <div className="rounded-card border border-borda bg-papel p-3">
      <div className="flex items-center justify-between">
        <span className="font-body text-sm font-semibold text-tinta">{nome}</span>
        <span className="flex items-center gap-1.5 font-body text-[11px] text-tintaSuave">
          <Bolinha ok={disponivel} />
          {!status.configurado ? "sem chave" : status.aberto ? "indisponível agora" : "disponível"}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-tintaSuave">{status.modelo}</p>
      {status.chaves && (
        <p className="mt-1 font-body text-[11px] text-tintaSuave">
          {status.chaves.disponiveisAgora} de {status.chaves.total} chave(s) disponível(is)
        </p>
      )}
      {status.aberto && status.reabreEm && (
        <p className="mt-1 font-body text-[11px] text-tintaSuave">
          Volta a tentar às {new Date(status.reabreEm).toLocaleTimeString("pt-BR")}
        </p>
      )}
      {(status.falhasConsecutivas ?? 0) > 0 && (
        <p className="mt-1 font-body text-[11px] text-tintaSuave">{status.falhasConsecutivas} falha(s) recente(s)</p>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const [aberto, setAberto] = useState(false);
  const [status, setStatus] = useState<StatusChat | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  async function abrir() {
    const novoEstado = !aberto;
    setAberto(novoEstado);
    if (novoEstado) {
      setCarregando(true);
      setErro(null);
      try {
        setStatus(await getChatStatus());
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao consultar status.");
      } finally {
        setCarregando(false);
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={abrir}
        aria-label="Configurações"
        title="Configurações"
        className="flex h-9 w-9 items-center justify-center rounded-card text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path
            d="M12 15a3 3 0 100-6 3 3 0 000 6z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005 15a1.65 1.65 0 00-1.51-1H3.4a2 2 0 110-4h.09A1.65 1.65 0 005 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {aberto && (
        <div className="absolute right-0 top-11 z-20 w-72 rounded-card border border-borda bg-white p-3 shadow-lg">
          <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-tintaSuave">
            Assistentes de IA
          </p>
          {carregando && <p className="font-body text-xs text-tintaSuave">Consultando…</p>}
          {erro && <p className="font-body text-xs text-risco">{erro}</p>}
          {status && (
            <div className="space-y-2">
              <LinhaProvedor nome="Gemini" status={status.gemini} />
              <LinhaProvedor nome="Groq" status={status.groq} />
              <p className="font-body text-[11px] leading-snug text-tintaSuave">
                Quando um provedor está indisponível, o chat troca para o próximo automaticamente. Sem nenhum
                disponível, ainda funciona com extração local simples.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
