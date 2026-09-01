import type { Request, Response, NextFunction } from "express";
import { SESSION_COOKIE, usuarioDaSessao, type UsuarioSessao } from "../services/authService.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioSessao | null;
    }
  }
}

/**
 * Anexa o usuário da sessão à requisição, quando houver. Não bloqueia nada —
 * rotas públicas (o cálculo continua aberto) seguem funcionando sem login,
 * só que a operação fica sem dono e não aparece em nenhum dashboard.
 */
export async function carregarUsuario(req: Request, _res: Response, next: NextFunction) {
  try {
    req.usuario = await usuarioDaSessao(req.cookies?.[SESSION_COOKIE]);
  } catch {
    req.usuario = null;
  }
  next();
}

/** Exige sessão válida. */
export function exigirLogin(req: Request, res: Response, next: NextFunction) {
  if (!req.usuario) {
    return res.status(401).json({ erro: "Faça login para continuar." });
  }
  next();
}

/** Exige sessão válida com papel de administrador. */
export function exigirAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.usuario) {
    return res.status(401).json({ erro: "Faça login para continuar." });
  }
  if (req.usuario.papel !== "ADMIN") {
    // 404 em vez de 403 para não confirmar a existência da área de admin a
    // quem não deveria enxergá-la.
    return res.status(404).json({ erro: "Não encontrado." });
  }
  next();
}
