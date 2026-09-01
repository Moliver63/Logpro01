import { useState } from "react";
import { calcularReferenciaFreteAntt } from "../api/client";
import type { ResultadoReferenciaFreteAntt } from "../types";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface PontoRota {
  municipio: string;
  uf: string;
}

interface Props {
  quantidadeSacas: number | "";
  pesoPorSacaKg: number | "";
  distanciaKm: number | "";
  numeroEixos: number | "";
  origem?: PontoRota;
  destino?: PontoRota;
  onUsarFrete: (valor: number) => void;
}

export function FreightReferenceWidget({
  quantidadeSacas,
  pesoPorSacaKg,
  distanciaKm,
  numeroEixos,
  origem,
  destino,
  onUsarFrete,
}: Props) {
  const [resultado, setResultado] = useState<ResultadoReferenciaFreteAntt | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function consultar() {
    setCarregando(true);
    setErro(null);
    try {
      const distanciaInformada = distanciaKm !== "" && Number(distanciaKm) > 0;
      const resposta = await calcularReferenciaFreteAntt({
        quantidadeSacas: quantidadeSacas === "" ? undefined : Number(quantidadeSacas),
        pesoPorSacaKg: pesoPorSacaKg === "" ? undefined : Number(pesoPorSacaKg),
        distanciaKm: distanciaInformada ? Number(distanciaKm) : undefined,
        numeroEixos: numeroEixos === "" ? undefined : Number(numeroEixos),
        // Sem distância digitada, o servidor calcula a rota real (OpenStreetMap/OSRM).
        origem: !distanciaInformada && origem?.municipio && origem?.uf ? origem : undefined,
        destino: !distanciaInformada && destino?.municipio && destino?.uf ? destino : undefined,
      });
      setResultado(resposta);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao consultar referência de frete.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="col-span-2 rounded-card border border-ciano/30 bg-ciano/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="block font-body text-xs font-semibold uppercase tracking-wide text-azulDark">
            Referência ANTT
          </span>
          <span className="mt-1 block font-body text-xs text-tintaSuave">
            Piso mínimo legal, não cotação de mercado. Sem distância digitada, ela é calculada pela
            rota entre origem e destino.
          </span>
        </div>
        <button
          type="button"
          onClick={consultar}
          disabled={carregando}
          className="rounded-card border border-azul/30 bg-white px-3 py-2 font-body text-xs font-semibold text-azul transition-colors hover:bg-ciano/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {carregando ? "Consultando..." : "Consultar piso"}
        </button>
      </div>

      {erro && <p className="mt-2 font-body text-xs text-risco">{erro}</p>}

      {resultado && (
        <div className="mt-3 space-y-2">
          {resultado.aplicavel && resultado.freteMinimoPorTonelada != null ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="block font-mono text-sm text-tinta">
                  {brl(resultado.freteMinimoPorTonelada)}/t
                </span>
                {resultado.freteMinimoTotal != null && (
                  <span className="block font-body text-xs text-tintaSuave">
                    Total mínimo: {brl(resultado.freteMinimoTotal)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onUsarFrete(resultado.freteMinimoPorTonelada!)}
                className="rounded-card bg-azul px-3 py-2 font-body text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                Usar no frete
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {resultado.pendencias.map((p, i) => (
                <li key={i} className="font-body text-xs leading-snug text-tinta">
                  {p}
                </li>
              ))}
            </ul>
          )}
          <p className="font-body text-[11px] leading-snug text-tintaSuave">{resultado.observacao}</p>
          {resultado.distancia && (
            <p className="font-body text-[11px] leading-snug text-tintaSuave">
              Distância da rota: {resultado.distancia.km.toLocaleString("pt-BR")} km (
              {resultado.distancia.provedor})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
