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
 *
 * CONFERÊNCIA CRUZADA (set/2026) — documento "BASE DE CÁLCULO – COMPRA E
 * VENDA DE GRÃOS", extraído das mesmas planilhas:
 * - Soja MT→SP bate integralmente: ICMS R$ 1,40/sac, PIS 1,65% e COFINS
 *   7,6% sobre o valor da operação, FETHAB R$ 3,0911/sac (10% base + 10%
 *   adicional + 1,15% entidade sobre a UPF/MT de R$ 243,49), SENAR
 *   R$ 0,14/sac.
 * - Milho MT→MT bate em SENAR (R$ 0,098/sac), FUNDED (4% sobre base de
 *   R$ 5,712/sac) e FUNDES (1% sobre a mesma base).
 * - DIVERGÊNCIA PENDENTE: o documento indica FETHAB de milho a 6% da UPF
 *   (R$ 0,8769/sac), mas a planilha original de onde a regra foi extraída
 *   registra R$ 0,91/sac. A regra abaixo mantém o valor da planilha;
 *   confirmar na fonte antes de criar uma nova versão.
 * - Sorgo e demais grãos aparecem no documento como PROJEÇÃO, com aviso de
 *   "requer confirmação junto à FAMATO" — por isso seguem sem regra
 *   cadastrada aqui (o motor retorna pendência para eles, por design).
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
