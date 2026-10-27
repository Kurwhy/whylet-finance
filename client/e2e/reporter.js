import { mkdirSync, writeFileSync } from "node:fs";
export default class SafeReporter {
    results = [];
    onTestEnd(test, result) {
        const item = { title: test.title, project: test.parent.project()?.name || "unknown", status: result.status === "passed" ? "PASS" : result.status === "skipped" ? "NOT TESTED" : "FAIL",
            durationMs: result.duration,
            ...(result.errors.length ? { reason: "E2E_ASSERTION_OR_RUNTIME_FAILURE", location: result.errors[0].location ? { file: result.errors[0].location.file.split("/").pop(), line: result.errors[0].location.line } : undefined } : {}) };
        if (result.errors.length) {
            const line = /qa\.spec\.js:(\d+)/.exec(result.errors[0].stack || "");
            if (!item.location && line) item.location = { file: "qa.spec.js", line: Number(line[1]) };
            const assertion = ["toBeFocused", "toBeVisible", "toHaveURL", "toHaveValue", "toContainText", "toBeEnabled", "toBeDisabled", "toBeLessThanOrEqual", "toBe", "toEqual"].find(name => (result.errors[0].message || "").includes(name + "("));
            if (assertion) item.assertion = assertion;
        }
        this.results.push(item);
        console.log(`${item.title} [${item.project}]: ${item.status}${item.location ? ` (baris ${item.location.line})` : ""}`);
    }
    onError() { console.log("E2E_RUNNER_ERROR: detail sensitif tidak dicetak."); }
    onEnd(result) {
        mkdirSync("e2e-results", { recursive: true });
        writeFileSync("e2e-results/latest.json", JSON.stringify({ timestamp: new Date().toISOString(), status: result.status, results: this.results }, null, 2) + "\n", { mode: 0o600 });
    }
}
