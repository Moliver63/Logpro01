import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

/**
 * Conexão com o Postgres (Render).
 *
 * Antes era SQLite em arquivo local. Trocado porque o disco do plano
 * gratuito do Render é efêmero — o banco era recriado a cada redeploy, o
 * que inviabiliza contas de usuário e histórico de consultas.
 *
 * `DATABASE_URL` é fornecida pelo Render. Em produção a conexão exige TLS,
 * mas o certificado é interno da plataforma, daí `rejectUnauthorized: false`.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL não configurada. Aponte para o Postgres (no Render, use a Internal Database URL)."
  );
}

const precisaSsl = !/localhost|127\.0\.0\.1/.test(connectionString);

export const pool = new pg.Pool({
  connectionString,
  ssl: precisaSsl ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

export const db = drizzle(pool, { schema });
