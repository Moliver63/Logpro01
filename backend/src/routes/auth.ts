import { Router } from "express";
import { randomBytes } from "node:crypto";
import {
  SESSION_COOKIE,
  authConfigurado,
  urlAutorizacao,
  perfilDoCodigo,
  encontrarOuCriarUsuario,
  criarSessao,
  encerrarSessao,
} from "../services/authService.js";

export const authRouter = Router();

const STATE_COOKIE = "logpro_oauth_state";

function frontendUrl(): string {
  const origens = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173").split(",");
  return origens[0].trim();
}

/** Cookies de sessão e de state: httpOnly sempre; Secure/SameSite=None em produção porque frontend e backend estão em domínios diferentes. */
function opcoesCookie(maxAgeMs: number) {
  const producao = !!process.env.BACKEND_PUBLIC_URL?.startsWith("https://");
  return {
    httpOnly: true,
    secure: producao,
    sameSite: producao ? ("none" as const) : ("lax" as const),
    maxAge: maxAgeMs,
    path: "/",
  };
}

/** GET /api/auth/google — inicia o login redirecionando para o Google. */
authRouter.get("/google", (req, res) => {
  if (!authConfigurado()) {
    return res.status(503).json({ erro: "Login com Google não configurado neste ambiente." });
  }

  // `state` protege contra CSRF no fluxo OAuth: o valor vai para o Google e
  // precisa voltar igual ao que guardamos no cookie.
  const state = randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, opcoesCookie(10 * 60 * 1000));
  res.redirect(urlAutorizacao(state));
});

/** GET /api/auth/google/callback — o Google devolve o usuário aqui. */
authRouter.get("/google/callback", async (req, res) => {
  const destinoErro = `${frontendUrl()}/?erro_login=1`;

  try {
    const { code, state } = req.query as { code?: string; state?: string };
    const stateEsperado = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: "/" });

    if (!code || !state || !stateEsperado || state !== stateEsperado) {
      return res.redirect(destinoErro);
    }

    const perfil = await perfilDoCodigo(code);
    const usuario = await encontrarOuCriarUsuario(perfil);

    if (!usuario.ativo) {
      return res.redirect(`${frontendUrl()}/?erro_login=desativado`);
    }

    const sessao = await criarSessao(usuario.id);
    res.cookie(SESSION_COOKIE, sessao.id, opcoesCookie(sessao.expiraEm.getTime() - Date.now()));

    return res.redirect(frontendUrl());
  } catch (erro) {
    console.error("[auth] falha no callback do Google:", erro);
    return res.redirect(destinoErro);
  }
});

/** GET /api/auth/me — quem está logado (ou null). Usado pelo frontend na abertura. */
authRouter.get("/me", (req, res) => {
  res.json({
    autenticado: !!req.usuario,
    loginDisponivel: authConfigurado(),
    usuario: req.usuario ?? null,
  });
});

/** POST /api/auth/logout */
authRouter.post("/logout", async (req, res, next) => {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (sessionId) await encerrarSessao(sessionId);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    return res.json({ ok: true });
  } catch (erro) {
    return next(erro);
  }
});
