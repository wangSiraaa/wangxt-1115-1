import { getDb, saveDb } from "./database";
import type { Database } from "sql.js";

let inTx = false;

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  const results: T[] = [];
  stmt.bind(params || []);
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

export async function run(sql: string, params?: any[]): Promise<void> {
  const db = await getDb();
  db.run(sql, params || []);
  if (inTx === false) {
    saveDb();
  }
}

export async function runNamed(sql: string, params: Record<string, any>): Promise<void> {
  const paramList: any[] = [];
  const convertedSql = sql.replace(/@(\w+)/g, (match, name) => {
    paramList.push(params[name]);
    return "?";
  });
  await run(convertedSql, paramList);
}

export async function transaction(fn: () => Promise<void>): Promise<void> {
  const db = await getDb();
  const prevInTx = inTx;
  inTx = true;
  db.run("BEGIN TRANSACTION");
  try {
    await fn();
    db.run("COMMIT");
    inTx = prevInTx;
    saveDb();
  } catch (e) {
    try { db.run("ROLLBACK"); } catch (re) { }
    inTx = prevInTx;
    throw e;
  }
}

