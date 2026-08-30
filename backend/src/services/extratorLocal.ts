/**
 * extratorLocal
 *
 * Fallback determinístico, sem nenhuma dependência de IA externa — roda
 * inteiramente no seu servidor, sempre disponível, custo zero. Usado quando
 * o Gemini está fora do ar (depois de esgotar as tentativas de retry) ou
 * sem chave configurada, pra o chat continuar funcionando de algum jeito
 * em vez de simplesmente falhar.
 *
 * Mesma regra de ouro do resto do sistema: se não conseguir extrair um
 * campo com confiança, não adivinha — declara que falta e para. Nunca
 * inventa cidade, estado ou preço que não apareceu explicitamente no texto.
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
] as const;

function parseNumeroBr(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
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

  // Padrão "<Cidade> <UF>" ou "<Cidade>/<UF>" — pega as duas primeiras
  // ocorrências como origem e destino, nessa ordem. Exige letra maiúscula
  // inicial na cidade e exatamente 2 letras maiúsculas pro estado, pra
  // reduzir falso positivo.
  const localPattern = /\b([A-ZÀ-Ú][a-zà-úA-ZÀ-Ú]*(?:\s[A-ZÀ-Ú][a-zà-úA-ZÀ-Ú]*){0,3})\s*[\/,-]?\s*\b([A-Z]{2})\b/g;
  const locais = [...texto.matchAll(localPattern)].filter(
    (m) => !["MT", "MS", "SP", "PR", "RS", "GO", "MG", "BA", "MA"].includes(m[1].toUpperCase())
  );

  if (locais[0]) {
    campos.municipioOrigem = locais[0][1].trim();
    campos.estadoOrigem = locais[0][2].toUpperCase();
  }
  if (locais[1]) {
    campos.municipioDestino = locais[1][1].trim();
    campos.estadoDestino = locais[1][2].toUpperCase();
  }

  const faltando = CAMPOS_OBRIGATORIOS.filter((c) => campos[c] === undefined);

  return { campos, faltando };
}

const NOMES_CAMPOS: Record<string, string> = {
  produto: "produto (soja, milho, trigo ou sorgo)",
  quantidadeSacas: "quantidade de sacas",
  precoCompraPorSaca: "preço de compra por saca",
  precoVendaPorSaca: "preço de venda por saca",
  municipioOrigem: "município de origem",
  estadoOrigem: "estado de origem (sigla, ex: MT)",
  municipioDestino: "município de destino",
  estadoDestino: "estado de destino (sigla, ex: SP)",
};

export function descreverCamposFaltando(faltando: string[]): string {
  return faltando.map((c) => NOMES_CAMPOS[c] ?? c).join(", ");
}
