import { PisoMinimoEngine } from "../engines/freight_engine/piso_minimo/index.js";
import { seedPisoMinimoRules } from "../engines/freight_engine/piso_minimo/rules.seed.js";
import type { ResultadoPisoMinimo, TabelaAntt, TipoCargaAntt } from "../types/domain.js";

export interface FreteReferenciaInput {
  quantidadeSacas?: number;
  pesoPorSacaKg?: number;
  distanciaKm?: number;
  numeroEixos?: number;
  tipoCarga?: TipoCargaAntt;
  tabela?: TabelaAntt;
}

export interface FreteReferenciaResultado {
  fonte: "ANTT";
  aplicavel: boolean;
  camposNecessarios: string[];
  pendencias: string[];
  toneladas?: number;
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

export function calcularReferenciaFreteAntt(input: FreteReferenciaInput): FreteReferenciaResultado {
  const camposNecessarios = camposFaltantes(input);
  if (camposNecessarios.length > 0) {
    return {
      fonte: "ANTT",
      aplicavel: false,
      camposNecessarios,
      pendencias: camposNecessarios.map((campo) => `Informe ${NOMES_CAMPOS[campo]}.`),
      observacao: "O piso ANTT precisa desses dados para calcular uma referência mínima.",
    };
  }

  const toneladas = round2((input.quantidadeSacas! * input.pesoPorSacaKg!) / 1000);
  const engine = new PisoMinimoEngine(seedPisoMinimoRules);
  const pisoMinimoAntt = engine.calcular({
    tipoCarga: input.tipoCarga ?? "GRANEL_SOLIDO",
    numeroEixos: input.numeroEixos!,
    distanciaKm: input.distanciaKm!,
    tabela: input.tabela ?? "A",
  });

  if (!pisoMinimoAntt.aplicavel || pisoMinimoAntt.valorPiso == null) {
    return {
      fonte: "ANTT",
      aplicavel: false,
      camposNecessarios: [],
      pendencias: [pisoMinimoAntt.pendencia ?? "Piso mínimo ANTT não disponível para esse cenário."],
      toneladas,
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
  if (input.distanciaKm == null || input.distanciaKm <= 0) faltando.push("distanciaKm");
  if (input.numeroEixos == null || input.numeroEixos < 2) faltando.push("numeroEixos");
  return faltando;
}

