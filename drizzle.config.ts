import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/pages/background/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
});
