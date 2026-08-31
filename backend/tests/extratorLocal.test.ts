import { describe, it, expect } from "vitest";
import { extrairDoTexto } from "../src/services/extratorLocal.js";

describe("extratorLocal", () => {
  it("extrai todos os campos de uma frase na ordem natural", () => {
    const { campos, faltando } = extrairDoTexto(
      "50 mil sacas de soja, compro a 38 em Alto Taquari MT, vendo a 70 em Rancharia SP"
    );
    expect(faltando).toHaveLength(0);
    expect(campos.produto).toBe("SOJA");
    expect(campos.quantidadeSacas).toBe(50000);
    expect(campos.precoCompraPorSaca).toBe(38);
    expect(campos.precoVendaPorSaca).toBe(70);
    expect(campos.municipioOrigem).toBe("Alto Taquari");
    expect(campos.estadoOrigem).toBe("MT");
    expect(campos.municipioDestino).toBe("Rancharia");
    expect(campos.estadoDestino).toBe("SP");
  });

  // REGRESSÃO: antes, o extrator pegava os dois primeiros locais na ordem do
  // texto, então escrever a venda primeiro invertia a rota silenciosamente —
  // calculando tributos de SP→MT em vez de MT→SP, sem nenhum aviso.
  it("não inverte origem e destino quando a venda vem antes da compra na frase", () => {
    const { campos } = extrairDoTexto(
      "vendo a 70 em Rancharia SP, compro a 38 em Alto Taquari MT, 1000 sacas de soja"
    );
    expect(campos.municipioOrigem).toBe("Alto Taquari");
    expect(campos.estadoOrigem).toBe("MT");
    expect(campos.municipioDestino).toBe("Rancharia");
    expect(campos.estadoDestino).toBe("SP");
  });

  it("aceita preço com centavos no formato brasileiro", () => {
    const { campos } = extrairDoTexto(
      "1000 sacas de soja compro a 38,50 em Sinop MT vendo a 70,90 em Santos SP"
    );
    expect(campos.precoCompraPorSaca).toBe(38.5);
    expect(campos.precoVendaPorSaca).toBe(70.9);
  });

  it("lida com nome de cidade acentuado e composto", () => {
    const { campos } = extrairDoTexto(
      "1000 sacas de soja compro a 10 em Sinop MT vendo a 20 em São José do Rio Preto SP"
    );
    expect(campos.municipioOrigem).toBe("Sinop");
    expect(campos.municipioDestino).toContain("São José");
    expect(campos.estadoDestino).toBe("SP");
  });

  it("reporta campos faltantes em vez de adivinhar", () => {
    const { campos, faltando } = extrairDoTexto("quero calcular uma operação de soja");
    expect(campos.produto).toBe("SOJA");
    expect(faltando).toContain("quantidadeSacas");
    expect(faltando).toContain("municipioOrigem");
    expect(faltando).toContain("precoCompraPorSaca");
  });

  it("não preenche destino quando só a origem foi mencionada", () => {
    const { campos, faltando } = extrairDoTexto("1000 sacas de soja, compro a 38 em Sinop MT");
    expect(campos.municipioOrigem).toBe("Sinop");
    expect(campos.municipioDestino).toBeUndefined();
    expect(faltando).toContain("municipioDestino");
  });

  it("interpreta 'mil sacas' como milhares", () => {
    const { campos } = extrairDoTexto("60 mil sacas de milho compro a 30 em Sorriso MT vendo a 55 em Santos SP");
    expect(campos.quantidadeSacas).toBe(60000);
  });
});
