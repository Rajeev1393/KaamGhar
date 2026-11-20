"use client";

import { FileText, Paperclip, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/components/LanguageProvider";
import { api, formatDate } from "@/lib/api";

export type SupportMessage = {
  _id: string;
  sender: "customer" | "support";
  text: string;
  createdAt: string;
  attachment?: { name: string; size: number; mimeType: string };
};

export const supportPollInterval = 5000;

function mergeMessages(current: SupportMessage[], incoming: SupportMessage[]) {
  const messages = new Map([...current, ...incoming].map((message) => [message._id, message]));
  return [...messages.values()].sort((a, b) => a._id.localeCompare(b._id)).slice(-100);
}

export default function SupportConversation({ endpoint, sender }: {
  endpoint: string;
  sender: SupportMessage["sender"];
}) {
  const { t, locale } = useTranslation();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const scrollArea = useRef<HTMLDivElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const followLatest = useRef(true);
  const sendInProgress = useRef(false);
  const latestId = messages.at(-1)?._id;

  useEffect(() => {
    let active = true;
    let pending = false;
    async function load() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const result = await api<{ messages: SupportMessage[] }>(endpoint);
        if (active) {
          setMessages((current) => mergeMessages(current, result.messages));
          setLoadError("");
        }
      } catch (reason) {
        if (active) setLoadError(reason instanceof Error ? reason.message : "Could not load messages.");
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
  }, [endpoint]);

  useEffect(() => {
    const area = scrollArea.current;
    if (area && followLatest.current) area.scrollTop = area.scrollHeight;
  }, [latestId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if ((!text && !attachment) || sendInProgress.current) return;
    sendInProgress.current = true;
    setSending(true);
    setSendError("");
    try {
      let body: FormData | string = JSON.stringify({ text });
      if (attachment) {
        body = new FormData();
        body.set("text", text);
        body.set("document", attachment);
      }
      const result = await api<{ message: SupportMessage }>(endpoint, {
        method: "POST",
        body,
      });
      followLatest.current = true;
      setMessages((current) => mergeMessages(current, [result.message]));
      setDraft("");
      setAttachment(null);
    } catch (reason) {
      setSendError(reason instanceof Error ? reason.message : "Could not send the message.");
    } finally {
      sendInProgress.current = false;
      setSending(false);
    }
  }

  return <div className="support-conversation">
    {loadError && <p className="inline-error" role="alert">{t(loadError)}</p>}
    <div className="support-messages" ref={scrollArea} role="log" aria-label={t("Support messages")} tabIndex={0}
      onScroll={(event) => {
        const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
        followLatest.current = scrollHeight - scrollTop - clientHeight < 48;
      }}>
      {loading && <p className="support-placeholder">{t("Loading messages…")}</p>}
      {!loading && !loadError && !messages.length && <p className="support-placeholder">{t("No messages yet.")}</p>}
      {messages.map((message) => <div className="support-message" data-own={message.sender === sender} key={message._id}>
        <div className="support-message-meta">
          <strong>{t(message.sender === sender ? "You" : message.sender === "support" ? "Support team" : "Customer")}</strong>
          <time dateTime={message.createdAt}>{formatDate(message.createdAt, locale)}</time>
        </div>
        {message.text && <p>{message.text}</p>}
        {message.attachment && <a className="support-attachment" href={`/api/${endpoint}/${message._id}/attachment`} download={message.attachment.name}>
          <FileText size={16} aria-hidden="true" />
          <span>{message.attachment.name}</span>
          <span className="support-attachment-size">{Math.ceil(message.attachment.size / 1024)} KB</span>
        </a>}
      </div>)}
    </div>
    <form className="support-compose" onSubmit={send}>
      <input ref={attachmentInput} hidden type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) {
            setSendError("Each chat attachment must be 5 MB or smaller.");
            return;
          }
          setSendError("");
          setAttachment(file);
        }} />
      {attachment && <div className="support-attachment-selection">
        <FileText size={16} aria-hidden="true" />
        <span>{attachment.name}</span>
        <button type="button" disabled={sending} aria-label={t("Remove attachment")} onClick={() => setAttachment(null)}><X size={15} /></button>
      </div>}
      <textarea aria-label={t("Your message")} placeholder={t("Type your message…")} rows={2} maxLength={1000}
        value={draft} disabled={sending} onChange={(event) => setDraft(event.target.value)} />
      <button type="button" className="button button-outline" disabled={sending}
        onClick={() => attachmentInput.current?.click()} title={t("PDF, JPG or PNG up to 5 MB")}>
        <Paperclip size={16} aria-hidden="true" />{t("Attach document")}
      </button>
      <button type="submit" className="button button-dark" disabled={sending || (!draft.trim() && !attachment)}>
        {t(sending ? "Sending…" : "Send")} <Send size={14} aria-hidden="true" />
      </button>
    </form>
    {sendError && <p className="inline-error" role="alert">{t(sendError)}</p>}
  </div>;
}
