import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TranserveClient } from "../src/integrations/transerve/client.js";
import {
  transerveFreightRequestSchema,
  transerveOcorrenciaQuerySchema,
} from "../src/integrations/transerve/validation.js";

const BASE = "https://api-teste.transerve";

function respostaToken(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      access_token: "access-1",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "refresh-1",
      refresh_token_expires_em: "2026-12-31",
      ...overrides,
    }),
  } as unknown as Response;
}

function respostaJson(corpo: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
    text: async () => JSON.stringify(corpo),
  } as unknown as Response;
}

describe("TranserveClient — autenticação", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pede o token como x-www-form-urlencoded, não JSON", async () => {
    fetchMock.mockResolvedValueOnce(respostaToken()).mockResolvedValueOnce(respostaJson({ ok: true }));

    const client = new TranserveClient(BASE, "meu-id", "meu-secret");
    await client.consultarOcorrencia({ cnpj_relacionado: "12345678000199", codigo_nota_fiscal: "123" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/oauth/token`);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).get("grant_type")).toBe("client_credentials");
  });

  it("usa headers client_id e access_token, não Authorization Bearer", async () => {
    fetchMock.mockResolvedValueOnce(respostaToken()).mockResolvedValueOnce(respostaJson({ ok: true }));

    const client = new TranserveClient(BASE, "meu-id", "meu-secret");
    await client.consultarOcorrencia({ cnpj_relacionado: "12345678000199", codigo_nota_fiscal: "123" });

    const [, init] = fetchMock.mock.calls[1];
    const headers = init.headers as Record<string, string>;
    expect(headers.client_id).toBe("meu-id");
    expect(headers.access_token).toBe("access-1");
    expect(headers.Authorization).toBeUndefined();
  });

  it("reaproveita o token em vez de autenticar a cada chamada", async () => {
    fetchMock
      .mockResolvedValueOnce(respostaToken())
      .mockResolvedValueOnce(respostaJson({ ok: 1 }))
      .mockResolvedValueOnce(respostaJson({ ok: 2 }));

    const client = new TranserveClient(BASE, "id", "secret");
    await client.consultarOcorrencia({ cnpj_relacionado: "12345678000199", codigo_nota_fiscal: "1" });
    await client.consultarOcorrencia({ cnpj_relacionado: "12345678000199", codigo_nota_fiscal: "2" });

    const chamadasDeToken = fetchMock.mock.calls.filter(([url]) => String(url).includes("/oauth/token"));
    expect(chamadasDeToken).toHaveLength(1);
  });

  // A Transerve rotaciona o refresh token: cada renovação invalida o anterior.
  // Se o cliente não guardar o novo par, a renovação seguinte falha.
  it("guarda o novo refresh token devolvido na renovação", async () => {
    fetchMock
      // token inicial já expirado (expires_in baixo o suficiente pra cair na margem)
      .mockResolvedValueOnce(respostaToken({ expires_in: 0 }))
      .mockResolvedValueOnce(respostaJson({ ok: 1 }))
      // renovação devolve par novo
      .mockResolvedValueOnce(
        respostaToken({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 3600 })
      )
      .mockResolvedValueOnce(respostaJson({ ok: 2 }));

    const client = new TranserveClient(BASE, "id", "secret");
    await client.consultarOcorrencia({ cnpj_relacionado: "12345678000199", codigo_nota_fiscal: "1" });
    await client.consultarOcorrencia({ cnpj_relacionado: "12345678000199", codigo_nota_fiscal: "2" });

    const chamadaRefresh = fetchMock.mock.calls.find(([url]) => String(url).includes("/oauth/refresh"));
    expect(chamadaRefresh).toBeDefined();
    expect((chamadaRefresh![1].body as URLSearchParams).get("refresh_token")).toBe("refresh-1");

    // a chamada seguinte já usa o access token novo
    const ultima = fetchMock.mock.calls.at(-1)!;
    expect((ultima[1].headers as Record<string, string>).access_token).toBe("access-2");
  });

  it("cai para autenticação nova quando o refresh falha", async () => {
    fetchMock
      .mockResolvedValueOnce(respostaToken({ expires_in: 0 }))
      .mockResolvedValueOnce(respostaJson({ ok: 1 }))
      .mockResolvedValueOnce(respostaJson({ erro: "refresh expirado" }, 401)) // refresh falha
      .mockResolvedValueOnce(respostaToken({ access_token: "access-3", expires_in: 3600 }))
      .mockResolvedValueOnce(respostaJson({ ok: 2 }));

    const client = new TranserveClient(BASE, "id", "secret");
    await client.consultarOcorrencia({ cnpj_relacionado: "12345678000199", codigo_nota_fiscal: "1" });
    await client.consultarOcorrencia({ cnpj_relacionado: "12345678000199", codigo_nota_fiscal: "2" });

    const ultima = fetchMock.mock.calls.at(-1)!;
    expect((ultima[1].headers as Record<string, string>).access_token).toBe("access-3");
  });

  it("falha de forma explícita quando não está configurado", async () => {
    const client = new TranserveClient("", "", "");
    expect(client.estaConfigurado()).toBe(false);
    await expect(
      client.consultarOcorrencia({ cnpj_relacionado: "12345678000199", codigo_nota_fiscal: "1" })
    ).rejects.toThrow(/não configurada/i);
  });
});

describe("Validação da solicitação de frete", () => {
  const base = {
    endereco_completo_coleta: "Rua A, 100, Sinop MT",
    endereco_completo_entrega: "Av B, 200, Santos SP",
    volume_total_carga: "30",
    peso_total_carga: "28000",
    carga_palletizada: "nao",
    necessita_ajudantes: false,
    informacoes_caminhao: "Carreta graneleira",
    informacoes_produto_transportado: "Soja em grão",
    tem_agendamento: false,
    modalidade_transporte: "rodoviario",
    informacoes_extras_transporte: "Carga a granel",
  };

  it("aceita uma solicitação completa e válida", () => {
    expect(transerveFreightRequestSchema.safeParse(base).success).toBe(true);
  });

  it("exige quantidade de ajudantes quando necessita_ajudantes é true", () => {
    const r = transerveFreightRequestSchema.safeParse({ ...base, necessita_ajudantes: true });
    expect(r.success).toBe(false);
  });

  it("exige observação de agendamento quando tem_agendamento é true", () => {
    const r = transerveFreightRequestSchema.safeParse({ ...base, tem_agendamento: true });
    expect(r.success).toBe(false);
  });

  it("rejeita endereço acima de 1000 caracteres", () => {
    const r = transerveFreightRequestSchema.safeParse({
      ...base,
      endereco_completo_coleta: "x".repeat(1001),
    });
    expect(r.success).toBe(false);
  });

  it("rejeita campo de 100 caracteres quando excedido", () => {
    const r = transerveFreightRequestSchema.safeParse({ ...base, volume_total_carga: "x".repeat(101) });
    expect(r.success).toBe(false);
  });

  it("rejeita CNPJ com máscara na consulta de ocorrência", () => {
    expect(
      transerveOcorrenciaQuerySchema.safeParse({
        cnpj_relacionado: "12.345.678/0001-99",
        codigo_nota_fiscal: "1",
      }).success
    ).toBe(false);

    expect(
      transerveOcorrenciaQuerySchema.safeParse({
        cnpj_relacionado: "12345678000199",
        codigo_nota_fiscal: "1",
      }).success
    ).toBe(true);
  });
});
