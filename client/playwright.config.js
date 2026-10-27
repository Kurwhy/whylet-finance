import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "./e2e", workers: 1, fullyParallel: false, retries: 0,
    timeout: 45000, expect: { timeout: 8000 },
    reporter: [["./e2e/reporter.js"]], outputDir: "./e2e-results/work",
    projects: [
        { name: "chrome", testMatch: ["**/qa.spec.js", "**/voice.spec.js", "**/email.spec.js"], use: { browserName: "chromium", channel: "chrome", launchOptions: { args: ["--lang=id-ID"] } } },
        { name: "chrome-account", testMatch: "**/account.spec.js", use: { browserName: "chromium", channel: "chrome", launchOptions: { args: ["--lang=id-ID"] } } },
        { name: "firefox", testMatch: "**/smoke.spec.js", use: { browserName: "firefox" } },
        { name: "webkit", testMatch: "**/smoke.spec.js", use: { browserName: "webkit" } }
    ],
    use: { baseURL: "http://127.0.0.1:5174", headless: true, viewport: { width: 1440, height: 900 }, locale: "id-ID", timezoneId: "Asia/Jakarta",
        trace: "off", video: "off", screenshot: "off", actionTimeout: 10000 }
});
