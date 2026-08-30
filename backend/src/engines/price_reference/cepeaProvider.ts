import type { ResultadoReferenciaPreco } from "../../types/domain.js";

/**
 * CepeaPriceReferenceProvider
 *
 * Referência de preço físico brasileiro (não futuro internacional), extraída
 * das páginas públicas da CEPEA/Esalq — a fonte de referência do mercado
 * agropecuário no Brasil.
 *
 * IMPORTANTE — leia antes de estender ou usar em produção comercial:
 *
 * 1. Licença: os dados da CEPEA são licenciados sob CC BY-NC 4.0 —
 *    Atribuição, Uso Não Comercial. Uso liberado para estudo/projeto não
 *    comercial (como confirmado para este projeto). Se o LogPro virar
 *    produto comercial de verdade, isso precisa ser revisitado diretamente
 *    com a CEPEA antes de continuar usando esta fonte.
 *    https://cepea.esalq.usp.br/br/licenca-de-uso-de-dados.aspx
 *
 * 2. Isto NÃO é uma API oficial — é extração de texto de páginas HTML
 *    públicas da CEPEA que não foram desenhadas para consumo automatizado.
 *    Para reduzir fragilidade, o parser busca pelo TEXTO visível (depois de
 *    remover todas as tags HTML), não por seletores CSS/classes — texto
 *    visível ao usuário muda com menos frequência que a estrutura interna
 *    da página, mas ainda pode quebrar se a CEPEA reformular o site.
 *
 * 3. Mesma regra de ouro do resto do sistema: se o texto esperado não for
 *    encontrado, retorna pendência — nunca inventa ou estima um valor.
 */

interface CacheEntry {
  valor: ResultadoReferenciaPreco;
  expiraEm: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6h — CEPEA atualiza uma vez por dia, por volta das 16h30

const FONTE_CEPEA =
  "CEPEA/Esalq — preço físico brasileiro. Uso sob licença CC BY-NC 4.0 (não comercial). https://cepea.org.br";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Converte "1.452,55" (formato brasileiro) para 1452.55 */
function parseNumeroBr(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

async function fetchTextoVisivel(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LogPro-price-reference/1.0)" },
  });
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function buscarSojaOuMilho(produto: "SOJA" | "MILHO"): Promise<ResultadoReferenciaPreco> {
  const label = produto === "SOJA" ? "Soja" : "Milho";
  try {
    const texto = await fetchTextoVisivel("https://cepea.org.br/br");
    const ancora = texto.indexOf("Preços CEPEA");
    if (ancora === -1) {
      return { aplicavel: false, pendencia: "Não foi possível localizar o bloco de preços na página da CEPEA — layout pode ter mudado." };
    }
    const janela = texto.slice(ancora, ancora + 1500);

    const dataMatch = janela.match(/(\d{2})\|(\d{2})\|(\d{4})/);
    const precoMatch = janela.match(new RegExp(`${label}\\s*R\\$\\s*([\\d.,]+)\\s*\\|\\s*sc`, "i"));

    if (!precoMatch) {
      return {
        aplicavel: false,
        pendencia: `Não foi possível localizar o preço de ${label} no texto da página da CEPEA — layout pode ter mudado.`,
      };
    }

    const valorPorSaca = round2(parseNumeroBr(precoMatch[1]));
    const dataReferencia = dataMatch ? `${dataMatch[3]}-${dataMatch[2]}-${dataMatch[1]}` : undefined;

    return {
      aplicavel: true,
      valorPorSaca,
      moeda: "BRL",
      dataReferencia,
      fonte: FONTE_CEPEA,
    };
  } catch {
    return { aplicavel: false, pendencia: "Falha ao consultar a CEPEA." };
  }
}

async function buscarTrigo(): Promise<ResultadoReferenciaPreco> {
  try {
    const texto = await fetchTextoVisivel("https://cepea.org.br/br/indicador/trigo.aspx");
    const ancora = texto.indexOf("PREÇO MÉDIO DO TRIGO CEPEA/ESALQ - PARANÁ");
    if (ancora === -1) {
      return { aplicavel: false, pendencia: "Não foi possível localizar a tabela de trigo (Paraná) na CEPEA — layout pode ter mudado." };
    }
    const janela = texto.slice(ancora, ancora + 600);

    // Primeira linha de dados: DD/MM/AAAA seguido do valor R$/t
    const linhaMatch = janela.match(/(\d{2})\/(\d{2})\/(\d{4})\s+([\d.,]+)/);
    if (!linhaMatch) {
      return { aplicavel: false, pendencia: "Não foi possível localizar o valor mais recente de trigo na CEPEA — layout pode ter mudado." };
    }

    const valorPorTonelada = parseNumeroBr(linhaMatch[4]);
    const valorPorSaca = round2((valorPorTonelada / 1000) * 60);
    const dataReferencia = `${linhaMatch[3]}-${linhaMatch[2]}-${linhaMatch[1]}`;

    return {
      aplicavel: true,
      valorPorSaca,
      moeda: "BRL",
      dataReferencia,
      fonte: `${FONTE_CEPEA} (convertido de R$/tonelada — trigo pão, Paraná — para R$/saca de 60kg)`,
    };
  } catch {
    return { aplicavel: false, pendencia: "Falha ao consultar a CEPEA." };
  }
}

export class CepeaPriceReferenceProvider {
  async getReferencia(produto: string): Promise<ResultadoReferenciaPreco> {
    if (produto !== "SOJA" && produto !== "MILHO" && produto !== "TRIGO") {
      return {
        aplicavel: false,
        pendencia: `A CEPEA não possui indicador para ${produto} (cobre apenas soja, milho e trigo).`,
      };
    }

    const cached = cache.get(produto);
    if (cached && cached.expiraEm > Date.now()) {
      return cached.valor;
    }

    const resultado = produto === "TRIGO" ? await buscarTrigo() : await buscarSojaOuMilho(produto);

    if (resultado.aplicavel) {
      cache.set(produto, { valor: resultado, expiraEm: Date.now() + TTL_MS });
    }
    return resultado;
  }
}
