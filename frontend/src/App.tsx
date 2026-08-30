import { useState } from "react";
import { OperationForm } from "./components/OperationForm";
import { useOperationForm } from "./components/OperationForm/useOperationForm";
import { ResultDashboard } from "./components/ResultDashboard";
import { CalculationMemory } from "./components/CalculationMemory";
import { ScenarioSimulator } from "./components/ScenarioSimulator";
import { calcularOperacao, simularCenarios } from "./api/client";
import type { ResultadoOperacao, ResultadoCenario, Cenario } from "./types";

export default function App() {
  const { form, set, pronto, paraOperacaoInput } = useOperationForm();

  const [resultado, setResultado] = useState<ResultadoOperacao | null>(null);
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
      const { resultado: r } = await calcularOperacao(paraOperacaoInput());
      setResultado(r);
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

  return (
    <div className="min-h-screen bg-papel">
      <header className="border-b border-navySoft bg-navy">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="LogPro" className="h-11 w-11" />
            <div className="flex flex-col">
              <span className="font-display text-xl font-extrabold leading-none tracking-tight text-white">
                Log<span className="text-ciano">Pro</span>
              </span>
              <span className="mt-1 font-body text-[11px] uppercase tracking-widest text-white/50">
                Gestão logística inteligente
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <span className="font-mono text-xs text-tintaSuave">01 / Nova operação</span>
          <h1 className="mt-1 font-display text-3xl font-medium text-tinta">
            Essa operação fecha ou não fecha?
          </h1>
        </div>

        <OperationForm form={form} set={set} />

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleCalcular}
            disabled={!pronto || calculando}
            className="rounded-card bg-brand-gradient px-6 py-3 font-body text-sm font-semibold uppercase tracking-wide text-white shadow-sm shadow-azul/30 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {calculando ? "Calculando…" : "Calcular viabilidade"}
          </button>
          {!pronto && (
            <span className="font-body text-xs text-tintaSuave">
              Preencha sacas, preços, origem e destino para calcular.
            </span>
          )}
          {erro && <span className="font-body text-xs text-risco">{erro}</span>}
        </div>

        {resultado && (
          <div className="mt-12 space-y-6">
            <div>
              <span className="font-mono text-xs text-tintaSuave">02 / Resultado</span>
              <h2 className="mt-1 font-display text-2xl font-medium text-tinta">Dashboard da operação</h2>
            </div>

            <ResultDashboard resultado={resultado} />
            <CalculationMemory resultado={resultado} />

            <div>
              <span className="font-mono text-xs text-tintaSuave">03 / Simulação</span>
              <h2 className="mt-1 font-display text-2xl font-medium text-tinta">
                Qual combinação gera a melhor margem?
              </h2>
            </div>
            <ScenarioSimulator
              base={{
                precoCompraPorSaca: Number(form.precoCompraPorSaca),
                precoVendaPorSaca: Number(form.precoVendaPorSaca),
                fretePorTonelada: Number(form.fretePorTonelada || 0),
              }}
              onSimular={handleSimular}
              resultados={cenariosResultado}
              melhorCenario={melhorCenario}
              carregando={simulando}
            />
          </div>
        )}
      </main>

      <footer className="mt-16 border-t border-borda py-6">
        <p className="mx-auto max-w-6xl px-6 font-body text-xs text-tintaSuave">
          LogPro MVP — motor de decisão comercial, não uma calculadora de impostos. Regras tributárias
          exibidas na memória de cálculo são de referência e requerem validação de especialista antes de
          uso comercial.
        </p>
      </footer>
    </div>
  );
}
