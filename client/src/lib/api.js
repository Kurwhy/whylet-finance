import axios from "axios";
import { apiOrigins } from "../utils/apiOrigin";

const api = axios.create({
    baseURL:
        import.meta.env.VITE_API_URL ||
        "http://localhost:5001/api/v1",

    withCredentials: true,
    timeout: 15000
});

const SAFE_METHODS = new Set([
    "get",
    "head",
    "options"
]);

let csrfToken = null;
let csrfPromise = null;

export function resetCsrfToken() {
    csrfToken = null;
    csrfPromise = null;
}

async function fetchCsrfToken() {
    if (csrfToken) return csrfToken;

    if (!csrfPromise) {
        csrfPromise = api
            .get("/auth/csrf-token")
            .then((response) => {
                csrfToken = response.data.data.csrfToken;
                return csrfToken;
            })
            .finally(() => {
                csrfPromise = null;
            });
    }

    return csrfPromise;
}

const PUBLIC_MUTATIONS = new Set([
    "/auth/login",
    "/auth/register",
    "/auth/google",
    "/auth/verify-email",
    "/auth/forgot-password",
    "/auth/reset-password"
]);

api.interceptors.request.use(async (config) => {
    const method = (config.method || "get").toLowerCase();

    if (
        SAFE_METHODS.has(method) ||
        PUBLIC_MUTATIONS.has(config.url)
    ) {
        return config;
    }

    // Token hanya untuk API Whylet.
    const { base: baseOrigin, request: requestOrigin } = apiOrigins(api.defaults.baseURL, config.url, window.location.origin);

    if (requestOrigin !== baseOrigin) {
        throw new Error("CSRF header hanya boleh dikirim ke API Whylet");
    }

    const token = await fetchCsrfToken();

    config.headers.set("X-CSRF-Token", token);

    return config;
});

export default api;
