export function apiOrigins(baseURL, requestURL, pageOrigin) {
    const base = new URL(baseURL, pageOrigin);
    return { base: base.origin, request: new URL(requestURL, base).origin };
}
