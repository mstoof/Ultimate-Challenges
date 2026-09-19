"use client";

import { useEffect, useRef, useState } from "react";

type Status = {
  configured: boolean; connected: boolean; workspace?: string | null;
  parentPageId?: string | null; url?: string | null;
  progress?: { completed: number; total: number } | null;
  lastExportedAt?: string | null;
  result?: { completed: number; total: number; finished: boolean };
};
type Page = { id: string; title: string };

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Notion reageert niet. Probeer opnieuw.");
  return data as T;
}

export default function NotionExport({ hasPlan }: { hasPlan: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pageId, setPageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const outcome = new URLSearchParams(window.location.search).get("notion");
    const messages: Record<string, string> = {
      connected: "Notion is verbonden. Kies hieronder waar je plan komt.",
      cancelled: "Verbinden met Notion is geannuleerd.",
      invalid: "De verbindingslink is verlopen. Verbind Notion opnieuw.",
      error: "Verbinden is mislukt. Probeer opnieuw.",
      busy: "Er loopt nog een export. Verbind Notion opnieuw zodra die klaar is.",
    };
    if (outcome) {
      setNotice(messages[outcome] || "");
      const url = new URL(window.location.href);
      url.searchParams.delete("notion");
      window.history.replaceState(null, "", url);
    }
    fetch("/api/notion").then(readResponse<Status>).then((data) => {
      if (mounted.current) { setStatus(data); setProgress(data.progress ?? null); }
    }).catch((e) => { if (mounted.current) setError(e.message); });
    return () => { mounted.current = false; };
  }, []);

  async function loadPages(more = false) {
    if (loadingPages || running.current) return;
    setLoadingPages(true); setError("");
    try {
      const data = await fetch(`/api/notion/pages${more && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`)
        .then(readResponse<{ pages: Page[]; nextCursor: string | null }>);
      setPages((previous) => [...new Map([...(more ? previous : []), ...data.pages].map((page) => [page.id, page])).values()]);
      setCursor(data.nextCursor);
    } catch (e) { setError(e instanceof Error ? e.message : "Kon pagina’s niet laden."); }
    finally { setLoadingPages(false); }
  }

  async function post(action: string): Promise<Status> {
    return fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, pageId }) }).then(readResponse<Status>);
  }

  async function exportPlan() {
    if (running.current || loadingPages) return;
    running.current = true; setBusy(true); setError(""); setNotice("");
    try {
      let data = await post("start");
      setStatus(data); setProgress(data.progress ?? null);
      while (data.progress && mounted.current) {
        data = await post("step");
        if (!mounted.current) return;
        setStatus(data); setProgress(data.result ?? data.progress ?? null);
      }
      if (mounted.current) setNotice("Je plan staat in Notion.");
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Export onderbroken. Probeer opnieuw."); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }

  async function disconnect() {
    if (running.current || loadingPages) return;
    running.current = true; setBusy(true); setError("");
    try { setStatus(await post("disconnect")); setPages([]); setProgress(null); setNotice("Notion is losgekoppeld. Je geëxporteerde plan blijft bewaard."); }
    catch (e) { setError(e instanceof Error ? e.message : "Loskoppelen is mislukt."); }
    finally { running.current = false; setBusy(false); }
  }

  return (
    <details className="plan__notion" open={notice ? true : undefined}>
      <summary aria-label="Notion export" title="Notion export"><svg className="plan__tool-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V5h4l6 9V5h4v14h-4l-6-9v9H5Z" /></svg> Notion</summary>
      <div className="plan__notion-body">
        {error && <p className="form__error" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {!status && !error && <p>Notion laden…</p>}
        {status && !status.configured && <p>Notion export wordt binnenkort beschikbaar zodra de beheerder de verbinding heeft ingesteld.</p>}
        {status?.configured && !status.connected && (
          <><p>Bewaar je trainingen in je eigen Notion-workspace. Kies bij het verbinden een pagina waarin je plan mag komen.</p>
          <a className="btn btn--solid" href="/api/notion/connect">Verbind Notion</a></>
        )}
        {status?.connected && (
          <>
            <p>Verbonden met <strong>{status.workspace}</strong>.</p>
            <p>Elke training krijgt een rij met datum, sport, duur, instructies en oefeningen. Een nieuwe export werkt dezelfde rijen bij. Vinkjes en eigen notities in Notion blijven behouden; ze worden niet teruggestuurd naar deze app.</p>
            {!status.parentPageId && (
              <>
                <button type="button" className="plan__link" onClick={() => loadPages()} disabled={busy || loadingPages}>{loadingPages ? "Pagina’s laden…" : "Laad / vernieuw Notion-pagina’s"}</button>
                <label htmlFor="notion-parent">Waar wil je je plan bewaren?</label>
                <select id="notion-parent" value={pageId} onChange={(e) => setPageId(e.target.value)} disabled={busy || loadingPages}>
                  <option value="">Kies een gedeelde pagina</option>
                  {pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
                </select>
                {cursor && <button type="button" className="plan__link" disabled={busy || loadingPages} onClick={() => loadPages(true)}>Meer pagina’s laden</button>}
                <p className="quiz__hint">Mis je een pagina? Deel die in Notion met de verbinding en vernieuw de lijst. Nieuwe pagina’s kunnen even nodig hebben om te verschijnen.</p>
              </>
            )}
            <div className="plan__notion-actions">
              <button type="button" className="btn btn--solid" onClick={exportPlan} disabled={busy || loadingPages || !hasPlan || (!status.parentPageId && !pageId)}>
                {busy ? "Bezig…" : status.progress ? "Hervat export" : status.url ? "Werk plan bij in Notion" : "Exporteer naar Notion"}
              </button>
              {status.url && <a href={status.url} target="_blank" rel="noopener noreferrer" className="plan__link">Open in Notion ↗</a>}
            </div>
            {!hasPlan && <p>Bouw eerst je trainingsplan om te exporteren.</p>}
            {progress && <p role="status" aria-live="polite">{progress.completed} van {progress.total} trainingen verwerkt{busy ? "… Houd deze pagina open." : "."}</p>}
            {status.lastExportedAt && <p className="quiz__hint">Laatst geëxporteerd: {new Date(status.lastExportedAt).toLocaleString("nl-NL")}</p>}
            <p className="quiz__hint">Vervallen trainingen blijven bewaard met ‘Actueel’ uitgevinkt.</p>
            <div className="plan__notion-actions">
              <button type="button" className="plan__link" onClick={disconnect} disabled={busy || loadingPages}>Notion loskoppelen</button>
              {!busy && <a className="plan__link" href="/api/notion/connect">Opnieuw verbinden</a>}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
