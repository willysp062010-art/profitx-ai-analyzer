import Head from "next/head";
import { useState } from "react";

const profileUrl = "https://x.com/IVAR4019";
const topics = ["Bug", "Suggestion", "Question", "Autre"];

export default function Contact() {
  const [topic, setTopic] = useState(topics[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const draft = `Bonjour PROFITX AI,\n\nSujet : ${topic}\n\n${message.trim()}`;

  async function copyMessage(event) {
    event.preventDefault();
    if (!message.trim()) {
      setStatus("Écris un message avant de le copier.");
      return;
    }

    try {
      await navigator.clipboard.writeText(draft);
      setStatus("Message copié. Ouvre X, puis colle-le dans un message privé à @IVAR4019.");
    } catch {
      setStatus("La copie automatique est indisponible. Sélectionne le texte ci-dessous pour le copier.");
    }
  }

  return (
    <main id="pfx-main-content" className="contact">
      <Head>
        <title>Contact et retours | PROFITX AI</title>
      </Head>
      <h1>Contact et retours</h1>
      <p className="intro">Un bug, une idée ou une question ? Écris à Willy, le créateur de PROFITX AI.</p>
      <form className="panel" onSubmit={copyMessage}>
        <label htmlFor="contact-topic">Sujet</label>
        <select id="contact-topic" value={topic} onChange={(event) => {
          setTopic(event.target.value);
          setStatus("");
        }}>
          {topics.map((item) => <option key={item}>{item}</option>)}
        </select>

        <label htmlFor="contact-message">Ton message</label>
        <textarea id="contact-message" value={message} onChange={(event) => {
          setMessage(event.target.value);
          setStatus("");
        }} required rows={6} maxLength={2000} aria-describedby="contact-hint" />
        <p id="contact-hint">Pour un bug, indique la page et ce qui s’est passé. Garde tes clés privées et ta phrase de récupération pour toi.</p>

        <div className="actions">
          <button className="primaryButton" type="submit">Copier le message</button>
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">Ouvrir @IVAR4019 sur X ↗</a>
        </div>
        <p role="status">{status}</p>
        {status.startsWith("La copie") && (
          <>
            <label htmlFor="contact-draft">Message à copier</label>
            <textarea id="contact-draft" readOnly value={draft} rows={6} />
          </>
        )}
      </form>
      <style jsx>{`
        .contact { width: min(640px, calc(100% - 32px)); margin: 42px auto 64px; }
        h1 { font-size: clamp(32px, 7vw, 54px); margin: 0 0 12px; }
        .panel { border: 1px solid var(--pfx-line); padding: clamp(16px, 4vw, 28px); }
        label { display: block; font-weight: 650; margin-bottom: 8px; }
        select, textarea { display: block; width: 100%; min-height: 44px; border: 1px solid; padding: 10px 12px; font: inherit; box-sizing: border-box; }
        select { margin-bottom: 18px; }
        textarea { resize: vertical; }
        #contact-hint { color: var(--pfx-muted); font-size: 14px; }
        .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
        button, .actions a { display: inline-flex; align-items: center; min-height: 44px; }
        button { padding: 0 16px; border: 1px solid; font: inherit; font-weight: 700; cursor: pointer; }
        .actions a { color: var(--pfx-cyan); }
        [role="status"]:empty { margin: 0; }
      `}</style>
    </main>
  );
}
