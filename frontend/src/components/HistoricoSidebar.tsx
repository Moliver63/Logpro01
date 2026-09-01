import { useEffect, useState } from "react";
import { getConsultas, getResumoUsuario, type ConsultaResumo, type Usuario } from "../api/client";
import type { FormState } from "./OperationForm/useOperationForm";
import { SettingsPanel } from "./SettingsPanel";
import { UserMenu } from "./UserMenu";

function formatarData(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatarBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function HistoricoSidebar({
  recarregar,
  usuario,
  emAdmin,
  form,
  onAbrirFormulario,
  onAplicarPadroes,
  onIrParaAdmin,
  onVoltarAoCalculo,
}: {
  recarregar: number;
  usuario: Usuario;
  emAdmin: boolean;
  form: FormState;
  onAbrirFormulario: () => void;
  onAplicarPadroes: () => void;
  onIrParaAdmin: () => void;
  onVoltarAoCalculo: () => void;
}) {
  const [consultas, setConsultas] = useState<ConsultaResumo[]>([]);
  const [resumo, setResumo] = useState<{ total: number; viaveis: number; margemMedia: number } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    Promise.all([getConsultas(), getResumoUsuario()])
      .then(([c, r]) => {
        if (cancelado) return;
        setConsultas(c.consultas);
        setResumo(r);
      })
      .catch(() => {
        /* silencioso: o histórico é complementar, não bloqueia o uso */
      })
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [recarregar]);

  return (
    <aside
      className={`flex min-h-screen shrink-0 flex-col border-r border-borda bg-white/90 backdrop-blur transition-[width] duration-200 ${
        expandido ? "w-72" : "w-16"
      }`}
    >
      <button
        onClick={() => setExpandido((v) => !v)}
        className={`flex h-16 items-center gap-3 border-b border-borda px-3 text-left transition-colors hover:bg-papel ${
          expandido ? "justify-between" : "justify-center"
        }`}
        aria-label={expandido ? "Recolher menu lateral" : "Expandir menu lateral"}
        title={expandido ? "Recolher menu lateral" : "Expandir menu lateral"}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-navy ring-1 ring-navy/10">
            <img src="/logo.png" alt="LogPro" className="h-8 w-8" />
          </span>
          {expandido && (
            <span className="min-w-0">
              <span className="block truncate font-display text-xl font-extrabold leading-none text-tinta">
                Log<span className="text-azul">Pro</span>
              </span>
              <span className="mt-1.5 block truncate font-body text-[11px] uppercase tracking-widest text-tintaSuave">
                Gestão logística inteligente
              </span>
            </span>
          )}
        </span>
        {expandido && (
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-tintaSuave">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 overflow-hidden">
        {expandido ? (
          <>
            <div className="border-b border-borda px-5 py-5">
              <span className="font-mono text-[11px] uppercase tracking-widest text-tintaSuave">
                Minhas consultas
              </span>
              {resumo && resumo.total > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 font-body text-[11px] text-tintaSuave">
                  <span className="rounded-card border border-borda bg-papel px-3 py-2">
                    <strong className="text-tinta">{resumo.total}</strong> no total
                  </span>
                  <span className="rounded-card border border-sucesso/20 bg-sucesso/5 px-3 py-2">
                    <strong className="text-sucessoDark">{resumo.viaveis}</strong> viáveis
                  </span>
                </div>
              )}
            </div>

            <div className="h-full overflow-y-auto pb-28">
              {carregando && (
                <p className="px-4 py-4 font-body text-xs text-tintaSuave">Carregando...</p>
              )}

              {!carregando && consultas.length === 0 && (
                <p className="px-4 py-4 font-body text-xs leading-snug text-tintaSuave">
                  Nenhuma consulta ainda. As operações que você calcular aparecem aqui.
                </p>
              )}

              <ul className="p-2">
                {consultas.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-card border border-transparent px-3 py-3 transition-colors hover:border-borda hover:bg-papel"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-body text-sm font-semibold text-tinta">
                        {c.produto.charAt(0) + c.produto.slice(1).toLowerCase()}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-tintaSuave">
                        {formatarData(c.criadoEm)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${
                          c.viavel ? "bg-sucesso/10 text-sucessoDark" : "bg-risco/10 text-risco"
                        }`}
                      >
                        {c.viavel ? "Viável" : "Não viável"}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-tintaSuave">
                        {c.resultado !== null ? formatarBRL(c.resultado) : "-"}
                      </span>
                    </div>
                    <span className="mt-1 block font-body text-[11px] text-tintaSuave">
                      {c.quantidadeSacas.toLocaleString("pt-BR")} sacas
                      {c.margemPercentual !== null && ` · margem ${c.margemPercentual.toFixed(1)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3">
            <button
              onClick={onAbrirFormulario}
              className="flex h-10 w-10 items-center justify-center rounded-card text-tintaSuave transition-colors hover:bg-papel hover:text-tinta"
              title="Nova operação"
              aria-label="Nova operação"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <span className="font-mono text-[10px] text-tintaSuave">{resumo?.total ?? 0}</span>
          </div>
        )}
      </div>

      <div className="border-t border-borda p-3">
        <div className={`flex ${expandido ? "flex-col gap-1" : "items-center justify-center gap-2"}`}>
          <SettingsPanel
            form={form}
            compacto={!expandido}
            onAbrirFormulario={onAbrirFormulario}
            onAplicarPadroes={onAplicarPadroes}
          />
          <UserMenu
            usuario={usuario}
            compacto={!expandido}
            emAdmin={emAdmin}
            onIrParaAdmin={onIrParaAdmin}
            onVoltarAoCalculo={onVoltarAoCalculo}
          />
        </div>
      </div>
    </aside>
  );
}
