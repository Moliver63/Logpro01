import { abrirPdf, exportarCsv, exportarExcel } from "../exportacao";
import type { OperacaoInput, ResultadoOperacao } from "../types";

export function ExportActions({
  resultado,
  operacao,
}: {
  resultado: ResultadoOperacao;
  operacao?: OperacaoInput;
}) {
  return (
    <div className="rounded-card border border-borda bg-white p-4 shadow-sm shadow-navy/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="font-body text-xs font-semibold uppercase tracking-wide text-tintaSuave">
            Enviar cotação
          </span>
          <p className="mt-1 font-body text-sm text-tintaSuave">
            Gere um arquivo para compartilhar ou manipular em planilha.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => abrirPdf(resultado, operacao)}
            className="rounded-card border border-borda bg-papel px-3 py-2 font-body text-xs font-semibold text-tinta transition-colors hover:border-azul/30 hover:bg-white"
          >
            PDF
          </button>
          <button
            onClick={() => exportarExcel(resultado, operacao)}
            className="rounded-card border border-borda bg-papel px-3 py-2 font-body text-xs font-semibold text-tinta transition-colors hover:border-azul/30 hover:bg-white"
          >
            Excel
          </button>
          <button
            onClick={() => exportarCsv(resultado, operacao)}
            className="rounded-card border border-borda bg-papel px-3 py-2 font-body text-xs font-semibold text-tinta transition-colors hover:border-azul/30 hover:bg-white"
          >
            CSV
          </button>
        </div>
      </div>
    </div>
  );
}
