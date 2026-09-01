import { useEffect, useState } from "react";
import { getConsultas, getResumoUsuario, type ConsultaResumo } from "../api/client";

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

export function HistoricoSidebar({ recarregar }: { recarregar: number }) {
  const [consultas, setConsultas] = useState<ConsultaResumo[]>([]);
  const [resumo, setResumo] = useState<{ total: number; viaveis: number; margemMedia: number } | null>(null);
  const [carregando, setCarregando] = useState(true);

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
    <aside className="hidden w-72 shrink-0 flex-col border-r border-borda bg-white/85 backdrop-blur xl:flex">
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

      <div className="flex-1 overflow-y-auto">
        {carregando && (
          <p className="px-4 py-4 font-body text-xs text-tintaSuave">Carregando…</p>
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
                  {c.resultado !== null ? formatarBRL(c.resultado) : "—"}
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
    </aside>
  );
}
