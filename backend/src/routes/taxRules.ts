import { Router } from "express";
import { carregarRegrasAtivas } from "../db/taxRulesRepo.js";

export const taxRulesRouter = Router();

/** Lista as regras cadastradas — usado pela UI para avisar o usuário sobre cobertura antes de calcular. */
taxRulesRouter.get("/", async (_req, res) => {
  const regras = await carregarRegrasAtivas();
  res.json({ regras, total: regras.length });
});
