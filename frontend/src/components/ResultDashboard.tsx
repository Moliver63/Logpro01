import type { ResultadoOperacao } from "../types";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function LinhaResultado({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between py-2 ${
        destaque ? "font-semibold text-tinta" : "text-tintaSuave"
      }`}
    >
      <span className="font-body text-sm">{label}</span>
      <span className="font-mono text-[15px] tabular-nums">{brl(valor)}</span>
    </div>
  );
}

export function ResultDashboard({ resultado }: { resultado: ResultadoOperacao }) {
  const { viavel } = resultado;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Status — o elemento de assinatura: ficha de pesagem/carimbo de terminal */}
      <div
        className={`rounded-card border-2 p-6 ${
          viavel ? "border-soja bg-soja/[0.06]" : "border-alerta bg-alerta/[0.06]"
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="font-body text-xs uppercase tracking-widest text-tintaSuave">
              Resultado da operação
            </span>
            <div className="mt-1 flex items-baseline gap-3">
              <span
                className={`font-display text-4xl font-semibold tabular-nums ${
                  viavel ? "text-sojaDark" : "text-alerta"
                }`}
              >
                {brl(resultado.resultado.valor)}
              </span>
              <span className="font-mono text-sm text-tintaSuave">
                {resultado.margemPercentual.toFixed(2)}% de margem
              </span>
            </div>
          </div>
          <span
            className={`rounded-card border px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider ${
              viavel
                ? "border-soja bg-soja text-ledger"
                : "border-alerta bg-alerta text-ledger"
            }`}
          >
            {viavel ? "Operação viável" : "Operação não viável"}
          </span>
        </div>

        <div className="ledger-rule mt-6 divide-y divide-transparent">
          <LinhaResultado label="Receita" valor={resultado.receitaTotal.valor} />
          <LinhaResultado label="Mercadoria" valor={-resultado.custoMercadoria.valor} />
          <LinhaResultado label="Frete" valor={-resultado.custoLogistico.valor} />
          <LinhaResultado label="Tributos e fundos" valor={-resultado.custoTributario.valor} />
          <LinhaResultado label="Comissões e outros custos" valor={-resultado.outrosCustos.valor} />
          <div className="border-t border-ledgerLine" />
          <LinhaResultado label="Custo total" valor={-resultado.custoTotal.valor} destaque />
          <LinhaResultado label="Resultado" valor={resultado.resultado.valor} destaque />
        </div>
      </div>

      {/* Métricas complementares */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <MetricCard label="Resultado / saca" valor={brl(resultado.resultadoPorSaca)} />
          <MetricCard label="Resultado / tonelada" valor={brl(resultado.resultadoPorTonelada)} />
          <MetricCard label="Preço mínimo de venda / saca" valor={brl(resultado.precoMinimoVendaPorSaca)} />
          <MetricCard label="Frete aplicado / tonelada" valor={brl(resultado.frete.fretePorTonelada)} />
        </div>

        {resultado.pendenciasTributarias.length > 0 && (
          <div className="rounded-card border border-grao bg-grao/10 p-4">
            <span className="font-body text-xs font-semibold uppercase tracking-wide text-graoDark">
              Pendências tributárias
            </span>
            <ul className="mt-2 space-y-1.5">
              {resultado.pendenciasTributarias.map((p, i) => (
                <li key={i} className="font-body text-[13px] leading-snug text-tinta">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-card border border-ledgerLine bg-[#F8F6EE] p-4">
      <span className="block font-body text-xs uppercase tracking-wide text-tintaSuave">{label}</span>
      <span className="mt-1 block font-mono text-lg tabular-nums text-tinta">{valor}</span>
    </div>
  );
}
