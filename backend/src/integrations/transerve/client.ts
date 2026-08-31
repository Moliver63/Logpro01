/**
 * Cliente da API Transerve.
 *
 * ESCOPO — leia antes de estender:
 *
 * A Transerve NÃO expõe cotação de preço de frete. Os endpoints
 * documentados solicitam um frete (devolvendo um código de solicitação) e
 * consultam ocorrências/rastreamento. Por isso esta integração NÃO
 * implementa `FreightProvider`: aquela interface devolve valor por
 * tonelada, e cumpri-la aqui exigiria inventar um preço — exatamente o que
 * o resto do sistema evita. O frete continua vindo do que o usuário
 * informa; a Transerve entra depois, para executar e acompanhar.
 *
 * Particularidades da API (conforme documentação oficial):
 * - O token é obtido com Content-Type x-www-form-urlencoded, não JSON.
 * - As rotas protegidas usam os headers `client_id` e `access_token`,
 *   e NÃO o padrão `Authorization: Bearer`.
 * - O refresh token é ROTATIVO: cada renovação invalida o anterior e
 *   devolve um novo par. Guardar os dois novos valores é obrigatório,
 *   senão a próxima renovação falha.
 */

export interface TranserveTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_em: string;
}

export interface TranserveFreightRequest {
  endereco_completo_coleta: string;
  endereco_completo_entrega: string;
  volume_total_carga: string;
  observacao_volume_total_carga?: string;
  peso_total_carga: string;
  observacao_peso_total_carga?: string;
  carga_palletizada: string;
  necessita_ajudantes: boolean;
  necessita_ajudantes_quantidade?: string | null;
  informacoes_caminhao: string;
  informacoes_produto_transportado: string;
  tem_agendamento: boolean;
  observacao_agendamento?: string | null;
  modalidade_transporte: string;
  informacoes_extras_transporte: string;
}

export interface TranserveFreightResponse {
  mensagem: string;
  codigo_solicitacao: string;
}

export interface TranserveOcorrenciaQuery {
  cnpj_relacionado: string;
  codigo_nota_fiscal: string;
}

export class TranserveNaoConfiguradoError extends Error {
  constructor() {
    super(
      "Integração Transerve não configurada — defina TRANSERVE_BASE_URL, TRANSERVE_CLIENT_ID e TRANSERVE_CLIENT_SECRET."
    );
    this.name = "TranserveNaoConfiguradoError";
  }
}

export class TranserveApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly corpo?: unknown
  ) {
    super(message);
    this.name = "TranserveApiError";
  }
}

interface TokensEmMemoria {
  accessToken: string;
  refreshToken: string;
  /** Timestamp (ms) em que o access token expira, já com margem de segurança. */
  expiraEm: number;
}

/** Renova um pouco antes de expirar, pra não perder uma chamada por corrida de tempo. */
const MARGEM_RENOVACAO_MS = 60_000;

export class TranserveClient {
  private tokens: TokensEmMemoria | null = null;
  /** Evita várias renovações simultâneas quando chegam requisições em paralelo. */
  private renovacaoEmAndamento: Promise<TokensEmMemoria> | null = null;

  constructor(
    private readonly baseUrl = process.env.TRANSERVE_BASE_URL ?? "",
    private readonly clientId = process.env.TRANSERVE_CLIENT_ID ?? "",
    private readonly clientSecret = process.env.TRANSERVE_CLIENT_SECRET ?? ""
  ) {}

  estaConfigurado(): boolean {
    return !!(this.baseUrl && this.clientId && this.clientSecret);
  }

  private garantirConfigurado(): void {
    if (!this.estaConfigurado()) throw new TranserveNaoConfiguradoError();
  }

