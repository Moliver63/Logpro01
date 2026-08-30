import type { RegraPisoMinimo } from "../../../types/domain.js";

/**
 * ATENÇÃO — LEIA ANTES DE ATIVAR EM PRODUÇÃO
 *
 * O piso mínimo de frete (Lei 13.703/2018, Resolução ANTT nº 5.867/2020,
 * Anexo II) é reajustado com muita frequência — sempre que o preço do
 * diesel S10 varia 5%+ (Portaria SUROC), além de duas revisões ordinárias
 * por ano (20/jan e 20/jun). Em 2026 já saíram várias portarias de
 * reajuste extraordinário (nº 3, nº 4, e outras até pelo menos nº 20 em
 * julho, segundo apuração externa).
 *
 * A regra abaixo usa o valor do EXEMPLO OFICIAL publicado pela própria
 * ANTT (FAQ do portal, ilustrando o Anexo II original da Resolução
 * 5.867/2020) — não é uma tabela reajustada, e não reflete o piso vigente
 * hoje. Por isso `vigenciaFim` está deliberadamente no passado: o motor
 * (mesma lógica de vigência do tax_engine) vai tratar isso como EXPIRADO
 * e retornar pendência em vez de aplicar um coeficiente desatualizado
 * silenciosamente.
 *
 * Antes de estender a cobertura ou "reativar" esta regra, confirme o
 * coeficiente vigente em https://calculadorafrete.antt.gov.br/ (ou na
 * Portaria SUROC mais recente) e crie uma NOVA versão com vigência atual
 * — nunca sobrescreva esta.
 */
export const seedPisoMinimoRules: RegraPisoMinimo[] = [
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
    vigenciaFim: "2026-03-12", // dia anterior à Portaria SUROC nº 3/2026 — força expiração deliberada
    versao: 1,
    ativo: true,
  },
];
