// One-time setup: creates the survey database's collections and indexes.
// Run: node --env-file=.env.local scripts/setup-db.mjs
// Only touches the database named in MONGODB_DB (default "noticed").
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");
const name = process.env.MONGODB_DB || "noticed";

const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 15000 }).connect();
try {
  const db = client.db(name);
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const c of ["responses", "contacts"]) if (!existing.has(c)) await db.createCollection(c);
  await db.collection("responses").createIndex({ respondentId: 1 }, { unique: true });
  await db.collection("responses").createIndex({ submittedAt: -1 });
  await db.collection("responses").createIndex({ "answers.A5": 1, branch: 1 });
  await db.collection("contacts").createIndex({ respondentId: 1 }, { unique: true });
  // One person per phone / email (only enforced when the field is present).
  for (const key of ["phoneKey", "emailKey"])
    await db.collection("contacts").createIndex({ [key]: 1 }, { unique: true, partialFilterExpression: { [key]: { $type: "string" } } });
  console.log(`DB "${name}" ready:`, (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
} finally {
  await client.close();
}
