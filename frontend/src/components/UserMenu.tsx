import { useEffect, useRef, useState } from "react";
import { logout, type Usuario } from "../api/client";

export function UserMenu({
  usuario,
  emAdmin,
  onIrParaAdmin,
  onVoltarAoCalculo,
  compacto = false,
}: {
  usuario: Usuario;
  emAdmin: boolean;
  onIrParaAdmin: () => void;
  onVoltarAoCalculo: () => void;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  async function sair() {
    try {
      await logout();
    } finally {
      // Recarrega para limpar todo o estado da aplicação de uma vez.
      window.location.href = "/";
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((v) => !v)}
        className={`flex items-center gap-2 rounded-card transition-colors hover:bg-papel ${
          compacto ? "h-10 w-10 justify-center" : "w-full px-2 py-2 text-left"
        }`}
        aria-label="Menu do usuário"
        title="Menu do usuário"
      >
        {usuario.avatarUrl ? (
          <img src={usuario.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy font-body text-xs text-white">
            {usuario.nome.charAt(0).toUpperCase()}
          </span>
        )}
        {!compacto && (
          <span className="min-w-0">
            <span className="block truncate font-body text-sm font-semibold text-tinta">{usuario.nome}</span>
            <span className="block truncate font-body text-[11px] text-tintaSuave">{usuario.email}</span>
          </span>
        )}
      </button>

      {aberto && (
        <div className={`absolute bottom-12 z-50 w-60 rounded-card border border-borda bg-white p-1.5 shadow-xl shadow-navy/15 ${compacto ? "left-12" : "left-0"}`}>
          <div className="border-b border-borda px-3 py-2.5">
            <p className="truncate font-body text-sm font-medium text-tinta">{usuario.nome}</p>
            <p className="truncate font-body text-[11px] text-tintaSuave">{usuario.email}</p>
          </div>

          {usuario.papel === "ADMIN" && (
            <button
              onClick={() => {
                emAdmin ? onVoltarAoCalculo() : onIrParaAdmin();
                setAberto(false);
              }}
              className="mt-1 flex w-full items-center gap-2.5 rounded-card px-3 py-2 text-left font-body text-sm text-tinta transition-colors hover:bg-papel"
            >
              {emAdmin ? "Voltar ao cálculo" : "Administração"}
            </button>
          )}

          <button
            onClick={sair}
            className="flex w-full items-center gap-2.5 rounded-card px-3 py-2 text-left font-body text-sm text-tinta transition-colors hover:bg-papel"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
