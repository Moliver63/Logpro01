import { useEffect, useMemo, useRef, useState } from "react";
import type { FormState } from "./OperationForm/useOperationForm";
import {
  CAMPOS_FIXOS,
  carregarPreferencias,
  contarCamposFixos,
  limparPreferencias,
  salvarPreferencias,
  type CampoFixo,
  type PreferenciasOperacao,
} from "../preferences";

const LABELS: Record<CampoFixo, { titulo: string; grupo: string }> = {
  produto: { titulo: "Produto", grupo: "Mercadoria" },
  pesoPorSacaKg: { titulo: "Peso por saca", grupo: "Mercadoria" },
  precoCompraPorSaca: { titulo: "Valor de compra / saca", grupo: "Preco" },
  precoVendaPorSaca: { titulo: "Valor de venda / saca", grupo: "Preco" },
  fretePorTonelada: { titulo: "Frete / tonelada", grupo: "Frete" },
  distanciaKm: { titulo: "Distancia", grupo: "Frete" },
  numeroEixos: { titulo: "Numero de eixos", grupo: "Frete" },
  pedagios: { titulo: "Pedagios", grupo: "Frete" },
  outrosCustosLogisticos: { titulo: "Outros custos logisticos", grupo: "Frete" },
  comissaoVendaPorSaca: { titulo: "Comissao de venda", grupo: "Custos" },
  comissaoOriginacaoPorSaca: { titulo: "Comissao de originacao", grupo: "Custos" },
  classificadorPorSaca: { titulo: "Classificador", grupo: "Custos" },
};

const GRUPOS = ["Mercadoria", "Preco", "Frete", "Custos"] as const;

function valorVisivel(valor: FormState[CampoFixo] | undefined): string {
  if (valor === undefined || valor === "") return "sem valor";
  return String(valor);
}

function copiarValoresSelecionados(form: FormState, preferencias: PreferenciasOperacao): PreferenciasOperacao {
  const valores: PreferenciasOperacao["valores"] = {};

  CAMPOS_FIXOS.forEach((campo) => {
    if (!preferencias.camposFixos[campo]) return;
    valores[campo] = form[campo] as never;
  });

  return { ...preferencias, valores };
}

