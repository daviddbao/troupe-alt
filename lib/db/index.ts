import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 10,
})
export const db = drizzle(client, { schema })
