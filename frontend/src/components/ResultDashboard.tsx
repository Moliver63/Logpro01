import type { ResultadoOperacao } from "../types";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function LinhaResultado({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 border-b border-borda/60 py-2.5 last:border-0 ${
        destaque ? "font-semibold text-tinta" : "text-tintaSuave"
      }`}
    >
      <span className="font-body text-sm">{label}</span>
      <span className="shrink-0 font-mono text-[15px] tabular-nums">{brl(valor)}</span>
    </div>
  );
}

export function ResultDashboard({ resultado }: { resultado: ResultadoOperacao }) {
  const { viavel, calculoCompleto } = resultado;

  // Viabilidade e completude são independentes: a operação pode fechar no
  // dinheiro e ainda assim ter pendências que tornam a margem otimista.
  // Mostrar os dois separadamente responde a pergunta do usuário sem
  // esconder o que falta conferir.
  const status = viavel
    ? calculoCompleto
      ? {
          texto: "Operação viável",
          cor: "border-sucesso",
          textoCor: "text-sucessoDark",
          fundo: "bg-sucesso/10 text-sucessoDark",
          aviso: "Cálculo completo para os dados informados.",
        }
      : {
          texto: "Cálculo incompleto",
          cor: "border-aviso",
          textoCor: "text-aviso",
          fundo: "bg-aviso/10 text-aviso",
          aviso: "A margem é positiva, mas ainda existem pendências de validação.",
        }
    : {
        texto: "Operação não viável",
        cor: "border-risco",
        textoCor: "text-risco",
        fundo: "bg-risco/10 text-risco",
        aviso: "O resultado não cobre os custos informados.",
      };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Status — o elemento de assinatura: ficha de pesagem/carimbo de terminal */}
      <div
        className={`overflow-hidden rounded-card border bg-white shadow-sm shadow-navy/[0.04] ${status.cor}`}
      >
        <div className="border-b border-borda bg-papel/70 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
            <span className="font-body text-xs uppercase tracking-widest text-tintaSuave">
              Resultado da operação
            </span>
            <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
              <span
                className={`break-words font-display text-3xl font-extrabold tabular-nums sm:text-4xl ${status.textoCor}`}
              >
                {brl(resultado.resultado.valor)}
              </span>
              <span className="font-mono text-sm text-tintaSuave">
                {resultado.margemPercentual.toFixed(2)}% de margem
              </span>
            </div>
            <p className="mt-2 font-body text-[13px] leading-snug text-tintaSuave">{status.aviso}</p>
          </div>
          <span
            className={`w-fit shrink-0 rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${status.fundo}`}
          >
            {status.texto}
          </span>
          </div>
        </div>

        <div className="px-5 py-4">
          <LinhaResultado label="Receita" valor={resultado.receitaTotal.valor} />
          <LinhaResultado label="Mercadoria" valor={-resultado.custoMercadoria.valor} />
          <LinhaResultado label="Frete" valor={-resultado.custoLogistico.valor} />
          <LinhaResultado label="Tributos e fundos" valor={-resultado.custoTributario.valor} />
          <LinhaResultado label="Comissões e outros custos" valor={-resultado.outrosCustos.valor} />
          <div className="border-t border-navy/10 pt-1" />
          <LinhaResultado label="Custo total" valor={-resultado.custoTotal.valor} destaque />
          <LinhaResultado label="Resultado" valor={resultado.resultado.valor} destaque />
        </div>
      </div>

      {/* Métricas complementares */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard label="Resultado / saca" valor={brl(resultado.resultadoPorSaca)} />
          <MetricCard label="Resultado / tonelada" valor={brl(resultado.resultadoPorTonelada)} />
          <MetricCard label="Preço mínimo de venda / saca" valor={brl(resultado.precoMinimoVendaPorSaca)} />
          <MetricCard label="Frete aplicado / tonelada" valor={brl(resultado.frete.fretePorTonelada)} />
        </div>

        {resultado.pendenciasOperacionais.length > 0 && (
          <div className="rounded-card border border-aviso/30 bg-aviso/5 p-4">
            <span className="font-body text-xs font-semibold uppercase tracking-wide text-aviso">
              Pendências operacionais
            </span>
            {resultado.pendenciasTributarias.length > 0 && (
              <p className="mt-2 font-body text-[13px] leading-snug text-tinta">
                Há tributos sem regra cadastrada. Eles entraram no cálculo como
                R$ 0,00 por falta de cadastro, não por isenção — a margem acima
                está mais alta do que a real.
              </p>
            )}
            <ul className="mt-2 space-y-1.5">
              {resultado.pendenciasOperacionais.map((p, i) => (
                <li key={i} className="border-l-2 border-aviso/30 pl-3 font-body text-[13px] leading-snug text-tinta">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        <PisoMinimoCard piso={resultado.pisoMinimoAntt} />
      </div>
    </div>
  );
}

function PisoMinimoCard({ piso }: { piso: ResultadoOperacao["pisoMinimoAntt"] }) {
  if (!piso.aplicavel) {
    return (
      <div className="rounded-card border border-borda bg-white p-4">
        <span className="block font-body text-xs font-semibold uppercase tracking-wide text-tintaSuave">
          Piso mínimo ANTT
        </span>
        <p className="mt-2 font-body text-[13px] leading-snug text-tintaSuave">{piso.pendencia}</p>
      </div>
    );
  }

  const abaixo = piso.freteInformadoAbaixoDoPiso;
  return (
    <div
      className={`rounded-card border p-4 ${
        abaixo ? "border-risco/40 bg-risco/5" : "border-borda bg-white"
      }`}
    >
      <span className="block font-body text-xs font-semibold uppercase tracking-wide text-tintaSuave">
        Piso mínimo ANTT (Lei 13.703/2018)
      </span>
      <span className="mt-1 block font-mono text-lg tabular-nums text-tinta">{brl(piso.valorPiso!)}</span>
      {abaixo && (
        <p className="mt-1 font-body text-[13px] font-medium text-risco">
          O frete informado está abaixo do piso legal.
        </p>
      )}
      <p className="mt-2 font-body text-[11px] text-tintaSuave">{piso.fonte}</p>
    </div>
  );
}

function MetricCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-card border border-borda bg-white p-4 shadow-sm shadow-navy/[0.03]">
      <span className="block font-body text-xs uppercase tracking-wide text-tintaSuave">{label}</span>
      <span className="mt-1 block break-words font-mono text-lg tabular-nums text-tinta">{valor}</span>
    </div>
  );
}
