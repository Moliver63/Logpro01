import { urlLoginGoogle } from "../api/client";

export function LoginScreen({ erro }: { erro?: string | null }) {
  const mensagemErro =
    erro === "desativado"
      ? "Seu acesso está desativado. Fale com o administrador."
      : erro
      ? "Não foi possível entrar. Tente de novo."
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <img src="/logo.png" alt="LogPro" className="h-14 w-14" />
            <h1 className="mt-4 font-display text-3xl font-medium text-tinta">
              Log<span className="text-azul">Pro</span>
            </h1>
            <p className="mt-2 font-body text-sm leading-snug text-tintaSuave">
              Motor de viabilidade de operações de grãos. Entre para calcular e acompanhar suas consultas.
            </p>
          </div>

          {mensagemErro && (
            <p className="mb-4 rounded-card border border-risco/30 bg-risco/5 px-4 py-3 text-center font-body text-sm text-risco">
              {mensagemErro}
            </p>
          )}

          <a
            href={urlLoginGoogle()}
            className="flex w-full items-center justify-center gap-3 rounded-card border border-borda bg-white px-4 py-3 font-body text-sm font-medium text-tinta transition-colors hover:bg-papel"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 01-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.75H1.7v2.98A11.5 11.5 0 0012 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.55 14.67a6.9 6.9 0 010-4.41V7.28H1.7a11.5 11.5 0 000 10.37l3.85-2.98z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.2 15.11 0 12 0 7.51 0 3.63 2.57 1.7 6.31l3.85 2.98C6.46 6.77 9 4.75 12 4.75z"
              />
            </svg>
            Entrar com Google
          </a>

          <p className="mt-6 text-center font-body text-[11px] leading-snug text-tintaSuave">
            Ao entrar, suas consultas ficam salvas na sua conta.
          </p>
        </div>
      </div>

      <footer className="border-t border-borda px-6 py-5 text-center">
        <p className="font-body text-xs text-tintaSuave">
          © 2026 LogPro · Michel Leal — Lab Quântico de Software
        </p>
      </footer>
    </div>
  );
}
