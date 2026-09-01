import { useEffect, useRef, useState } from "react";
import { logout, type Usuario } from "../api/client";

export function UserMenu({
  usuario,
  emAdmin,
  onIrParaAdmin,
  onVoltarAoCalculo,
}: {
  usuario: Usuario;
  emAdmin: boolean;
  onIrParaAdmin: () => void;
  onVoltarAoCalculo: () => void;
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
        className="flex items-center gap-2 rounded-card px-1.5 py-1 transition-colors hover:bg-white/10"
        aria-label="Menu do usuário"
      >
        {usuario.avatarUrl ? (
          <img src={usuario.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 font-body text-xs text-white">
            {usuario.nome.charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-11 z-20 w-60 rounded-card border border-borda bg-white p-1.5 shadow-lg">
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
