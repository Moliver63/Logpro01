import { describe, it, expect } from "vitest";
import { DealEngine } from "../src/engines/deal_engine/index.js";
import { TaxEngine } from "../src/engines/tax_engine/index.js";
import { FreightEngine } from "../src/engines/freight_engine/index.js";
import { PisoMinimoEngine } from "../src/engines/freight_engine/piso_minimo/index.js";
import { seedTaxRules } from "../src/engines/tax_engine/rules.seed.js";
import { seedPisoMinimoRules } from "../src/engines/freight_engine/piso_minimo/rules.seed.js";
import type { OperacaoInput, RegraTributaria } from "../src/types/domain.js";

function montarEngine() {
  return new DealEngine(
    new TaxEngine(seedTaxRules),
    new FreightEngine(),
    new PisoMinimoEngine(seedPisoMinimoRules)
  );
}

/**
 * Caso de referência: planilha real de soja Alto Taquari-MT → Rancharia-SP.
 * Se algum desses números mudar sem intenção, é regressão no motor de
 * cálculo — o tipo de erro mais caro possível neste produto.
 */
const OPERACAO_SOJA_REFERENCIA: OperacaoInput = {
  mercadoria: { produto: "SOJA", quantidadeSacas: 50000, pesoPorSacaKg: 60 },
  compra: { precoPorSaca: 38, municipioOrigem: "Alto Taquari", estadoOrigem: "MT" },
  venda: { precoPorSaca: 70, municipioDestino: "Rancharia", estadoDestino: "SP" },
  logistica: { fretePorTonelada: 100 },
  tipoOperacao: "SOBRE_RODAS",
  dataOperacao: "2026-08-31",
};

describe("DealEngine — caso de referência (planilha soja MT→SP)", () => {
  it("reproduz receita, custo de mercadoria e resultado da planilha", async () => {
    const resultado = await montarEngine().calcular(OPERACAO_SOJA_REFERENCIA);

    expect(resultado.receitaTotal.valor).toBe(3_500_000);
    expect(resultado.custoMercadoria.valor).toBe(1_900_000);
    expect(resultado.custoTributario.valor).toBe(555_305);
    expect(resultado.custoLogistico.valor).toBe(300_000);
    expect(resultado.resultado.valor).toBe(744_695);
    expect(resultado.margemPercentual).toBeCloseTo(21.28, 1);
    expect(resultado.viavel).toBe(false);
    expect(resultado.calculoCompleto).toBe(false);
  });

  it("reproduz os tributos individuais da planilha", async () => {
    const resultado = await montarEngine().calcular(OPERACAO_SOJA_REFERENCIA);
    const porTributo = Object.fromEntries(
      resultado.tributos.itens.map((i) => [i.tributo, i.valorComBeneficio])
    );

    expect(porTributo.ICMS).toBe(70_000);
    expect(porTributo.PIS).toBe(57_750);
    expect(porTributo.COFINS).toBe(266_000);
    expect(porTributo.FETHAB).toBe(154_555);
    expect(porTributo.SENAR).toBe(7_000);
  });

  it("declara pendência explícita para tributo sem regra cadastrada, nunca zero silencioso", async () => {
    const resultado = await montarEngine().calcular(OPERACAO_SOJA_REFERENCIA);
    expect(resultado.pendenciasTributarias.length).toBeGreaterThan(0);
    expect(resultado.pendenciasTributarias.join(" ")).toMatch(/não cadastrada|pendente de validação/i);
  });
});

describe("DealEngine — comportamento com produto sem regra cadastrada", () => {
  it("calcula mas avisa que nenhum tributo está cadastrado para SORGO", async () => {
    const resultado = await montarEngine().calcular({
      ...OPERACAO_SOJA_REFERENCIA,
      mercadoria: { produto: "SORGO", quantidadeSacas: 1000, pesoPorSacaKg: 60 },
    });

    expect(resultado.custoTributario.valor).toBe(0);
    expect(resultado.pendenciasTributarias.join(" ")).toMatch(/SORGO/);
    // O ponto crítico: zero por falta de cadastro NÃO pode passar como isenção real.
    expect(resultado.pendenciasTributarias.join(" ")).toMatch(/ausência de cadastro|não cadastrad/i);
  });

  it("não marca operação lucrativa com pendência fiscal como viável", async () => {
    const resultado = await montarEngine().calcular(OPERACAO_SOJA_REFERENCIA);

    expect(resultado.resultado.valor).toBeGreaterThan(0);
    expect(resultado.pendenciasTributarias.length).toBeGreaterThan(0);
    expect(resultado.calculoCompleto).toBe(false);
    expect(resultado.viavel).toBe(false);
  });
});

describe("DealEngine — piso mínimo ANTT", () => {
  it("não verifica piso quando número de eixos não foi informado", async () => {
    const resultado = await montarEngine().calcular(OPERACAO_SOJA_REFERENCIA);
    expect(resultado.pisoMinimoAntt.aplicavel).toBe(false);
    expect(resultado.pisoMinimoAntt.pendencia).toMatch(/eixos/i);
    expect(resultado.pendenciasOperacionais.join(" ")).toMatch(/ANTT/i);
  });
});

describe("TaxEngine — vigência por data da operação", () => {
  it("usa dataOperacao/dataBase para decidir regra vigente", () => {
    const regras: RegraTributaria[] = [
      {
        id: "SOJA-MT-SP-ICMS-OLD",
        nome: "ICMS antigo",
        tributo: "ICMS",
        estadoOrigem: "MT",
        estadoDestino: "SP",
        produto: "SOJA",
        tipoOperacao: "SOBRE_RODAS",
        valorFixoPorSaca: 1,
        baseDeCalculo: "VALOR_POR_SACA",
        vigenciaInicio: "2024-01-01",
        vigenciaFim: "2024-12-31",
        fonte: "teste",
        versao: 1,
        ativo: true,
      },
      {
        id: "SOJA-MT-SP-ICMS-NEW",
        nome: "ICMS novo",
        tributo: "ICMS",
        estadoOrigem: "MT",
        estadoDestino: "SP",
        produto: "SOJA",
        tipoOperacao: "SOBRE_RODAS",
        valorFixoPorSaca: 2,
        baseDeCalculo: "VALOR_POR_SACA",
        vigenciaInicio: "2025-01-01",
        fonte: "teste",
        versao: 2,
        ativo: true,
      },
    ];

    const taxEngine = new TaxEngine(regras);
    const resultado = taxEngine.calcular({
      estadoOrigem: "MT",
      estadoDestino: "SP",
      produto: "SOJA",
      tipoOperacao: "SOBRE_RODAS",
      valorPorSaca: 50,
      quantidadeSacas: 10,
      dataOperacao: "2024-06-01",
    });

    expect(resultado.itens).toHaveLength(1);
    expect(resultado.itens[0].regraId).toBe("SOJA-MT-SP-ICMS-OLD");
    expect(resultado.itens[0].valorComBeneficio).toBe(10);
  });
});
