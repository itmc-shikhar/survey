import { MongoClient, type Db } from "mongodb";

// Reuse one client across hot reloads and serverless invocations.
const g = globalThis as unknown as { _mongo?: Promise<MongoClient> };

export async function db(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  g._mongo ??= new MongoClient(uri).connect();
  return (await g._mongo).db(process.env.MONGODB_DB || "noticed");
}
