import { afterEach, describe, expect, it, vi } from "vitest";
import { calcularReferenciaFreteAntt } from "../src/services/freteReferenciaService.js";

function mockFetchOk(distanciaMetros: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("nominatim")) {
        return { ok: true, json: async () => [{ lat: "-17.5", lon: "-53.3" }] };
      }
      if (u.includes("router.project-osrm")) {
        return { ok: true, json: async () => ({ code: "Ok", routes: [{ distance: distanciaMetros }] }) };
      }
      throw new Error(`URL inesperada no teste: ${u}`);
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("calcularReferenciaFreteAntt", () => {
  it("informa quais campos faltam para calcular o piso", async () => {
    const resultado = await calcularReferenciaFreteAntt({ quantidadeSacas: 1000, pesoPorSacaKg: 60 });

    expect(resultado.aplicavel).toBe(false);
    expect(resultado.camposNecessarios).toContain("distanciaKm");
    expect(resultado.camposNecessarios).toContain("numeroEixos");
    expect(resultado.pendencias.join(" ")).toMatch(/distância|eixos/i);
  });

  it("aceita origem e destino no lugar da distância", async () => {
    mockFetchOk(500_000);
    const resultado = await calcularReferenciaFreteAntt({
      quantidadeSacas: 1000,
      pesoPorSacaKg: 60,
      origem: { municipio: "Testandia", uf: "MT" },
      destino: { municipio: "Testopolis", uf: "SP" },
      // sem numeroEixos de propósito: só a distância deixa de faltar
    });

    expect(resultado.camposNecessarios).not.toContain("distanciaKm");
    expect(resultado.camposNecessarios).toEqual(["numeroEixos"]);
  });

  // Os coeficientes v2 (Resolução ANTT 6.084/2026) têm vigenciaFim em
  // 20/01/2027, data da próxima revisão ordinária. Depois dessa data este
  // teste quebra de propósito: cadastrar a versão nova no rules.seed.
  it("calcula com os coeficientes vigentes da Resolução ANTT 6.084/2026", async () => {
    const resultado = await calcularReferenciaFreteAntt({
      quantidadeSacas: 1000,
      pesoPorSacaKg: 60,
      distanciaKm: 500,
      numeroEixos: 7,
    });

    expect(resultado.aplicavel).toBe(true);
    expect(resultado.pisoMinimoAntt?.regraId).toBe("ANTT-TABELA-A-GRANEL_SOLIDO-7EIXOS-v2");
    // 500 km × 8,0516 (CCD) + 820,34 (CC) = 4.846,14; ÷ 60 t = 80,77
    expect(resultado.freteMinimoTotal).toBe(4846.14);
    expect(resultado.freteMinimoPorTonelada).toBe(80.77);
    expect(resultado.pisoMinimoAntt?.origemDistancia).toBe("informado_usuario");
  });

  it("não aplica a regra v1 expirada mesmo com coeficiente cadastrado", async () => {
    // v1 (exemplo oficial de 2020) tem vigenciaFim em 12/03/2026. O motor
    // precisa escolher a v2 vigente, nunca a mais antiga.
    const resultado = await calcularReferenciaFreteAntt({
      quantidadeSacas: 1000,
      pesoPorSacaKg: 60,
      distanciaKm: 500,
      numeroEixos: 7,
    });

    expect(resultado.pisoMinimoAntt?.regraId).not.toBe("ANTT-TABELA-A-GRANEL_SOLIDO-7EIXOS-v1");
  });

  it("calcula a distância via OSM/OSRM quando ela não é informada", async () => {
    mockFetchOk(500_000);
    const resultado = await calcularReferenciaFreteAntt({
      quantidadeSacas: 1000,
      pesoPorSacaKg: 60,
      numeroEixos: 7,
      origem: { municipio: "Rota Verde", uf: "MT" },
      destino: { municipio: "Porto Seco", uf: "SP" },
    });

    expect(resultado.aplicavel).toBe(true);
    expect(resultado.distancia?.km).toBe(500);
    expect(resultado.distancia?.origemDado).toBe("api_externa");
    expect(resultado.pisoMinimoAntt?.origemDistancia).toBe("api_externa");
    expect(resultado.pisoMinimoAntt?.distanciaKm).toBe(500);
  });

  it("retorna pendência explícita quando a distância não pode ser calculada", async () => {
    // Nominatim não localiza o município.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [] }))
    );
    const resultado = await calcularReferenciaFreteAntt({
      quantidadeSacas: 1000,
      pesoPorSacaKg: 60,
      numeroEixos: 7,
      origem: { municipio: "Lugar Inexistente", uf: "MT" },
      destino: { municipio: "Outro Lugar", uf: "SP" },
    });

    expect(resultado.aplicavel).toBe(false);
    expect(resultado.freteMinimoPorTonelada).toBeUndefined();
    expect(resultado.pendencias.join(" ")).toMatch(/Informe a distância/);
  });
});
