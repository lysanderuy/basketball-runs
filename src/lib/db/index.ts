import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle>;
};

// `prepare: false` required for Supabase pgBouncer (transaction mode pooler)
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = globalForDb.db ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
