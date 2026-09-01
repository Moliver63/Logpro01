/**
 * Distância rodoviária real entre dois municípios brasileiros, usando só
 * fontes gratuitas:
 *
 * 1. Nominatim (OpenStreetMap) geocodifica "Município, UF" em coordenadas.
 * 2. OSRM calcula a distância da rota rodoviária entre elas.
 *
 * A distância é insumo do piso mínimo ANTT e da comparação de frete —
 * digitada errada, distorce os dois. Por isso o sistema calcula quando o
 * usuário não informa, marcando o valor como `api_externa` até a interface.
 *
 * Convivência com serviço público gratuito: User-Agent identificado
 * (exigência da política de uso do Nominatim), timeout curto e cache em
 * memória com TTL (sucesso por 7 dias — geografia não muda; falha por
 * 5 minutos — transitório não vira pendência permanente).
 *
 * Regra de ouro: qualquer falha vira `ok: false` com motivo. Este módulo
 * nunca estima distância.
 */

export interface PontoRota {
  municipio: string;
  uf: string;
}

export const ATRIBUICAO_OSM = "© OpenStreetMap contributors (ODbL) — geocodificação Nominatim, rota OSRM";

export type ResultadoDistancia =
  | { ok: true; distanciaKm: number; origemDado: "api_externa"; provedor: string; atribuicao: string }
  | { ok: false; motivo: string };

interface Coordenadas {
  lat: number;
  lon: number;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const USER_AGENT = "LogPro/0.1 (https://github.com/Moliver63/Logpro01)";
const TIMEOUT_MS = 8_000;
const TTL_SUCESSO_MS = 7 * 24 * 60 * 60 * 1000;
const TTL_FALHA_MS = 5 * 60 * 1000;

interface EntradaCache<T> {
  valor: T;
  expiraEm: number;
}

const cacheCoordenadas = new Map<string, EntradaCache<Coordenadas | null>>();
const cacheDistancia = new Map<string, EntradaCache<ResultadoDistancia>>();

/** Usado só pelos testes, para isolar um caso do outro. */
export function limparCachesDistancia(): void {
  cacheCoordenadas.clear();
  cacheDistancia.clear();
}

function chaveLocal(p: PontoRota): string {
  return `${p.municipio.trim().toLowerCase()}|${p.uf.trim().toUpperCase()}`;
}

function doCache<T>(cache: Map<string, EntradaCache<T>>, chave: string): T | undefined {
  const entrada = cache.get(chave);
  if (!entrada) return undefined;
  if (Date.now() > entrada.expiraEm) {
    cache.delete(chave);
    return undefined;
  }
  return entrada.valor;
}

function paraCache<T>(cache: Map<string, EntradaCache<T>>, chave: string, valor: T, ttlMs: number): void {
  cache.set(chave, { valor, expiraEm: Date.now() + ttlMs });
}

function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

async function geocodificar(ponto: PontoRota): Promise<Coordenadas | null> {
  const chave = chaveLocal(ponto);
  const emCache = doCache(cacheCoordenadas, chave);
  if (emCache !== undefined) return emCache;

  let coordenadas: Coordenadas | null = null;
  try {
    const consulta = encodeURIComponent(`${ponto.municipio}, ${ponto.uf}, Brasil`);
    const resposta = await fetch(`${NOMINATIM_URL}?format=json&limit=1&countrycodes=br&q=${consulta}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (resposta.ok) {
      const dados = (await resposta.json()) as Array<{ lat: string; lon: string }>;
      const primeiro = dados[0];
      if (primeiro) {
        coordenadas = { lat: Number.parseFloat(primeiro.lat), lon: Number.parseFloat(primeiro.lon) };
      }
    }
  } catch {
    coordenadas = null;
  }

  paraCache(cacheCoordenadas, chave, coordenadas, coordenadas ? TTL_SUCESSO_MS : TTL_FALHA_MS);
  return coordenadas;
}

export async function calcularDistanciaRodoviaria(
  origem: PontoRota,
  destino: PontoRota
): Promise<ResultadoDistancia> {
  const chave = `${chaveLocal(origem)}->${chaveLocal(destino)}`;
  const emCache = doCache(cacheDistancia, chave);
  if (emCache !== undefined) return emCache;

  const resultado = await calcularSemCache(origem, destino);
  paraCache(cacheDistancia, chave, resultado, resultado.ok ? TTL_SUCESSO_MS : TTL_FALHA_MS);
  return resultado;
}

async function calcularSemCache(origem: PontoRota, destino: PontoRota): Promise<ResultadoDistancia> {
  // Sequencial de propósito: a política de uso do Nominatim pede no máximo
  // 1 requisição por segundo.
  const coordOrigem = await geocodificar(origem);
  if (!coordOrigem) {
    return { ok: false, motivo: `município de origem não localizado (${origem.municipio}/${origem.uf})` };
  }
  const coordDestino = await geocodificar(destino);
  if (!coordDestino) {
    return { ok: false, motivo: `município de destino não localizado (${destino.municipio}/${destino.uf})` };
  }

  try {
    const url =
      `${OSRM_URL}/${coordOrigem.lon},${coordOrigem.lat};${coordDestino.lon},${coordDestino.lat}` +
      `?overview=false`;
    const resposta = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resposta.ok) {
      return { ok: false, motivo: `serviço de rotas respondeu HTTP ${resposta.status}` };
    }
    const dados = (await resposta.json()) as {
      code?: string;
      routes?: Array<{ distance: number }>;
    };
    const metros = dados.routes?.[0]?.distance;
    if (dados.code !== "Ok" || !metros || metros <= 0) {
      return { ok: false, motivo: "serviço de rotas não encontrou caminho rodoviário entre os municípios" };
    }
    return {
      ok: true,
      distanciaKm: round1(metros / 1000),
      origemDado: "api_externa",
      provedor: "OpenStreetMap/OSRM",
      atribuicao: ATRIBUICAO_OSM,
    };
  } catch {
    return { ok: false, motivo: "serviço de rotas indisponível ou sem resposta" };
  }
}
