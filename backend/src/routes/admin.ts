import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, operations } from "../db/schema.js";
import { exigirAdmin } from "../middleware/auth.js";
import { encerrarSessoesDoUsuario } from "../services/authService.js";

export const adminRouter = Router();

adminRouter.use(exigirAdmin);

/** GET /api/admin/usuarios — lista com contagem de consultas por pessoa. */
adminRouter.get("/usuarios", async (_req, res, next) => {
  try {
    const linhas = await db
      .select({
        id: users.id,
        nome: users.nome,
        email: users.email,
        avatarUrl: users.avatarUrl,
        papel: users.papel,
        ativo: users.ativo,
        criadoEm: users.criadoEm,
        ultimoAcessoEm: users.ultimoAcessoEm,
        consultas: sql<number>`count(${operations.id})::int`,
      })
      .from(users)
      .leftJoin(operations, eq(operations.userId, users.id))
      .groupBy(users.id)
      .orderBy(desc(users.criadoEm));

    return res.json({ usuarios: linhas });
  } catch (erro) {
    return next(erro);
  }
});

/**
 * PATCH /api/admin/usuarios/:id — ativa/desativa ou muda o papel.
 *
 * Desativar derruba as sessões na hora, senão a pessoa continuaria usando o
 * sistema com o cookie que já tem até ele expirar.
 */
adminRouter.patch("/usuarios/:id", async (req, res, next) => {
  try {
    const { ativo, papel } = req.body ?? {};
    const alvo = req.params.id;

    if (typeof ativo !== "boolean" && papel === undefined) {
      return res.status(400).json({ erro: "Informe 'ativo' (boolean) e/ou 'papel'." });
    }
    if (papel !== undefined && papel !== "ADMIN" && papel !== "USUARIO") {
      return res.status(400).json({ erro: "Papel deve ser ADMIN ou USUARIO." });
    }

    // Um admin não pode desativar nem rebaixar a si mesmo: sem isso, dá para
    // ficar sem nenhum administrador e perder o acesso ao painel de vez.
    if (alvo === req.usuario!.id && (ativo === false || papel === "USUARIO")) {
      return res.status(400).json({ erro: "Você não pode remover o próprio acesso de administrador." });
    }

    const mudancas: Record<string, unknown> = {};
    if (typeof ativo === "boolean") mudancas.ativo = ativo;
    if (papel !== undefined) mudancas.papel = papel;

    const atualizado = await db.update(users).set(mudancas).where(eq(users.id, alvo)).returning();
    if (atualizado.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    if (ativo === false) {
      await encerrarSessoesDoUsuario(alvo);
    }

    return res.json({ usuario: atualizado[0] });
  } catch (erro) {
    return next(erro);
  }
});

/** GET /api/admin/resumo — números gerais de uso. */
adminRouter.get("/resumo", async (_req, res, next) => {
  try {
    const [{ totalUsuarios }] = await db
      .select({ totalUsuarios: sql<number>`count(*)::int` })
      .from(users);
    const [{ ativos }] = await db
      .select({ ativos: sql<number>`count(*) filter (where ${users.ativo})::int` })
      .from(users);
    const [{ totalConsultas }] = await db
      .select({ totalConsultas: sql<number>`count(*)::int` })
      .from(operations);

    return res.json({ totalUsuarios, ativos, inativos: totalUsuarios - ativos, totalConsultas });
  } catch (erro) {
    return next(erro);
  }
});
