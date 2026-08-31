import type { RegraTributaria } from "../../types/domain.js";

/**
 * ATENÇÃO — LEIA ANTES DE USAR EM PRODUÇÃO
 *
 * Estas regras foram extraídas literalmente das duas planilhas de referência
 * fornecidas (operação Alto Taquari-MT → Rancharia-SP, soja; e operação
 * Campo Verde-MT → Terminal Rondonópolis, milho). Elas representam valores
 * de UMA operação específica em UM período específico (julho), não uma
 * tabela tributária oficial e validada.
 *
 * Por princípio do tax_engine: nenhuma regra aqui deve ser tratada como
 * verdade legal. Cada `fonte` abaixo está marcada como "planilha_referencia"
 * exatamente para deixar isso rastreável. Antes de cobrar qualquer cliente
 * com base nesses números, validar com um especialista tributário/contábil
 * — este é o pendency explícito do item 16.10 do prompt de especificação.
 */

const VIGENCIA_REFERENCIA = "2024-01-01";

export const seedTaxRules: RegraTributaria[] = [
  // ---- Operação de referência 1: Alto Taquari-MT -> Rancharia-SP, SOJA ----
  {
    id: "MT-SP-SOJA-ICMS-v1",
    nome: "ICMS — operação SOJA MT→SP (referência)",
    tributo: "ICMS",
    estadoOrigem: "MT",
    estadoDestino: "SP",
    produto: "SOJA",
    tipoOperacao: "SOBRE_RODAS",
    valorFixoPorSaca: 1.4,
    baseDeCalculo: "VALOR_POR_SACA",
    vigenciaInicio: VIGENCIA_REFERENCIA,
    fonte: "planilha_referencia:Precificacao_Agricola.xlsx",
    versao: 1,
    ativo: true,
  },
  {
    id: "MT-SP-SOJA-PIS-v1",
    nome: "PIS — operação SOJA MT→SP (referência)",
    tributo: "PIS",
    estadoOrigem: "MT",
    estadoDestino: "SP",
    produto: "SOJA",
    tipoOperacao: "SOBRE_RODAS",
    valorFixoPorSaca: 1.155,
    baseDeCalculo: "VALOR_POR_SACA",
    vigenciaInicio: VIGENCIA_REFERENCIA,
    fonte: "planilha_referencia:Precificacao_Agricola.xlsx",
    versao: 1,
    ativo: true,
  },
  {
    id: "MT-SP-SOJA-COFINS-v1",
    nome: "COFINS — operação SOJA MT→SP (referência)",
    tributo: "COFINS",
    estadoOrigem: "MT",
    estadoDestino: "SP",
    produto: "SOJA",
    tipoOperacao: "SOBRE_RODAS",
    valorFixoPorSaca: 5.32,
    baseDeCalculo: "VALOR_POR_SACA",
    vigenciaInicio: VIGENCIA_REFERENCIA,
    fonte: "planilha_referencia:Precificacao_Agricola.xlsx",
    versao: 1,
    ativo: true,
  },
  {
    id: "MT-SP-SOJA-FETHAB-v1",
    nome: "FETHAB — operação SOJA MT→SP (referência)",
    tributo: "FETHAB",
    estadoOrigem: "MT",
    estadoDestino: "SP",
    produto: "SOJA",
    tipoOperacao: "SOBRE_RODAS",
    valorFixoPorSaca: 3.0911,
    baseDeCalculo: "VALOR_POR_SACA",
    vigenciaInicio: VIGENCIA_REFERENCIA,
    fonte: "planilha_referencia:Precificacao_Agricola.xlsx",
    versao: 1,
    ativo: true,
  },
  {
    id: "MT-SP-SOJA-SENAR-v1",
    nome: "SENAR — operação SOJA MT→SP (referência)",
    tributo: "SENAR",
    estadoOrigem: "MT",
    estadoDestino: "SP",
    produto: "SOJA",
    tipoOperacao: "SOBRE_RODAS",
    valorFixoPorSaca: 0.14,
    baseDeCalculo: "VALOR_POR_SACA",
    vigenciaInicio: VIGENCIA_REFERENCIA,
    fonte: "planilha_referencia:Precificacao_Agricola.xlsx",
    versao: 1,
    ativo: true,
  },

  // ---- Operação de referência 2: Campo Verde-MT -> Terminal Rondonópolis, MILHO ----
  // Nesta planilha ICMS/PIS/COFINS/FUNRURAL aparecem zerados e em vez disso
  // há incidência de FUNDED/FUNDES — indício de regime especial/benefício
  // fiscal aplicado à operação. Mantido tal como está na planilha, sinalizado
  // como pendente de confirmação (não sabemos ainda o nome exato do programa).
  {
    id: "MT-MT-MILHO-FETHAB-v1",
    nome: "FETHAB — operação MILHO MT→MT (referência)",
    tributo: "FETHAB",
    estadoOrigem: "MT",
    estadoDestino: "MT",
    produto: "MILHO",
    tipoOperacao: "SOBRE_RODAS",
    valorFixoPorSaca: 0.91,
    baseDeCalculo: "VALOR_POR_SACA",
    vigenciaInicio: VIGENCIA_REFERENCIA,
    fonte: "planilha_referencia:PRECIFICACAO_OFICIAL.xlsx",
    versao: 1,
    ativo: true,
  },
  {
    id: "MT-MT-MILHO-SENAR-v1",
    nome: "SENAR — operação MILHO MT→MT (referência)",
    tributo: "SENAR",
    estadoOrigem: "MT",
    estadoDestino: "MT",
    produto: "MILHO",
    tipoOperacao: "SOBRE_RODAS",
    valorFixoPorSaca: 0.098,
    baseDeCalculo: "VALOR_POR_SACA",
    vigenciaInicio: VIGENCIA_REFERENCIA,
    fonte: "planilha_referencia:PRECIFICACAO_OFICIAL.xlsx",
    versao: 1,
    ativo: true,
  },
  {
    id: "MT-MT-MILHO-FUNDED-v1",
    nome: "FUNDED — operação MILHO MT→MT (referência, regime especial a confirmar)",
    tributo: "FUNDED",
    estadoOrigem: "MT",
    estadoDestino: "MT",
    produto: "MILHO",
    tipoOperacao: "SOBRE_RODAS",
    valorFixoPorSaca: 0.22848,
    baseDeCalculo: "VALOR_POR_SACA",
    beneficioFiscal: {
      nome: "Regime especial não identificado — confirmar com especialista tributário",
      tipo: "DIFERIMENTO",
      fonte: "planilha_referencia:PRECIFICACAO_OFICIAL.xlsx",
    },
    vigenciaInicio: VIGENCIA_REFERENCIA,
    fonte: "planilha_referencia:PRECIFICACAO_OFICIAL.xlsx",
    versao: 1,
    ativo: true,
  },
  {
    id: "MT-MT-MILHO-FUNDES-v1",
    nome: "FUNDES — operação MILHO MT→MT (referência, regime especial a confirmar)",
    tributo: "FUNDES",
    estadoOrigem: "MT",
    estadoDestino: "MT",
    produto: "MILHO",
    tipoOperacao: "SOBRE_RODAS",
    valorFixoPorSaca: 0.05712,
    baseDeCalculo: "VALOR_POR_SACA",
    vigenciaInicio: VIGENCIA_REFERENCIA,
    fonte: "planilha_referencia:PRECIFICACAO_OFICIAL.xlsx",
    versao: 1,
    ativo: true,
  },
];
