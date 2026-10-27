
import "dotenv/config";
import app from "./app.js";

import { assertEnvironment } from "./config/environment.js";

assertEnvironment();

const PORT = Number(process.env.PORT) || 5001;

const server = app.listen(PORT, () => {
    console.log(
        `Whylet API running on http://localhost:${PORT}`
    );
});

server.on("error", (error) => {
    console.error({ event: "server_error", code: error.code || "UNKNOWN" });
    process.exitCode = 1;
});

let stopping = false;
async function shutdown() {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => server.closeAllConnections(), 30000);
    timeout.unref();
    await new Promise(resolve => server.close(resolve));
    const { default: prisma } = await import("./config/prisma.js");
    await prisma.$disconnect();
    clearTimeout(timeout);
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
