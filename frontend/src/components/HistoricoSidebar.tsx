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
    <aside className="flex w-64 shrink-0 flex-col border-r border-borda bg-white">
      <div className="border-b border-borda px-4 py-4">
        <span className="font-mono text-[11px] uppercase tracking-widest text-tintaSuave">
          Minhas consultas
        </span>
        {resumo && resumo.total > 0 && (
          <div className="mt-2 flex gap-3 font-body text-[11px] text-tintaSuave">
            <span>
              <strong className="text-tinta">{resumo.total}</strong> no total
            </span>
            <span>
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

        <ul>
          {consultas.map((c) => (
            <li key={c.id} className="border-b border-borda/60 px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-body text-sm font-medium text-tinta">
                  {c.produto.charAt(0) + c.produto.slice(1).toLowerCase()}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-tintaSuave">
                  {formatarData(c.criadoEm)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    c.viavel ? "bg-sucesso" : "bg-risco"
                  }`}
                />
                <span className="font-mono text-[11px] text-tintaSuave">
                  {c.resultado !== null ? formatarBRL(c.resultado) : "—"}
                  {c.margemPercentual !== null && ` · ${c.margemPercentual.toFixed(1)}%`}
                </span>
              </div>
              <span className="mt-0.5 block font-body text-[11px] text-tintaSuave">
                {c.quantidadeSacas.toLocaleString("pt-BR")} sacas
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
