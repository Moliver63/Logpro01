import { PisoMinimoEngine } from "../engines/freight_engine/piso_minimo/index.js";
import { seedPisoMinimoRules } from "../engines/freight_engine/piso_minimo/rules.seed.js";
import { calcularDistanciaRodoviaria, type PontoRota } from "./distanciaService.js";
import type { ResultadoPisoMinimo, TabelaAntt, TipoCargaAntt } from "../types/domain.js";

export interface FreteReferenciaInput {
  quantidadeSacas?: number;
  pesoPorSacaKg?: number;
  distanciaKm?: number;
  numeroEixos?: number;
  tipoCarga?: TipoCargaAntt;
  tabela?: TabelaAntt;
  /** Quando a distância não é informada, ela é calculada via OpenStreetMap/OSRM. */
  origem?: PontoRota;
  destino?: PontoRota;
}

export interface DistanciaCalculada {
  km: number;
  origemDado: "api_externa";
  provedor: string;
  atribuicao: string;
}

export interface FreteReferenciaResultado {
  fonte: "ANTT";
  aplicavel: boolean;
  camposNecessarios: string[];
  pendencias: string[];
  toneladas?: number;
  distancia?: DistanciaCalculada;
  freteMinimoTotal?: number;
  freteMinimoPorTonelada?: number;
  pisoMinimoAntt?: ResultadoPisoMinimo;
  observacao: string;
}

const NOMES_CAMPOS: Record<string, string> = {
  quantidadeSacas: "quantidade de sacas",
  pesoPorSacaKg: "peso por saca",
  distanciaKm: "distância da rota",
  numeroEixos: "número de eixos",
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function calcularReferenciaFreteAntt(
  input: FreteReferenciaInput
): Promise<FreteReferenciaResultado> {
  const camposNecessarios = camposFaltantes(input);
  if (camposNecessarios.length > 0) {
    return {
      fonte: "ANTT",
      aplicavel: false,
      camposNecessarios,
      pendencias: camposNecessarios.map((campo) =>
        campo === "distanciaKm"
          ? "Informe a distância da rota ou a origem e o destino para calculá-la."
          : `Informe ${NOMES_CAMPOS[campo]}.`
      ),
      observacao: "O piso ANTT precisa desses dados para calcular uma referência mínima.",
    };
  }

  // Distância não informada: calcula a rota rodoviária real entre os
  // municípios (OpenStreetMap/OSRM, fonte gratuita), marcada api_externa.
  // Se a consulta falhar, pendência explícita — nunca distância estimada.
  let distanciaKm = input.distanciaKm!;
  let distancia: DistanciaCalculada | undefined;
  if (!(distanciaKm > 0)) {
    const calculada = await calcularDistanciaRodoviaria(input.origem!, input.destino!);
    if (!calculada.ok) {
      return {
        fonte: "ANTT",
        aplicavel: false,
        camposNecessarios: ["distanciaKm"],
        pendencias: [
          `Não foi possível calcular a distância entre ${input.origem!.municipio}/${input.origem!.uf} e ${input.destino!.municipio}/${input.destino!.uf} automaticamente (${calculada.motivo}). Informe a distância da rota.`,
        ],
        observacao: "O piso ANTT precisa da distância para calcular uma referência mínima.",
      };
    }
    distanciaKm = calculada.distanciaKm;
    distancia = {
      km: calculada.distanciaKm,
      origemDado: calculada.origemDado,
      provedor: calculada.provedor,
      atribuicao: calculada.atribuicao,
    };
  }

  const toneladas = round2((input.quantidadeSacas! * input.pesoPorSacaKg!) / 1000);
  const engine = new PisoMinimoEngine(seedPisoMinimoRules);
  const pisoMinimoAntt = engine.calcular({
    tipoCarga: input.tipoCarga ?? "GRANEL_SOLIDO",
    numeroEixos: input.numeroEixos!,
    distanciaKm,
    tabela: input.tabela ?? "A",
    origemDistancia: distancia ? "api_externa" : "informado_usuario",
  });

  if (!pisoMinimoAntt.aplicavel || pisoMinimoAntt.valorPiso == null) {
    return {
      fonte: "ANTT",
      aplicavel: false,
      camposNecessarios: [],
      pendencias: [pisoMinimoAntt.pendencia ?? "Piso mínimo ANTT não disponível para esse cenário."],
      toneladas,
      distancia,
      pisoMinimoAntt,
      observacao: "A referência não foi aplicada porque não há coeficiente vigente cadastrado.",
    };
  }

  return {
    fonte: "ANTT",
    aplicavel: true,
    camposNecessarios: [],
    pendencias: [],
    toneladas,
    distancia,
    freteMinimoTotal: pisoMinimoAntt.valorPiso,
    freteMinimoPorTonelada: round2(pisoMinimoAntt.valorPiso / toneladas),
    pisoMinimoAntt,
    observacao: "Referência legal mínima. Não substitui cotação real de transportadora.",
  };
}

function camposFaltantes(input: FreteReferenciaInput): string[] {
  const faltando: string[] = [];
  if (input.quantidadeSacas == null || input.quantidadeSacas <= 0) faltando.push("quantidadeSacas");
  if (input.pesoPorSacaKg == null || input.pesoPorSacaKg <= 0) faltando.push("pesoPorSacaKg");
  const temDistancia = input.distanciaKm != null && input.distanciaKm > 0;
  const temRota = Boolean(input.origem?.municipio && input.origem?.uf && input.destino?.municipio && input.destino?.uf);
  if (!temDistancia && !temRota) faltando.push("distanciaKm");
  if (input.numeroEixos == null || input.numeroEixos < 2) faltando.push("numeroEixos");
  return faltando;
}