export function SettingsPanel({
  form,
  onAbrirFormulario,
  onAplicarPadroes,
}: {
  form: FormState;
  onAbrirFormulario: () => void;
  onAplicarPadroes: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [preferencias, setPreferencias] = useState<PreferenciasOperacao>(() => carregarPreferencias());
  const ref = useRef<HTMLDivElement>(null);

  const totalFixos = useMemo(() => contarCamposFixos(preferencias), [preferencias]);

  useEffect(() => {
    if (!aberto) return;

    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", handleClickFora);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickFora);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [aberto]);

  function alternarCampo(campo: CampoFixo) {
    setPreferencias((atual) => ({
      ...atual,
      camposFixos: {
        ...atual.camposFixos,
        [campo]: !atual.camposFixos[campo],
      },
    }));
  }

  function salvar() {
    const novasPreferencias = copiarValoresSelecionados(form, preferencias);
    salvarPreferencias(novasPreferencias);
    setPreferencias(novasPreferencias);
  }

  function aplicar() {
    onAbrirFormulario();
    onAplicarPadroes();
    setAberto(false);
  }

  function limpar() {
    limparPreferencias();
    const limpas = carregarPreferencias();
    setPreferencias(limpas);
  }

  return (
    <div ref={ref} className="fixed bottom-4 left-4 z-40">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Configurações"
        title="Configurações"
        className="relative flex h-11 w-11 items-center justify-center rounded-card border border-borda bg-white text-tintaSuave shadow-lg shadow-navy/10 transition-colors hover:border-azul/30 hover:text-tinta"
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
        {totalFixos > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ciano px-1 font-mono text-[9px] font-semibold text-navy">
            {totalFixos}
          </span>
        )}
      </button>

      {aberto && (
          <aside className="absolute bottom-14 left-0 flex max-h-[calc(100vh-96px)] w-[min(calc(100vw-32px),390px)] flex-col overflow-hidden rounded-card border border-borda bg-white shadow-2xl shadow-navy/20">
            <header className="border-b border-borda bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-tintaSuave">
                    Configurações
                  </span>
                  <h2 className="mt-1 font-display text-xl font-semibold text-tinta">
                    Campos fixos
                  </h2>
                </div>
                <button
                  onClick={() => setAberto(false)}
                  aria-label="Fechar"
                  title="Fechar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card text-tintaSuave transition-colors hover:bg-papel hover:text-tinta"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <p className="mt-3 font-body text-sm leading-6 text-tintaSuave">
                Salve padrões para preencher novas operações com menos repetição.
              </p>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <label className="flex items-center justify-between gap-4 rounded-card border border-borda bg-papel px-4 py-3">
                <span>
                  <span className="block font-body text-sm font-semibold text-tinta">
                    Aplicar ao entrar
                  </span>
                  <span className="mt-0.5 block font-body text-xs text-tintaSuave">
                    Preenche automaticamente os campos fixos salvos.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={preferencias.aplicarAutomaticamente}
                  onChange={(e) =>
                    setPreferencias((atual) => ({
                      ...atual,
                      aplicarAutomaticamente: e.target.checked,
                    }))
                  }
                  className="h-5 w-5 rounded border-borda text-azul"
                />
              </label>

              <div className="mt-4 space-y-4">
                {GRUPOS.map((grupo) => (
                  <section key={grupo}>
                    <h3 className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-tintaSuave">
                      {grupo}
                    </h3>
                    <div className="space-y-2">
                      {CAMPOS_FIXOS.filter((campo) => LABELS[campo].grupo === grupo).map((campo) => (
                        <label
                          key={campo}
                          className="flex items-center justify-between gap-3 rounded-card border border-borda bg-white px-3 py-2.5 transition-colors hover:bg-papel"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-body text-sm font-medium text-tinta">
                              {LABELS[campo].titulo}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[11px] text-tintaSuave">
                              atual: {valorVisivel(form[campo])} · salvo:{" "}
                              {valorVisivel(preferencias.valores[campo])}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(preferencias.camposFixos[campo])}
                            onChange={() => alternarCampo(campo)}
                            className="h-5 w-5 shrink-0 rounded border-borda text-azul"
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <section className="mt-4 rounded-card border border-aviso/30 bg-aviso/5 p-4">
                <label className="block">
                  <span className="font-body text-xs font-semibold uppercase tracking-wide text-aviso">
                    Perfil tributário
                  </span>
                  <textarea
                    value={preferencias.perfilTributario}
                    onChange={(e) =>
                      setPreferencias((atual) => ({ ...atual, perfilTributario: e.target.value.slice(0, 400) }))
                    }
                    rows={3}
                    placeholder="Ex: validar FETHAB/ICMS com contador antes de fechar MT -> MG"
                    className="mt-2 w-full resize-none rounded-card border border-aviso/20 bg-white px-3 py-2 font-body text-sm text-tinta placeholder:text-tintaSuave/50 focus:border-aviso focus:outline-none"
                  />
                </label>
                <p className="mt-2 font-body text-[11px] leading-snug text-tintaSuave">
                  Esta anotação não altera o cálculo. Regra fiscal precisa estar cadastrada e versionada no motor.
                </p>
              </section>
            </div>

            <footer className="border-t border-borda bg-papel/70 px-4 py-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={salvar}
                  className="rounded-card bg-brand-gradient px-4 py-2.5 font-body text-sm font-semibold text-white shadow-sm shadow-azul/20 transition-opacity hover:opacity-90"
                >
                  Salvar atuais
                </button>
                <button
                  onClick={aplicar}
                  className="rounded-card border border-azul/30 bg-white px-4 py-2.5 font-body text-sm font-semibold text-azul transition-colors hover:bg-azul/5"
                >
                  Aplicar agora
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onAbrirFormulario();
                    setAberto(false);
                  }}
                  className="rounded-card border border-borda bg-white px-4 py-2.5 font-body text-sm font-semibold text-tintaSuave transition-colors hover:text-tinta"
                >
                  Ir ao formulário
                </button>
                <button
                  onClick={limpar}
                  className="rounded-card border border-risco/30 bg-white px-4 py-2.5 font-body text-sm font-semibold text-risco transition-colors hover:bg-risco/5"
                >
                  Limpar padrões
                </button>
              </div>
            </footer>
          </aside>
      )}
    </div>
  );
}