  private async postForm(caminho: string, campos: Record<string, string>): Promise<TranserveTokenResponse> {
    const resposta = await fetch(`${this.baseUrl}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(campos),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      throw new TranserveApiError(
        `Falha na autenticação Transerve (${resposta.status}).`,
        resposta.status,
        corpo
      );
    }

    return (await resposta.json()) as TranserveTokenResponse;
  }

  private guardarTokens(resposta: TranserveTokenResponse): TokensEmMemoria {
    // expires_in vem em segundos. Renova antes do fim pra evitar usar um
    // token que expira no meio da chamada.
    const tokens: TokensEmMemoria = {
      accessToken: resposta.access_token,
      refreshToken: resposta.refresh_token,
      expiraEm: Date.now() + resposta.expires_in * 1000 - MARGEM_RENOVACAO_MS,
    };
    this.tokens = tokens;
    return tokens;
  }

  /** Autenticação inicial via client_credentials. */
  private async autenticar(): Promise<TokensEmMemoria> {
    this.garantirConfigurado();
    const resposta = await this.postForm("/api/oauth/token", {
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    return this.guardarTokens(resposta);
  }

  /**
   * Renovação via refresh token. Se falhar (refresh expirado, rotação
   * perdida por reinício do processo, etc.), cai de volta para uma
   * autenticação nova em vez de propagar o erro — client_credentials não
   * depende de estado anterior, então sempre há caminho de recuperação.
   */
  private async renovar(refreshToken: string): Promise<TokensEmMemoria> {
    this.garantirConfigurado();
    try {
      const resposta = await this.postForm("/api/oauth/refresh", {
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      });
      return this.guardarTokens(resposta);
    } catch {
      this.tokens = null;
      return this.autenticar();
    }
  }

  /** Devolve um access token válido, autenticando ou renovando conforme necessário. */
  private async getAccessToken(): Promise<string> {
    if (this.tokens && Date.now() < this.tokens.expiraEm) {
      return this.tokens.accessToken;
    }

    if (!this.renovacaoEmAndamento) {
      const anterior = this.tokens;
      this.renovacaoEmAndamento = (anterior ? this.renovar(anterior.refreshToken) : this.autenticar()).finally(
        () => {
          this.renovacaoEmAndamento = null;
        }
      );
    }

    const tokens = await this.renovacaoEmAndamento;
    return tokens.accessToken;
  }

  /**
   * Chamada autenticada. Se a API responder 401 (token invalidado do lado
   * deles antes do prazo previsto), força uma reautenticação e tenta mais
   * uma vez — uma só, pra não entrar em laço.
   */
  private async chamarAutenticado(
    caminho: string,
    init: RequestInit = {},
    jaRepetiu = false
  ): Promise<Response> {
    this.garantirConfigurado();
    const accessToken = await this.getAccessToken();

    const resposta = await fetch(`${this.baseUrl}${caminho}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        client_id: this.clientId,
        access_token: accessToken,
      },
    });

    if (resposta.status === 401 && !jaRepetiu) {
      this.tokens = null;
      return this.chamarAutenticado(caminho, init, true);
    }

    return resposta;
  }

  /** Consulta ocorrências/rastreamento de uma nota fiscal, incluindo canhoto quando disponível. */
  async consultarOcorrencia(query: TranserveOcorrenciaQuery): Promise<unknown> {
    const params = new URLSearchParams({
      cnpj_relacionado: query.cnpj_relacionado,
      codigo_nota_fiscal: query.codigo_nota_fiscal,
    });

    const resposta = await this.chamarAutenticado(
      `/api/clientexterno/get-ocorrencia-cliente-interno?${params}`,
      { method: "GET" }
    );

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      throw new TranserveApiError(
        `Falha ao consultar ocorrência na Transerve (${resposta.status}).`,
        resposta.status,
        corpo
      );
    }

    return resposta.json();
  }

  /** Solicita um frete. Devolve o código de solicitação (15 caracteres hexadecimais). */
  async solicitarFrete(dados: TranserveFreightRequest): Promise<TranserveFreightResponse> {
    const resposta = await this.chamarAutenticado("/api/clientexterno/post-carga-client-interno", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      throw new TranserveApiError(
        `Falha ao solicitar frete na Transerve (${resposta.status}).`,
        resposta.status,
        corpo
      );
    }

    return (await resposta.json()) as TranserveFreightResponse;
  }
}

export const transerveClient = new TranserveClient();
