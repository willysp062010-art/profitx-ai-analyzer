// One deadline covers the HTTP request and body, including a stalled response.
export async function fetchAnalysisResponse(mint, {eventId, controller = new AbortController(), timeoutMs = 45000} = {}) {
  if (controller.signal.aborted) throw new Error("Analyse interrompue.");
  let timer, onAbort;
  const interrupted = new Promise((_, reject) => {
    onAbort = () => reject(controller.signal.reason instanceof Error ? controller.signal.reason : new Error("Analyse interrompue."));
    controller.signal.addEventListener("abort", onAbort, {once:true});
    timer = setTimeout(() => controller.abort(new Error("Le délai de réponse est dépassé. Vérifiez votre connexion puis relancez l’analyse.")), timeoutMs);
  });
  async function readResponse() {
    const response = await fetch("/api/analyze", {
      method:"POST", signal:controller.signal,
      headers:{"Content-Type":"application/json", Accept:"application/json", ...(eventId ? {"x-pfx-usage-event":eventId} : {})},
      body:JSON.stringify({mint})
    });
    const text = await response.text();
    let result;
    try { result = text ? JSON.parse(text) : null; }
    catch { throw new Error(`Le serveur a retourné une réponse invalide (${response.status}). Réessayez dans un instant.`); }
    if (!response.ok) throw new Error(result?.error || result?.message || `Erreur serveur HTTP ${response.status}. Réessayez dans un instant.`);
    if (!result) throw new Error("Le serveur n’a retourné aucune donnée. Relancez l’analyse.");
    if (result.ok !== true || result.mint !== mint) throw new Error(result.error || "La réponse ne correspond pas au mint demandé. Relancez l’analyse.");
    return result;
  }
  try { return await Promise.race([readResponse(), interrupted]); }
  catch (error) {
    if (error instanceof TypeError) throw new Error("Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.");
    throw error;
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", onAbort);
  }
}
