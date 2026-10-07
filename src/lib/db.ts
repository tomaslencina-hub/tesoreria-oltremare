import Database from "@tauri-apps/plugin-sql";

// Debe coincidir con DB_URL en src-tauri/src/lib.rs (ahí se registran las migraciones).
const DB_URL = "sqlite:tesoreria.db";

let instancia: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!instancia) {
    instancia = Database.load(DB_URL).then(async (db) => {
      await db.execute("PRAGMA foreign_keys = ON");
      return db;
    });
  }
  return instancia;
}

export async function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, params);
}

export async function execute(sql: string, params: unknown[] = []) {
  const db = await getDb();
  return db.execute(sql, params);
}
