import { describe, expect, it } from "vitest";
import { calcularReferenciaFreteAntt } from "../src/services/freteReferenciaService.js";

describe("calcularReferenciaFreteAntt", () => {
  it("informa quais campos faltam para calcular o piso", () => {
    const resultado = calcularReferenciaFreteAntt({ quantidadeSacas: 1000, pesoPorSacaKg: 60 });

    expect(resultado.aplicavel).toBe(false);
    expect(resultado.camposNecessarios).toContain("distanciaKm");
    expect(resultado.camposNecessarios).toContain("numeroEixos");
    expect(resultado.pendencias.join(" ")).toMatch(/distância|eixos/i);
  });

  it("não inventa referência quando não há coeficiente vigente cadastrado", () => {
    const resultado = calcularReferenciaFreteAntt({
      quantidadeSacas: 1000,
      pesoPorSacaKg: 60,
      distanciaKm: 500,
      numeroEixos: 7,
    });

    expect(resultado.aplicavel).toBe(false);
    expect(resultado.freteMinimoPorTonelada).toBeUndefined();
    expect(resultado.pendencias.join(" ")).toMatch(/não cadastrado|vencido/i);
  });
});

