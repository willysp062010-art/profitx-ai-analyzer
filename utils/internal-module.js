// Invoke public, read-only modules in-process; no HTTP self-call or client host header.
export async function runInternalModule(handler, mint, timeoutMs = 15000) {
  if (typeof handler !== "function") return { ok: false, error: "Module interne inconnu." };
  let timer;
  let payload;
  const response = {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };
  try {
    await Promise.race([
      Promise.resolve().then(() => handler({ method: "GET", query: { mint }, headers: {} }, response)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error("timeout")), timeoutMs); }),
    ]);
    if (response.statusCode >= 400 || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, statusCode: response.statusCode, error: "Module interne indisponible." };
    }
    return payload;
  } catch {
    return { ok: false, error: "Module interne indisponible." };
  } finally {
    clearTimeout(timer);
  }
}
