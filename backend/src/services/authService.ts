import { randomUUID, randomBytes } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db/client.js";
import { users, sessions } from "../db/schema.js";

/**
 * Autenticação via Google (OAuth 2.0) com sessão em banco.
 *
 * A sessão fica no Postgres, não só num JWT assinado, porque o admin
 * precisa conseguir revogar acesso de fato: desativar um usuário derruba as
 * sessões dele na próxima requisição, em vez de esperar um token expirar.
 *
 * O identificador de conta é o `sub` do Google (aqui `googleId`), não o
 * e-mail — o e-mail pode mudar, o sub não. O e-mail é guardado só para
 * exibição e para o admin reconhecer quem é quem.
 */

export const SESSION_COOKIE = "logpro_sessao";
const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
  papel: string;
  ativo: boolean;
}

export function authConfigurado(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  const base = process.env.BACKEND_PUBLIC_URL ?? "http://localhost:3333";
  return `${base}/api/auth/google/callback`;
}

function oauthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: redirectUri(),
  });
}

/** URL para onde o navegador é enviado para o usuário escolher a conta Google. */
export function urlAutorizacao(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });
}

interface PerfilGoogle {
  sub: string;
  email: string;
  nome: string;
  avatarUrl: string | null;
}

/** Troca o `code` do callback pelo perfil do usuário, validando o id_token. */
export async function perfilDoCodigo(code: string): Promise<PerfilGoogle> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.id_token) {
    throw new Error("Google não devolveu id_token.");
  }

  // verifyIdToken confere assinatura, emissor e audiência. Sem isso, um
  // token de outro app poderia ser aceito aqui.
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Perfil do Google incompleto.");
  }
  if (payload.email_verified === false) {
    throw new Error("E-mail do Google não verificado.");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    nome: payload.name ?? payload.email,
    avatarUrl: payload.picture ?? null,
  };
}

/**
 * Encontra ou cria o usuário correspondente ao perfil.
 *
 * Casa primeiro por googleId; se não achar, tenta por e-mail (conta criada
 * antes do login existir, ou promovida a admin pelo seed antes do primeiro
 * acesso) e vincula o googleId a ela.
 */
export async function encontrarOuCriarUsuario(perfil: PerfilGoogle): Promise<UsuarioSessao> {
  const agora = new Date().toISOString();
  const emailNormalizado = perfil.email.trim().toLowerCase();

  const porGoogleId = await db.select().from(users).where(eq(users.googleId, perfil.sub)).limit(1);
  let registro = porGoogleId[0];

  if (!registro) {
    const porEmail = await db.select().from(users).where(eq(users.email, emailNormalizado)).limit(1);
    registro = porEmail[0];

    if (registro) {
      await db
        .update(users)
        .set({ googleId: perfil.sub, avatarUrl: perfil.avatarUrl, ultimoAcessoEm: agora })
        .where(eq(users.id, registro.id));
    } else {
      const novo = {
        id: randomUUID(),
        nome: perfil.nome,
        email: emailNormalizado,
        criadoEm: agora,
        googleId: perfil.sub,
        avatarUrl: perfil.avatarUrl,
        papel: "USUARIO",
        ativo: true,
        ultimoAcessoEm: agora,
      };
      await db.insert(users).values(novo);
      registro = novo as typeof registro;
    }
  } else {
    await db
      .update(users)
      .set({ nome: perfil.nome, avatarUrl: perfil.avatarUrl, ultimoAcessoEm: agora })
      .where(eq(users.id, registro.id));
  }

  return {
    id: registro.id,
    nome: perfil.nome,
    email: registro.email,
    avatarUrl: perfil.avatarUrl,
    papel: registro.papel,
    ativo: registro.ativo,
  };
}

export async function criarSessao(userId: string): Promise<{ id: string; expiraEm: Date }> {
  const id = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  await db.insert(sessions).values({
    id,
    userId,
    criadoEm: new Date().toISOString(),
    expiraEm: expiraEm.toISOString(),
  });
  return { id, expiraEm };
}

/** Resolve o cookie de sessão para um usuário. Devolve null se inválida, expirada ou se o usuário foi desativado. */
export async function usuarioDaSessao(sessionId: string | undefined): Promise<UsuarioSessao | null> {
  if (!sessionId) return null;

  const linhas = await db
    .select({
      userId: users.id,
      nome: users.nome,
      email: users.email,
      avatarUrl: users.avatarUrl,
      papel: users.papel,
      ativo: users.ativo,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiraEm, new Date().toISOString())))
    .limit(1);

  const u = linhas[0];
  if (!u) return null;
  // Usuário desativado pelo admin perde acesso imediatamente, mesmo com
  // sessão ainda dentro da validade.
  if (!u.ativo) return null;

  return {
    id: u.userId,
    nome: u.nome,
    email: u.email,
    avatarUrl: u.avatarUrl,
    papel: u.papel,
    ativo: u.ativo,
  };
}

export async function encerrarSessao(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Derruba todas as sessões de um usuário — usado quando o admin o desativa. */
export async function encerrarSessoesDoUsuario(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
