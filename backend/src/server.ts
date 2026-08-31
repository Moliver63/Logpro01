import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { operationsRouter } from "./routes/operations.js";
import { taxRulesRouter } from "./routes/taxRules.js";
import { priceReferenceRouter } from "./routes/priceReference.js";
import { chatRouter } from "./routes/chat.js";
import { transerveRouter } from "./routes/transerve.js";

const app = express();

// Atrás do proxy do Render — necessário pro rate limit enxergar o IP real
// do cliente em vez do IP do proxy (senão todo mundo divide o mesmo limite).
app.set("trust proxy", 1);

/**
 * CORS restrito à origem do frontend. Antes estava aberto para qualquer
 * origem, o que deixava o endpoint de chat (que consome cota paga de IA)
 * acessível de qualquer site. Configure FRONTEND_ORIGIN no ambiente; sem
 * isso, cai no domínio de produção conhecido.
 */
const ORIGENS_PERMITIDAS = (
  process.env.FRONTEND_ORIGIN ?? "https://logpro-frontend.onrender.com"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Requisições sem Origin (curl, healthcheck do Render, apps nativos)
      // são permitidas — o navegador é quem envia Origin.
      if (!origin) return callback(null, true);
      if (ORIGENS_PERMITIDAS.includes(origin)) return callback(null, true);
      // Liberar localhost é opt-in explícito, para desenvolvimento local.
      // Não depende de NODE_ENV de propósito: definir NODE_ENV=production
      // faz o npm pular devDependencies e quebra o build no Render.
      if (process.env.PERMITIR_CORS_LOCALHOST === "true" && origin.startsWith("http://localhost")) {
        return callback(null, true);
      }
      return callback(new Error("Origem não permitida pelo CORS"));
    },
  })
);

app.use(express.json({ limit: "256kb" }));

/** Limite geral — protege contra abuso das rotas de cálculo. */
const limiteGeral = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde um momento e tente de novo." },
});

/**
 * Limite mais apertado no chat: cada mensagem consome cota de assistente
 * externo, que é finita e paga. Sem isso, qualquer pessoa com a URL do
 * backend consegue esgotar a cota diária em minutos.
 */
const limiteChat = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { erro: "Muitas mensagens seguidas. Aguarde um momento e tente de novo." },
});

app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    servico: "logpro-backend",
    ambiente: process.env.RENDER ? "render" : process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
  })
);
app.use("/api/operations", limiteGeral, operationsRouter);
app.use("/api/tax-rules", limiteGeral, taxRulesRouter);
app.use("/api/price-reference", limiteGeral, priceReferenceRouter);
app.use("/api/chat", limiteChat, chatRouter);
app.use("/api/transerve", limiteGeral, transerveRouter);

/**
 * Handler de erro central. O Express 4 não captura exceção lançada dentro
 * de handler `async` — sem isso, um erro no meio do cálculo deixava a
 * requisição pendurada pra sempre (usuário vendo "Calculando…" sem fim) e
 * gerava unhandled rejection no processo. As rotas async agora encaminham o
 * erro para cá via next(erro).
 */
app.use((erro: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (erro.message === "Origem não permitida pelo CORS") {
    return res.status(403).json({ erro: "Origem não permitida." });
  }
  console.error("Erro não tratado:", erro);
  if (res.headersSent) return;
  res.status(500).json({ erro: "Erro interno ao processar a requisição." });
});

const PORT = Number(process.env.PORT ?? 3333);
app.listen(PORT, () => {
  console.log(`LogPro backend rodando em http://localhost:${PORT}`);
});
