import type { ResultadoReferenciaPreco } from "../../types/domain.js";

/**
 * AlphaVantagePriceReferenceProvider
 *
 * Traz uma referência internacional de preço (contrato futuro de Chicago/CBOT,
 * via Alpha Vantage) convertida para R$/saca de 60kg. Isso é uma REFERÊNCIA
 * de mercado, não o preço físico brasileiro — não substitui o preço que o
 * usuário digita em Compra/Venda, só ajuda a contextualizar se está caro ou
 * barato frente ao mercado internacional.
 *
 * Limitações conhecidas e assumidas de propósito:
 * - Alpha Vantage só cobre MILHO (CORN) e TRIGO (WHEAT). Não tem SOJA nem
 *   SORGO — para esses, retorna pendência em vez de inventar um número.
 * - Câmbio e prêmio/desconto de porto/região não estão no cálculo — é só
 *   USD/bushel de Chicago convertido para BRL/saca pela cotação do dólar.
 */

const KG_POR_BUSHEL: Record<string, number> = {
  MILHO: 25.401, // bushel de milho = 56 lb
  TRIGO: 27.2155, // bushel de trigo = 60 lb
};

const FUNCTION_POR_PRODUTO: Record<string, string> = {
  MILHO: "CORN",
  TRIGO: "WHEAT",
};

interface CacheEntry {
  valor: ResultadoReferenciaPreco;
  expiraEm: number;
}

// Cache em memória — a Alpha Vantage no plano gratuito limita a 25
// chamadas/dia, então evitamos bater na API a cada requisição do usuário.
const cache = new Map<string, CacheEntry>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export class AlphaVantagePriceReferenceProvider {
  constructor(private readonly apiKey: string) {}

  async getReferencia(produto: string): Promise<ResultadoReferenciaPreco> {
    const fn = FUNCTION_POR_PRODUTO[produto];
    if (!fn) {
      return {
        aplicavel: false,
        pendencia: `Sem referência internacional disponível para ${produto} — a Alpha Vantage só cobre milho e trigo (contratos futuros de Chicago).`,
      };
    }

    const cached = cache.get(produto);
    if (cached && cached.expiraEm > Date.now()) {
      return cached.valor;
    }

    if (!this.apiKey) {
      return {
        aplicavel: false,
        pendencia: "Referência internacional indisponível — chave da Alpha Vantage não configurada no backend.",
      };
    }

    try {
      const [commodityRes, fxRes] = await Promise.all([
        fetch(
          `https://www.alphavantage.co/query?function=${fn}&interval=monthly&apikey=${this.apiKey}`
        ),
        fetch(
          `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=BRL&apikey=${this.apiKey}`
        ),
      ]);

      const commodityJson = (await commodityRes.json()) as {
        name?: string;
        unit?: string;
        data?: { date: string; value: string }[];
        Note?: string;
        Information?: string;
      };
      const fxJson = (await fxRes.json()) as {
        "Realtime Currency Exchange Rate"?: { "5. Exchange Rate": string };
        Note?: string;
        Information?: string;
      };

      // Alpha Vantage retorna 200 OK mesmo quando o limite diário estourou —
      // o erro vem como texto em "Note" ou "Information", não como status HTTP.
      if (commodityJson.Note || commodityJson.Information || fxJson.Note || fxJson.Information) {
        return {
          aplicavel: false,
          pendencia:
            "Referência internacional indisponível no momento — provável limite diário de chamadas da Alpha Vantage atingido. Tente novamente mais tarde.",
        };
      }

      const valorBruto = Number(commodityJson.data?.[0]?.value);
      const dataReferencia = commodityJson.data?.[0]?.date;
      const usdBrl = Number(fxJson["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"]);
      const unidade = (commodityJson.unit ?? "").toLowerCase();

      if (!valorBruto || !usdBrl) {
        return {
          aplicavel: false,
          pendencia: "Referência internacional indisponível — resposta inesperada da Alpha Vantage.",
        };
      }

      // A unidade (dólar ou centavo por bushel) vem no próprio campo "unit"
      // da resposta — não assumimos, lemos. Se não reconhecermos o texto,
      // não arriscamos dividir errado: paramos e sinalizamos.
      let usdPorBushel: number;
      if (unidade.includes("cent")) {
        usdPorBushel = valorBruto / 100;
      } else if (unidade.includes("dollar")) {
        usdPorBushel = valorBruto;
      } else {
        return {
          aplicavel: false,
          pendencia: `Referência internacional indisponível — a Alpha Vantage retornou a unidade "${
            commodityJson.unit ?? "(vazia)"
          }" para ${produto}, que este sistema ainda não sabe interpretar com segurança. Valor bruto recebido: ${valorBruto}. Requer confirmação manual antes de usar.`,
        };
      }

      const kgPorBushel = KG_POR_BUSHEL[produto];
      const brlPorBushel = usdPorBushel * usdBrl;
      const valorPorSaca = round2((brlPorBushel / kgPorBushel) * 60);

      const resultado: ResultadoReferenciaPreco = {
        aplicavel: true,
        valorPorSaca,
        moeda: "BRL",
        cotacaoOrigemUsdPorBushel: usdPorBushel,
        taxaCambioUsdBrl: usdBrl,
        dataReferencia,
        fonte:
          "Alpha Vantage — futuro CBOT (Chicago), convertido de USD/bushel para BRL/saca de 60kg pelo câmbio do dia. Referência de mercado internacional, não é o preço físico brasileiro.",
      };

      cache.set(produto, { valor: resultado, expiraEm: Date.now() + TTL_MS });
      return resultado;
    } catch {
      return {
        aplicavel: false,
        pendencia: "Falha ao consultar a Alpha Vantage.",
      };
    }
  }
}
