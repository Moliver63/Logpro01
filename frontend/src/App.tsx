import { useState, useEffect } from "react";
import { OperationForm } from "./components/OperationForm";
import { useOperationForm } from "./components/OperationForm/useOperationForm";
import { ResultDashboard } from "./components/ResultDashboard";
import { CalculationMemory } from "./components/CalculationMemory";
import { ScenarioSimulator } from "./components/ScenarioSimulator";
import { ChatAssistant } from "./components/ChatAssistant";
import { ExportActions } from "./components/ExportActions";
import { LoginScreen } from "./components/LoginScreen";
import { HistoricoSidebar } from "./components/HistoricoSidebar";
import { AdminPanel } from "./components/AdminPanel";
import { calcularOperacao, simularCenarios, getSessao, type Usuario } from "./api/client";
import type { ResultadoOperacao, ResultadoCenario, Cenario, OperacaoInput } from "./types";

type ModoEntrada = "formulario" | "chat";
type Secao = "calculo" | "admin";

export default function App() {
  const { form, set, pronto, paraOperacaoInput, aplicarPadroesSalvos } = useOperationForm();
  const [modo, setModo] = useState<ModoEntrada>("chat");
  const [secao, setSecao] = useState<Secao>("calculo");

  // Sessão: `undefined` enquanto verifica, `null` quando deslogado.
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  // Contador que força o histórico a recarregar após um cálculo novo.
  const [versaoHistorico, setVersaoHistorico] = useState(0);

  const erroLogin = new URLSearchParams(window.location.search).get("erro_login");

  useEffect(() => {
    getSessao()
      .then((s) => setUsuario(s.usuario))
      .catch(() => setUsuario(null));
  }, []);

  const [resultado, setResultado] = useState<ResultadoOperacao | null>(null);
  const [operacaoResultado, setOperacaoResultado] = useState<OperacaoInput | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [cenariosResultado, setCenariosResultado] = useState<ResultadoCenario[] | null>(null);
  const [melhorCenario, setMelhorCenario] = useState<string | null>(null);
  const [simulando, setSimulando] = useState(false);

  async function handleCalcular() {
    setErro(null);
    setCalculando(true);
    setCenariosResultado(null);
    try {
      const input = paraOperacaoInput();
      const { resultado: r } = await calcularOperacao(input);
      setResultado(r);
      setOperacaoResultado(input);
      // A consulta acabou de ser salva: atualiza o histórico da barra lateral.
      setVersaoHistorico((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao calcular a operação.");
    } finally {
      setCalculando(false);
    }
  }

  async function handleSimular(cenarios: Cenario[]) {
    setSimulando(true);
    try {
      const { cenarios: r, melhorCenario: m } = await simularCenarios(paraOperacaoInput(), cenarios);
      setCenariosResultado(r);
      setMelhorCenario(m);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao simular cenários.");
    } finally {
      setSimulando(false);
    }
  }

  // Enquanto verifica a sessão, evita piscar a tela de login para quem já
  // está autenticado.
  if (usuario === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-gradient">
        <div className="rounded-card border border-borda bg-white px-5 py-4 shadow-sm">
          <span className="font-body text-sm text-tintaSuave">Carregando...</span>
        </div>
      </div>
    );
  }

  if (usuario === null) {
    return <LoginScreen erro={erroLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-surface-gradient">
      <HistoricoSidebar
        recarregar={versaoHistorico}
        usuario={usuario}
        emAdmin={secao === "admin"}
        form={form}
        onAbrirFormulario={() => {
          setSecao("calculo");
          setModo("formulario");
        }}
        onAplicarPadroes={aplicarPadroesSalvos}
        onIrParaAdmin={() => setSecao("admin")}
        onVoltarAoCalculo={() => setSecao("calculo")}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-borda/80 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-6">
            <span className="font-mono text-[11px] uppercase tracking-widest text-tintaSuave">
              Motor de viabilidade
            </span>
            <button
              onClick={() => {
                setSecao("calculo");
                setModo("chat");
              }}
              className="rounded-card border border-borda bg-white px-3 py-2 font-body text-xs font-semibold text-tintaSuave shadow-sm transition-colors hover:border-azul/30 hover:text-tinta"
            >
              Nova consulta
            </button>
          </div>
        </header>

        {secao === "admin" ? (
          <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-6">
            <AdminPanel meuId={usuario.id} />
          </main>
        ) : (
          <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-6 lg:py-10">
            <div className="mb-7 flex flex-col gap-4 border-b border-borda/80 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="font-mono text-xs uppercase tracking-wide text-tintaSuave">
                  01 / Nova operação
                </span>
                <h1 className="mt-2 font-display text-3xl font-semibold text-tinta sm:text-4xl">
                  Essa operação fecha ou não fecha?
                </h1>
                <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-tintaSuave">
                  Converse com o assistente ou use o formulário para montar a operação, calcular margem e enxergar pendências antes de decidir.
                </p>
              </div>
              {modo === "formulario" && (
                <button
                  onClick={() => setModo("chat")}
                  className="flex shrink-0 items-center gap-1.5 rounded-card border border-borda bg-white px-3 py-2 font-body text-xs font-semibold text-tintaSuave shadow-sm transition-colors hover:border-azul/30 hover:text-tinta"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                    <path
                      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Voltar ao chat
                </button>
              )}
            </div>

            {modo === "chat" ? (
              <ChatAssistant onConsultaRegistrada={() => setVersaoHistorico((v) => v + 1)} />
            ) : (
              <>
                <OperationForm form={form} set={set} />

                <div className="mt-6 flex flex-col gap-3 rounded-card border border-borda/80 bg-white p-4 shadow-sm shadow-navy/[0.03] sm:flex-row sm:items-center">
                  <button
                    onClick={handleCalcular}
                    disabled={!pronto || calculando}
                    className="rounded-card bg-brand-gradient px-6 py-3 font-body text-sm font-semibold uppercase tracking-wide text-white shadow-sm shadow-azul/30 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {calculando ? "Calculando..." : "Calcular viabilidade"}
                  </button>
                  {!pronto && (
                    <span className="font-body text-xs leading-snug text-tintaSuave">
                      Preencha sacas, preços, origem, destino e frete para calcular.
                    </span>
                  )}
                  {erro && <span className="font-body text-xs text-risco">{erro}</span>}
                </div>

                {resultado && (
                  <div className="mt-12 space-y-6">
                    <div className="border-b border-borda/80 pb-4">
                      <span className="font-mono text-xs uppercase tracking-wide text-tintaSuave">
                        02 / Resultado
                      </span>
                      <h2 className="mt-1 font-display text-2xl font-semibold text-tinta">
                        Dashboard da operação
                      </h2>
                    </div>

                    <ResultDashboard resultado={resultado} />
                    <ExportActions resultado={resultado} operacao={operacaoResultado ?? undefined} />
                    <CalculationMemory resultado={resultado} />

                    <div className="border-b border-borda/80 pb-4">
                      <span className="font-mono text-xs uppercase tracking-wide text-tintaSuave">
                        03 / Simulação
                      </span>
                      <h2 className="mt-1 font-display text-2xl font-semibold text-tinta">
                        Qual combinação gera a melhor margem?
                      </h2>
                    </div>
                    <ScenarioSimulator
                      base={{
                        precoCompraPorSaca: Number(form.precoCompraPorSaca),
                        precoVendaPorSaca: Number(form.precoVendaPorSaca),
                        fretePorTonelada: Number(form.fretePorTonelada),
                      }}
                      onSimular={handleSimular}
                      resultados={cenariosResultado}
                      melhorCenario={melhorCenario}
                      carregando={simulando}
                    />
                  </div>
                )}
              </>
            )}
          </main>
        )}

        <footer className="border-t border-borda bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="font-body text-xs text-tintaSuave">
              As regras tributárias usadas na memória de cálculo ainda precisam ser conferidas com um
              especialista antes de fechar operações com elas.
            </p>
            <p className="whitespace-nowrap font-body text-xs text-tintaSuave">
              © {new Date().getFullYear()} LogPro · Michel Leal — Lab Quântico de Software
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
