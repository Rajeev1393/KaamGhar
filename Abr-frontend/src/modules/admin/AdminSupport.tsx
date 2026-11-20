"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/components/LanguageProvider";
import SupportConversation, { supportPollInterval, type SupportMessage } from "@/components/SupportConversation";
import { api, formatDate } from "@/lib/api";

type Thread = { _id: string; name: string; latest: SupportMessage & { attachmentName?: string } };

export default function AdminSupport({ refresh }: { refresh: number }) {
  const { t, locale } = useTranslation();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selected = threads.find((thread) => thread._id === selectedId) ?? threads[0];

  useEffect(() => {
    let active = true;
    let pending = false;
    async function load() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const result = await api<{ threads: Thread[] }>("admin/support");
        if (active) {
          setThreads(result.threads);
          setSelectedId((current) => result.threads.some((thread) => thread._id === current)
            ? current : (result.threads[0]?._id ?? ""));
          setError("");
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load conversations.");
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(load, supportPollInterval);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [refresh]);

  return <section className="dash-panel">
    <div className="panel-heading"><h2>{t("Support inbox")}</h2></div>
    {error && <p className="inline-error" role="alert">{t(error)}</p>}
    <div className="support-inbox">
      <div className="support-threads" aria-label={t("Customer conversations")}>
        {loading && <p className="support-placeholder">{t("Loading conversations…")}</p>}
        {!loading && !error && !threads.length && <p className="support-placeholder">{t("No conversations yet.")}</p>}
        {threads.map((thread) => <button key={thread._id} type="button" aria-pressed={thread._id === selected?._id}
          onClick={() => setSelectedId(thread._id)}>
          <strong>{thread.name}</strong>
          <span className="support-thread-preview">{thread.latest.text || thread.latest.attachmentName}</span>
          <span className="support-thread-meta">
            <span>{thread.latest.sender === "customer" ? t("Awaiting reply") : t("Replied")}</span>
            <time dateTime={thread.latest.createdAt}>{formatDate(thread.latest.createdAt, locale)}</time>
          </span>
        </button>)}
      </div>
      {selected ? <div className="support-active-thread">
        <h3>{selected.name}</h3>
        <SupportConversation key={selected._id} endpoint={`admin/support/${selected._id}`} sender="support" />
      </div> : null}
    </div>
  </section>;
}
