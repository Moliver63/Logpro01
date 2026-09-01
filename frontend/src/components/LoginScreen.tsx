import { urlLoginGoogle } from "../api/client";

export function LoginScreen({ erro }: { erro?: string | null }) {
  const mensagemErro =
    erro === "desativado"
      ? "Seu acesso está desativado. Fale com o administrador."
      : erro
      ? "Não foi possível entrar. Tente de novo."
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-surface-gradient">
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-card border border-borda bg-white shadow-xl shadow-navy/[0.08] md:grid-cols-[1.05fr_0.95fr]">
          <section className="bg-navy px-6 py-8 text-white sm:px-8 md:px-10 md:py-12">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-card border border-white/15 bg-white/10">
                <img src="/logo.png" alt="LogPro" className="h-8 w-8" />
              </span>
              <div>
                <span className="block font-mono text-[11px] uppercase tracking-widest text-white/55">
                  Gestao de margem
                </span>
                <h1 className="font-display text-3xl font-bold">
                  Log<span className="text-ciano">Pro</span>
                </h1>
              </div>
            </div>

            <div className="mt-12 max-w-md">
              <p className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
                Viabilidade de graos com frete, tributos e pendencias no mesmo lugar.
              </p>
              <p className="mt-4 font-body text-sm leading-6 text-white/70">
                Use o assistente ou o formulario para registrar operacoes, comparar cenarios e manter historico das consultas.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3">
              <div className="rounded-card border border-white/10 bg-white/10 p-3">
                <span className="block font-mono text-lg font-semibold text-ciano">UF</span>
                <span className="mt-1 block font-body text-[11px] leading-snug text-white/55">
                  Origem e destino
                </span>
              </div>
              <div className="rounded-card border border-white/10 bg-white/10 p-3">
                <span className="block font-mono text-lg font-semibold text-ciano">ANTT</span>
                <span className="mt-1 block font-body text-[11px] leading-snug text-white/55">
                  Piso minimo
                </span>
              </div>
              <div className="rounded-card border border-white/10 bg-white/10 p-3">
                <span className="block font-mono text-lg font-semibold text-ciano">R$</span>
                <span className="mt-1 block font-body text-[11px] leading-snug text-white/55">
                  Margem final
                </span>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center px-6 py-10 sm:px-8 md:px-10">
            <div className="w-full max-w-sm">
              <div className="mb-8">
                <span className="font-mono text-[11px] uppercase tracking-widest text-tintaSuave">
                  Acesso seguro
                </span>
                <h2 className="mt-2 font-display text-2xl font-semibold text-tinta">
                  Entrar no painel
                </h2>
                <p className="mt-2 font-body text-sm leading-6 text-tintaSuave">
                  Suas operacoes calculadas ficam salvas e disponiveis no historico da conta.
                </p>
              </div>

              {mensagemErro && (
                <p className="mb-4 rounded-card border border-risco/30 bg-risco/5 px-4 py-3 font-body text-sm text-risco">
                  {mensagemErro}
                </p>
              )}

              <a
                href={urlLoginGoogle()}
                className="flex w-full items-center justify-center gap-3 rounded-card border border-borda bg-white px-4 py-3 font-body text-sm font-semibold text-tinta shadow-sm shadow-navy/[0.04] transition-colors hover:border-azul/40 hover:bg-papel focus:outline-none focus:ring-2 focus:ring-azul/25"
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
                Acesso vinculado ao e-mail autorizado pelo administrador.
              </p>
            </div>
          </section>
        </div>
      </div>

      <footer className="border-t border-borda/70 bg-white/55 px-6 py-5 text-center">
        <p className="font-body text-xs text-tintaSuave">
          © 2026 LogPro · Michel Leal — Lab Quântico de Software
        </p>
      </footer>
    </div>
  );
}
