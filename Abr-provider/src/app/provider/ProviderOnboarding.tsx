"use client";

import { LanguageChooser, useTranslation } from "@/components/LanguageProvider";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ProviderDocument, User } from "@/lib/types";

export const documentLabels: Record<string, string> = {
  aadhaar: "Aadhaar card",
  pan: "PAN card",
  police_verification: "Police verification"
};
const maxDocumentSize = 5 * 1024 * 1024;
const acceptedDocuments = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

async function uploadProviderDocument(type: string, file: File) {
  const body = new FormData();
  body.set("type", type);
  body.set("document", file);
  const { document } = await api<{ document: ProviderDocument }>("workers/me/documents", { method: "POST", body });
  return document;
}

export function ProviderSignup({ onRegistered, onBack }: { onRegistered: (user: User, failedUploads: Record<string, string>) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<{ name: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invalidDocument, setInvalidDocument] = useState("");

  useEffect(() => {
    let active = true;
    api<{ categories: { name: string; label: string }[] }>("workers/categories")
      .then((result) => { if (active) setCategories(result.categories); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load service categories.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedDocuments: { type: string; file: File }[] = [];
    for (const [type, label] of Object.entries(documentLabels)) {
      const file = form.get(type);
      form.delete(type);
      if (!(file instanceof File) || !file.name) continue;
      if (file.size === 0 || file.size > maxDocumentSize || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
        setInvalidDocument(label);
        setError("");
        return;
      }
      selectedDocuments.push({ type, file });
    }
    setInvalidDocument("");
    setSaving(true);
    setError("");
    const details = Object.fromEntries(form);
    try {
      const { user } = await api<{ user: User }>("auth/register", {
        method: "POST",
        body: JSON.stringify({ ...details, role: "worker" }),
      });
      const failed: Record<string, string> = {};
      for (const { type, file } of selectedDocuments) {
        try {
          await uploadProviderDocument(type, file);
        } catch (reason) {
          failed[type] = reason instanceof Error ? reason.message : "upload failed";
        }
      }
      onRegistered(user, failed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create your provider account.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="login-page">
    <section className="login-card provider-signup">
      <div className="login-language"><LanguageChooser /></div>
      <p className="eyebrow">{t("SERVICE PROVIDER PORTAL")}</p>
      <h1>{t("Create a provider account")}</h1>
      <form onSubmit={register}>
        <div className="provider-form-grid">
          <label>{t("Full name")}<input name="name" autoComplete="name" minLength={2} maxLength={80} required /></label>
          <label>{t("Email address")}<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          <label>{t("Phone number")}<input name="phone" type="tel" autoComplete="tel" minLength={8} maxLength={20} required /></label>
          <label>{t("Password")}<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
          <label>{t("Service category")}<select name="category" defaultValue="" required disabled={loading || !categories.length}>
            <option value="" disabled>{loading ? t("Loading categories") : t("Choose a category")}</option>
            {categories.map(({ name, label }) => <option key={name} value={name}>{t(label)}</option>)}
          </select></label>
          <label>{t("Profession")}<input name="profession" minLength={2} maxLength={80} required /></label>
          <label>{t("City")}<input name="city" autoComplete="address-level2" minLength={2} maxLength={80} required /></label>
          <label>{t("Experience (years)")}<input name="experience" type="number" defaultValue={0} min={0} max={60} required /></label>
        </div>
        <label>{t("About your service")}<textarea name="description" rows={3} minLength={10} maxLength={300} required /></label>
        <fieldset className="signup-documents">
          <legend>{t("Verification documents")}</legend>
          <p>{t("Optional. PDF, JPG, or PNG, up to 5 MB each.")}</p>
          {Object.entries(documentLabels).map(([type, label]) => <label key={type}>
            {t(label)}<input name={type} type="file" accept={acceptedDocuments} disabled={saving} />
          </label>)}
        </fieldset>
        {(invalidDocument || error) && <p className="error-message" role="alert">{invalidDocument
          ? t("{document}: choose a PDF, JPG, or PNG file up to 5 MB.", { document: t(invalidDocument) })
          : t(error)}</p>}
        <button className="primary-button" disabled={saving || loading || !categories.length}>{saving ? t("Creating account…") : t("Create account")}</button>
      </form>
      <button className="back-link auth-switch" type="button" onClick={onBack} disabled={saving}>{t("Back to sign in")}</button>
    </section>
  </main>;
}

export function ProviderDocuments({ documents, onUploaded }: { documents: ProviderDocument[]; onUploaded: (document: ProviderDocument) => void }) {
  const { t, language } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("document");
    if (!(file instanceof File) || file.size === 0 || file.size > maxDocumentSize) {
      setError("Choose a PDF, JPG, or PNG file up to 5 MB.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const document = await uploadProviderDocument(String(data.get("type")), file);
      onUploaded(document);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload this document.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="booking-panel provider-documents">
    <h2>{t("Verification documents")}</h2>
    <p>{t("Upload documents for admin review. PDF, JPG, or PNG, up to 5 MB each.")}</p>
    <form className="provider-form-grid" onSubmit={upload}>
      <label>{t("Document type")}<select name="type">
        {Object.entries(documentLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
      </select></label>
      <label>{t("Choose file")}<input name="document" type="file" accept={acceptedDocuments} required /></label>
      <button className="primary-button" disabled={saving || documents.length >= 10}>{saving ? t("Uploading…") : t("Upload document")}</button>
    </form>
    {error && <p className="error-message" role="alert">{t(error)}</p>}
    {documents.length > 0 && <ul className="provider-document-list" aria-label={t("Uploaded documents")}>
      {documents.map((document) => <li key={document._id}>
        <span>{t(documentLabels[document.type] ?? document.type)} · {document.originalName}</span>
        <strong>{language === "en" ? document.status : t(document.status[0].toUpperCase() + document.status.slice(1))}</strong>
      </li>)}
    </ul>}
  </section>;
}
