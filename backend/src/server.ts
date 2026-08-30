import express from "express";
import cors from "cors";
import { operationsRouter } from "./routes/operations.js";
import { taxRulesRouter } from "./routes/taxRules.js";
import { priceReferenceRouter } from "./routes/priceReference.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok", servico: "logpro-backend" }));
app.use("/api/operations", operationsRouter);
app.use("/api/tax-rules", taxRulesRouter);
app.use("/api/price-reference", priceReferenceRouter);

const PORT = Number(process.env.PORT ?? 3333);
app.listen(PORT, () => {
  console.log(`LogPro backend rodando em http://localhost:${PORT}`);
});
