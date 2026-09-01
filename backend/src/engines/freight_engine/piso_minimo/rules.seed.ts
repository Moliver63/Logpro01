import type { RegraPisoMinimo } from "../../../types/domain.js";

/**
 * Piso mínimo de frete (Lei 13.703/2018, Resolução ANTT nº 5.867/2020,
 * Anexo II). Os coeficientes mudam com frequência: duas revisões ordinárias
 * por ano (janeiro e julho) e reajuste extraordinário sempre que o diesel
 * S10 varia 5%+ (gatilho).
 *
 * ATENÇÃO — MANUTENÇÃO DESTE ARQUIVO
 *
 * Nunca sobrescreva uma regra existente: crie uma NOVA versão com vigência
 * atual e mantenha a anterior com sua vigência histórica (a Regra 8 do
 * FRAMEWORK_EXCELENCIA exige rastreabilidade). `vigenciaFim` das regras
 * vigentes aponta para a próxima revisão ordinária prevista — se a tabela
 * for reajustada antes (gatilho do diesel), cadastre a versão nova assim
 * que a portaria sair. Se ninguém cadastrar, a regra expira e o motor
 * passa a retornar pendência em vez de calcular com coeficiente velho.
 * É o comportamento desejado.
 *
 * Contagem de eixos: desde a Resolução ANTT nº 6.076/2026, todos os eixos
 * da composição veicular contam para o piso, inclusive os suspensos.
 */
export const seedPisoMinimoRules: RegraPisoMinimo[] = [
  // --- Versão histórica, expirada de propósito. Não reativar, não editar. ---
  {
    id: "ANTT-TABELA-A-GRANEL_SOLIDO-7EIXOS-v1",
    tabela: "A",
    tipoCarga: "GRANEL_SOLIDO",
    numeroEixos: 7,
    ccdPorKm: 3.7867,
    ccValorFixo: 347.13,
    fonte:
      "Exemplo oficial ANTT (portal.antt.gov.br/perguntas-frequentes) sobre o Anexo II da Resolução 5.867/2020 — NÃO reflete reajustes por Portaria SUROC posteriores.",
    vigenciaInicio: "2020-01-14",
    vigenciaFim: "2026-03-12", // dia anterior à Portaria SUROC nº 3/2026
    versao: 1,
    ativo: true,
  },

  // --- Versão vigente: Resolução ANTT nº 6.084, de 16/07/2026 ---
  // Publicada no DOU de 17/07/2026, em vigor desde a publicação. Revisão
  // ordinária de julho/2026 (IPCA acumulado de 3,54% entre dez/2025 e
  // mai/2026, diesel S10 de referência a R$ 6,97/L), alterando o Anexo II
  // da Resolução nº 5.867/2020.
  //
  // Tabela A: transporte rodoviário de carga lotação com contratação da
  // composição veicular completa — o caso típico do frete de grãos.
  // Cobertura: GRANEL_SOLIDO (soja, milho, trigo, sorgo a granel), todos
  // os números de eixos previstos na tabela oficial (2, 3, 4, 5, 6, 7 e 9).
  // Demais tipos de carga e tabelas (B, C, D) seguem retornando pendência
  // até serem cadastrados — o produto trabalha com granel sólido.
  //
  // vigenciaFim: 20/01/2027, data da próxima revisão ordinária prevista na
  // Lei 13.703/2018. Se o gatilho do diesel disparar antes, cadastrar a
  // versão nova imediatamente.
  ...(
    [
      [2, 4.0144, 460.59],
      [3, 5.1355, 552.24],
      [4, 5.8118, 597.0],
      [5, 6.6983, 664.83],
      [6, 7.3841, 680.01],
      [7, 8.0516, 820.34],
      [9, 9.2231, 908.91],
    ] as const
  ).map(
    ([numeroEixos, ccdPorKm, ccValorFixo]): RegraPisoMinimo => ({
      id: `ANTT-TABELA-A-GRANEL_SOLIDO-${numeroEixos}EIXOS-v2`,
      tabela: "A",
      tipoCarga: "GRANEL_SOLIDO",
      numeroEixos,
      ccdPorKm,
      ccValorFixo,
      fonte:
        "Resolução ANTT nº 6.084, de 16/07/2026 (DOU de 17/07/2026) — Anexo II da Resolução nº 5.867/2020, Tabela A.",
      vigenciaInicio: "2026-07-17",
      vigenciaFim: "2027-01-20", // próxima revisão ordinária — gatilho do diesel pode antecipar
      versao: 2,
      ativo: true,
    })
  ),
];
