import { useState } from "react";
import type { OperacaoInput, Produto } from "../../types";

export interface FormState {
  produto: Produto;
  quantidadeSacas: number | "";
  pesoPorSacaKg: number | "";
  classificacao: string;

  precoCompraPorSaca: number | "";
  municipioOrigem: string;
  estadoOrigem: string;
  fornecedor: string;

  precoVendaPorSaca: number | "";
  municipioDestino: string;
  estadoDestino: string;
  comprador: string;

  fretePorTonelada: number | "";
  pedagios: number | "";
  outrosCustosLogisticos: number | "";

  comissaoVendaPorSaca: number | "";
  comissaoOriginacaoPorSaca: number | "";
  classificadorPorSaca: number | "";
}

export const estadoInicial: FormState = {
  produto: "SOJA",
  quantidadeSacas: "",
  pesoPorSacaKg: 60,
  classificacao: "",

  precoCompraPorSaca: "",
  municipioOrigem: "",
  estadoOrigem: "",
  fornecedor: "",

  precoVendaPorSaca: "",
  municipioDestino: "",
  estadoDestino: "",
  comprador: "",

  fretePorTonelada: "",
  pedagios: "",
  outrosCustosLogisticos: "",

  comissaoVendaPorSaca: "",
  comissaoOriginacaoPorSaca: "",
  classificadorPorSaca: "",
};

export function useOperationForm() {
  const [form, setForm] = useState<FormState>(estadoInicial);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pronto =
    form.quantidadeSacas !== "" &&
    form.precoCompraPorSaca !== "" &&
    form.precoVendaPorSaca !== "" &&
    form.estadoOrigem.length === 2 &&
    form.estadoDestino.length === 2 &&
    form.municipioOrigem.trim() !== "" &&
    form.municipioDestino.trim() !== "";

  const paraOperacaoInput = (): OperacaoInput => ({
    mercadoria: {
      produto: form.produto,
      quantidadeSacas: Number(form.quantidadeSacas),
      pesoPorSacaKg: Number(form.pesoPorSacaKg || 60),
      classificacao: form.classificacao || undefined,
    },
    compra: {
      precoPorSaca: Number(form.precoCompraPorSaca),
      municipioOrigem: form.municipioOrigem,
      estadoOrigem: form.estadoOrigem.toUpperCase(),
      fornecedor: form.fornecedor || undefined,
    },
    venda: {
      precoPorSaca: Number(form.precoVendaPorSaca),
      municipioDestino: form.municipioDestino,
      estadoDestino: form.estadoDestino.toUpperCase(),
      comprador: form.comprador || undefined,
    },
    logistica: {
      fretePorTonelada: form.fretePorTonelada === "" ? undefined : Number(form.fretePorTonelada),
      pedagios: form.pedagios === "" ? undefined : Number(form.pedagios),
      outrosCustosLogisticos:
        form.outrosCustosLogisticos === "" ? undefined : Number(form.outrosCustosLogisticos),
    },
    comissao: {
      comissaoVendaPorSaca:
        form.comissaoVendaPorSaca === "" ? undefined : Number(form.comissaoVendaPorSaca),
      comissaoOriginacaoPorSaca:
        form.comissaoOriginacaoPorSaca === "" ? undefined : Number(form.comissaoOriginacaoPorSaca),
      classificadorPorSaca:
        form.classificadorPorSaca === "" ? undefined : Number(form.classificadorPorSaca),
    },
    tipoOperacao: "SOBRE_RODAS",
  });

  return { form, set, pronto, paraOperacaoInput, reset: () => setForm(estadoInicial) };
}
