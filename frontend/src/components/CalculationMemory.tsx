import { useState } from "react";
import type { ResultadoOperacao } from "../types";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const origemLabel: Record<string, string> = {
  informado_usuario: "informado por você",
  calculado_sistema: "calculado pelo sistema",
  api_externa: "obtido de API externa",
  estimado: "estimado — atenção",
};

export function CalculationMemory({ resultado }: { resultado: ResultadoOperacao }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-card border border-borda">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <span className="font-body text-sm font-medium text-tinta">Ver memória de cálculo</span>
        <span className="font-mono text-xs text-tintaSuave">{aberto ? "recolher −" : "expandir +"}</span>
      </button>

      {aberto && (
        <div className="border-t border-borda px-5 py-4">
          <section className="mb-6">
            <h4 className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-tintaSuave">
              Tributos e fundos
            </h4>
            <div className="space-y-3">
              {resultado.tributos.itens.map((item) => (
                <div key={item.regraId} className="font-mono text-[13px] leading-relaxed">
                  <div className="flex items-baseline justify-between text-tinta">
                    <span>{item.tributo}</span>
                    <span className="tabular-nums">{brl(item.valorComBeneficio)}</span>
                  </div>
                  <div className="text-tintaSuave">
                    Base: {brl(item.base)}
                    {item.aliquotaPercentual != null && ` · Alíquota: ${item.aliquotaPercentual}%`}
                    {item.beneficioAplicado && ` · Benefício: ${item.beneficioAplicado}`}
                  </div>
                  <div className="text-[11px] text-tintaSuave/80">
                    Regra {item.regraId} · v{item.versaoRegra} · fonte: {item.fonte}
                  </div>
                </div>
              ))}
              {resultado.tributos.itens.length === 0 && (
                <p className="font-body text-[13px] text-tintaSuave">
                  Nenhuma regra tributária aplicada — ver pendências acima.
                </p>
              )}
            </div>
          </section>

          <section className="mb-6">
            <h4 className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-tintaSuave">
              Frete
            </h4>
            <div className="font-mono text-[13px] text-tinta">
              R$ {resultado.frete.fretePorTonelada.toFixed(2)}/t × toneladas ={" "}
              {brl(resultado.frete.freteTotal)}
              <span className="ml-2 text-[11px] text-tintaSuave">
                ({origemLabel[resultado.frete.origemDado] ?? resultado.frete.origemDado}, provedor:{" "}
                {resultado.frete.provedor})
              </span>
            </div>
          </section>

          <section>
            <h4 className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-tintaSuave">
              Comissões e despesas
            </h4>
            <div className="space-y-1.5">
              {resultado.linhasCusto.map((l, i) => (
                <div key={i} className="flex items-baseline justify-between font-mono text-[13px] text-tinta">
                  <span>{l.descricao}</span>
                  <span className="tabular-nums">{brl(l.valorTotal)}</span>
                </div>
              ))}
              {resultado.linhasCusto.length === 0 && (
                <p className="font-body text-[13px] text-tintaSuave">Nenhuma despesa adicional informada.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
