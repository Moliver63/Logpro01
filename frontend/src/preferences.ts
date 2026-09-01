import type { FormState } from "./components/OperationForm/useOperationForm";

const STORAGE_KEY = "logpro.preferenciasOperacao.v1";

export const CAMPOS_FIXOS = [
  "produto",
  "pesoPorSacaKg",
  "precoCompraPorSaca",
  "precoVendaPorSaca",
  "fretePorTonelada",
  "distanciaKm",
  "numeroEixos",
  "pedagios",
  "outrosCustosLogisticos",
  "comissaoVendaPorSaca",
  "comissaoOriginacaoPorSaca",
  "classificadorPorSaca",
] as const satisfies readonly (keyof FormState)[];

export type CampoFixo = (typeof CAMPOS_FIXOS)[number];

export interface PreferenciasOperacao {
  aplicarAutomaticamente: boolean;
  camposFixos: Partial<Record<CampoFixo, boolean>>;
  valores: Partial<Pick<FormState, CampoFixo>>;
  perfilTributario: string;
}

export const preferenciasIniciais: PreferenciasOperacao = {
  aplicarAutomaticamente: true,
  camposFixos: {},
  valores: {},
  perfilTributario: "",
};

function normalizarPreferencias(valor: unknown): PreferenciasOperacao {
  if (!valor || typeof valor !== "object") return preferenciasIniciais;
  const bruto = valor as Partial<PreferenciasOperacao>;

  return {
    aplicarAutomaticamente: bruto.aplicarAutomaticamente !== false,
    camposFixos: bruto.camposFixos ?? {},
    valores: bruto.valores ?? {},
    perfilTributario: typeof bruto.perfilTributario === "string" ? bruto.perfilTributario : "",
  };
}

export function carregarPreferencias(): PreferenciasOperacao {
  if (typeof window === "undefined") return preferenciasIniciais;

  try {
    const salvo = window.localStorage.getItem(STORAGE_KEY);
    return salvo ? normalizarPreferencias(JSON.parse(salvo)) : preferenciasIniciais;
  } catch {
    return preferenciasIniciais;
  }
}

export function salvarPreferencias(preferencias: PreferenciasOperacao) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferencias));
}

export function limparPreferencias() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function aplicarPreferencias(form: FormState, preferencias: PreferenciasOperacao): FormState {
  const proximo = { ...form };

  CAMPOS_FIXOS.forEach((campo) => {
    if (!preferencias.camposFixos[campo]) return;
    const valor = preferencias.valores[campo];
    if (valor === undefined || valor === "") return;
    proximo[campo] = valor as never;
  });

  return proximo;
}

export function contarCamposFixos(preferencias: PreferenciasOperacao): number {
  return CAMPOS_FIXOS.filter((campo) => preferencias.camposFixos[campo]).length;
}
