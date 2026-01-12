import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, "data.json");
const adapter = new JSONFile(file);

export const db = new Low(adapter, { scores: [] });

export async function initDB() {
  await db.read();
  db.data ||= { scores: [] };
  await db.write();
}
