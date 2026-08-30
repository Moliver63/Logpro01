import { useState } from "react";
import type { Cenario, ResultadoCenario } from "../types";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  base: { precoCompraPorSaca: number; precoVendaPorSaca: number; fretePorTonelada: number };
  onSimular: (cenarios: Cenario[]) => Promise<void>;
  resultados: ResultadoCenario[] | null;
  melhorCenario: string | null;
  carregando: boolean;
}

function gerarVariações(base: Props["base"]): Cenario[] {
  return [
    { nome: "A — informado", ...base },
    {
      nome: "B — compra -3% / venda +2%",
      precoCompraPorSaca: round(base.precoCompraPorSaca * 0.97),
      precoVendaPorSaca: round(base.precoVendaPorSaca * 1.02),
      fretePorTonelada: base.fretePorTonelada,
    },
    {
      nome: "C — frete -8%",
      precoCompraPorSaca: base.precoCompraPorSaca,
      precoVendaPorSaca: base.precoVendaPorSaca,
      fretePorTonelada: round(base.fretePorTonelada * 0.92),
    },
  ];
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function ScenarioSimulator({ base, onSimular, resultados, melhorCenario, carregando }: Props) {
  const [cenarios] = useState<Cenario[]>(() => gerarVariações(base));

  return (
    <div className="rounded-card border border-borda bg-white p-5 shadow-sm shadow-navy/[0.03]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-medium text-tinta">Simulador de cenários</h3>
        <button
          onClick={() => onSimular(cenarios)}
          disabled={carregando}
          className="rounded-card bg-brand-gradient px-4 py-2 font-body text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {carregando ? "Simulando…" : "Simular variações"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cenarios.map((c) => {
          const r = resultados?.find((x) => x.nome === c.nome);
          const ehMelhor = melhorCenario === c.nome;
          return (
            <div
              key={c.nome}
              className={`rounded-card border p-4 ${
                ehMelhor ? "border-azul bg-azul/[0.06]" : "border-borda bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-body text-xs font-medium text-tintaSuave">{c.nome}</span>
                {ehMelhor && (
                  <span className="rounded-card bg-azul px-2 py-0.5 font-mono text-[10px] uppercase text-white">
                    melhor
                  </span>
                )}
              </div>
              <dl className="mt-2 space-y-1 font-mono text-xs text-tinta">
                <div className="flex justify-between">
                  <dt className="text-tintaSuave">Compra/saca</dt>
                  <dd>{brl(c.precoCompraPorSaca)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tintaSuave">Venda/saca</dt>
                  <dd>{brl(c.precoVendaPorSaca)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tintaSuave">Frete/t</dt>
                  <dd>{brl(c.fretePorTonelada)}</dd>
                </div>
              </dl>
              {r && (
                <div className="mt-3 border-t border-borda pt-2">
                  <div className="flex justify-between font-mono text-sm font-semibold text-tinta">
                    <span>Margem</span>
                    <span>{r.margemPercentual.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs text-tintaSuave">
                    <span>Resultado</span>
                    <span>{brl(r.resultado)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
