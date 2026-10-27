// Hanya dipanggil runner testing setelah guard; tidak membaca .env utama.
import { defineConfig, env } from "prisma/config";
export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: { path: "prisma/migrations" },
    engine: "classic",
    datasource: { url: env("TEST_DATABASE_URL") }
});
