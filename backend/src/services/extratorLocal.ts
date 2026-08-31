/**
 * extratorLocal
 *
 * Fallback determinístico, sem nenhuma dependência de IA externa — roda
 * inteiramente no seu servidor, sempre disponível, custo zero. Usado quando
 * todos os assistentes estão fora do ar (depois de esgotar as tentativas de
 * retry) ou sem chave configurada, pra o chat continuar funcionando de
 * algum jeito em vez de simplesmente falhar.
 *
 * REGRA DE OURO (igual ao resto do sistema): se não conseguir extrair um
 * campo com confiança, NÃO adivinha — declara que falta e para. Nunca
 * inventa cidade, estado ou preço que não apareceu explicitamente no texto.
 *
 * Em particular: origem e destino são ancorados no verbo que os acompanha
 * ("compro ... em X", "vendo ... em Y"), NÃO na ordem em que aparecem no
 * texto. Isso evita inverter a rota quando o usuário escreve a venda antes
 * da compra — inversão que produziria tributos da rota errada sem nenhum
 * aviso, que é o pior tipo de erro possível aqui.
 */

export interface CamposExtraidos {
  produto?: "SOJA" | "MILHO" | "TRIGO" | "SORGO";
  quantidadeSacas?: number;
  precoCompraPorSaca?: number;
  precoVendaPorSaca?: number;
  municipioOrigem?: string;
  estadoOrigem?: string;
  municipioDestino?: string;
  estadoDestino?: string;
  fretePorTonelada?: number;
}

const CAMPOS_OBRIGATORIOS = [
  "produto",
  "quantidadeSacas",
  "precoCompraPorSaca",
  "precoVendaPorSaca",
  "municipioOrigem",
  "estadoOrigem",
  "municipioDestino",
  "estadoDestino",
  "fretePorTonelada",
] as const;

/** Siglas de UF válidas — usado pra validar o estado e pra não confundir sigla com nome de cidade. */
const UFS_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

function parseNumeroBr(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

/** Encontra "<Cidade> <UF>" logo depois de uma posição no texto. Retorna null se não achar. */
function localDepoisDe(texto: string, posicaoInicial: number): { municipio: string; estado: string } | null {
  const trecho = texto.slice(posicaoInicial);
  // Cidade: uma ou mais palavras começando com maiúscula, aceitando
  // conectivos minúsculos no meio ("São José do Rio Preto", "Campo Verde",
  // "Santo Antônio de Pádua"). Seguida da sigla do estado.
  const padrao =
    /\b([A-ZÀ-Ú][a-zà-ú']+(?:[\s-](?:d[aeio]s?|D[AEIO]S?|[A-ZÀ-Ú][a-zà-ú']+)){0,4})\s*[\/,-]?\s*\b([A-Z]{2})\b/g;

  for (const m of trecho.matchAll(padrao)) {
    const municipio = m[1].trim();
    const estado = m[2].toUpperCase();
    // O "município" capturado não pode ser ele mesmo uma sigla de UF
    // (evita casar coisas como "MT SP" e tratar MT como cidade).
    if (!UFS_VALIDAS.has(estado)) continue;
    if (UFS_VALIDAS.has(municipio.toUpperCase())) continue;
    return { municipio, estado };
  }
  return null;
}

export function extrairDoTexto(texto: string): { campos: CamposExtraidos; faltando: string[] } {
  const campos: CamposExtraidos = {};

  const produtoMatch = texto.match(/\b(soja|milho|trigo|sorgo)\b/i);
  if (produtoMatch) {
    campos.produto = produtoMatch[1].toUpperCase() as CamposExtraidos["produto"];
  }

  const sacasMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*(mil\s+)?sacas?/i);
  if (sacasMatch) {
    let n = parseNumeroBr(sacasMatch[1]);
    if (sacasMatch[2]) n *= 1000;
    campos.quantidadeSacas = n;
  }

  const compraMatch = texto.match(/compr\w*[^\d]{0,20}(\d+(?:[.,]\d{1,2})?)/i);
  if (compraMatch) campos.precoCompraPorSaca = parseNumeroBr(compraMatch[1]);

  const vendaMatch = texto.match(/vend\w*[^\d]{0,20}(\d+(?:[.,]\d{1,2})?)/i);
  if (vendaMatch) campos.precoVendaPorSaca = parseNumeroBr(vendaMatch[1]);

  const freteMatch = texto.match(/frete[^\d]{0,20}(\d+(?:[.,]\d{1,2})?)/i);
  if (freteMatch) campos.fretePorTonelada = parseNumeroBr(freteMatch[1]);

  // ---- Origem e destino, ancorados semanticamente ----
  //
  // Origem = local que vem depois de "compro/compra"; destino = depois de
  // "vendo/venda". Se um dos dois verbos não aparecer, deixamos o campo
  // vazio e ele entra em `faltando` — nunca preenchemos pela ordem do texto.
  const posCompra = texto.search(/compr\w*/i);
  const posVenda = texto.search(/vend\w*/i);

  if (posCompra !== -1) {
    const local = localDepoisDe(texto, posCompra);
    if (local) {
      campos.municipioOrigem = local.municipio;
      campos.estadoOrigem = local.estado;
    }
  }

  if (posVenda !== -1) {
    const local = localDepoisDe(texto, posVenda);
    if (local) {
      campos.municipioDestino = local.municipio;
      campos.estadoDestino = local.estado;
    }
  }

  // Se compra e venda apontaram para o MESMO trecho de texto (ex: o usuário
  // só citou um local), não dá pra saber a rota — descarta o destino em vez
  // de assumir que é igual à origem.
  if (
    campos.municipioOrigem &&
    campos.municipioDestino &&
    campos.municipioOrigem === campos.municipioDestino &&
    campos.estadoOrigem === campos.estadoDestino &&
    posCompra !== -1 &&
    posVenda !== -1 &&
    localDepoisDe(texto, Math.max(posCompra, posVenda)) !== null &&
    localDepoisDe(texto, Math.min(posCompra, posVenda))?.municipio ===
      localDepoisDe(texto, Math.max(posCompra, posVenda))?.municipio
  ) {
    // Só um local no texto todo — mantém como origem, tira o destino.
    if (posCompra < posVenda) {
      delete campos.municipioDestino;
      delete campos.estadoDestino;
    } else {
      delete campos.municipioOrigem;
      delete campos.estadoOrigem;
    }
  }

  const faltando = CAMPOS_OBRIGATORIOS.filter((c) => campos[c] === undefined);

  return { campos, faltando };
}

const NOMES_CAMPOS: Record<string, string> = {
  produto: "produto (soja, milho, trigo ou sorgo)",
  quantidadeSacas: "quantidade de sacas",
  precoCompraPorSaca: "preço de compra por saca",
  precoVendaPorSaca: "preço de venda por saca",
  municipioOrigem: "cidade de origem (onde você compra)",
  estadoOrigem: "estado de origem (sigla, ex: MT)",
  municipioDestino: "cidade de destino (onde você vende)",
  estadoDestino: "estado de destino (sigla, ex: SP)",
  fretePorTonelada: "frete por tonelada",
};

export function descreverCamposFaltando(faltando: string[]): string {
  return faltando.map((c) => NOMES_CAMPOS[c] ?? c).join(", ");
}
