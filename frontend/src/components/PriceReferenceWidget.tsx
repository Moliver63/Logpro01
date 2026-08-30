import { useState } from "react";
import { getReferenciaPreco } from "../api/client";
import type { ResultadoReferenciaPreco } from "../types";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PriceReferenceWidget({ produto }: { produto: string }) {
  const [resultado, setResultado] = useState<ResultadoReferenciaPreco | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function consultar() {
    setCarregando(true);
    try {
      const r = await getReferenciaPreco(produto);
      setResultado(r);
    } catch {
      setResultado({ aplicavel: false, pendencia: "Falha ao consultar a referência internacional." });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mt-2">
      {!resultado && (
        <button
          type="button"
          onClick={consultar}
          disabled={carregando}
          className="font-body text-xs font-medium text-azul underline decoration-azul/40 underline-offset-2 hover:text-azulDark disabled:opacity-50"
        >
          {carregando ? "Consultando…" : "Ver referência de preço"}
        </button>
      )}

      {resultado && !resultado.aplicavel && (
        <p className="font-body text-xs text-tintaSuave">{resultado.pendencia}</p>
      )}

      {resultado?.aplicavel && (
        <div className="rounded-card border border-borda bg-white p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-body text-xs uppercase tracking-wide text-tintaSuave">
              Referência de preço
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-tinta">
              {brl(resultado.valorPorSaca!)}/saca
            </span>
          </div>
          <p className="mt-1 font-body text-[11px] leading-snug text-tintaSuave">{resultado.fonte}</p>
        </div>
      )}
    </div>
  );
}
