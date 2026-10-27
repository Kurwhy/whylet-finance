import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
let driver, session;
let outcome = { browser: "Safari native", status: "NOT TESTED", reason: "REMOTE_AUTOMATION_NOT_READY" };
const base = "http://127.0.0.1:5003";
try {
    await new Promise((resolve, reject) => { const probe = createServer(); probe.once("error", reject); probe.listen(5003, "127.0.0.1", () => probe.close(resolve)); });
    driver = spawn("/usr/bin/safaridriver", ["--port", "5003"], { stdio: "ignore" });
    driver.on("error", () => {});
    for (let i=0;i<20;i++) {
        try { if ((await fetch(`${base}/status`)).ok) break; } catch { /* Tunggu driver. */ }
        await new Promise(resolve => setTimeout(resolve,250));
    }
    const response = await fetch(`${base}/session`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({capabilities:{alwaysMatch:{browserName:"safari"}}}), signal:AbortSignal.timeout(15000) });
    const value = (await response.json()).value;
    session = value?.sessionId;
    if (response.ok && session) outcome = { browser:"Safari native", status:"NOT TESTED", reason:"DRIVER_READY_SMOKE_PENDING" };
} catch { /* Pesan OS, ID sesi, dan profil browser tidak dicetak. */ }
finally {
    if(session) await fetch(`${base}/session/${session}`,{method:"DELETE"}).catch(()=>{});
    driver?.kill("SIGTERM");
    mkdirSync("tests/integration/results",{recursive:true});
    writeFileSync("tests/integration/results/safari-readiness.json",JSON.stringify(outcome,null,2)+"\n");
    console.log(`Safari native: ${outcome.status} — ${outcome.reason}`);
}
