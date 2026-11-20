"use client";

import DashboardFrame from "@/components/DashboardFrame";
import { EmptyState, LoadingLine, Metric, StatusPill, hasActivePayment } from "@/components/DashboardParts";
import DetectCityButton from "@/components/DetectCityButton";
import { useTranslation } from "@/components/LanguageProvider";
import { api, formatDate, formatPrice } from "@/lib/api";
import type { Booking, ProviderEarnings, ServiceCategory, VerificationDocument, Worker } from "@/lib/types";
import { ArrowRight, BadgeCheck, Check, CircleDollarSign, ClipboardList, Clock3, MapPin, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

function WorkerDashboard({ refresh, onRefresh, notify }: { refresh: number; onRefresh: () => void; notify: (message: string) => void }) {
  const { t, locale } = useTranslation();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [earnings, setEarnings] = useState<ProviderEarnings>({ total: 0, pending: 0, cleared: 0 });
  const [workerCity, setWorkerCity] = useState("");
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<VerificationDocument["type"]>("identity");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [earningsError, setEarningsError] = useState("");
  const pending = bookings.filter((booking) => booking.status === "pending").length;
  const completed = bookings.filter((booking) => booking.status === "completed").length;

  useEffect(() => {
    Promise.all([
      api<{ worker: Worker }>("workers/me"),
      api<{ bookings: Booking[] }>("bookings"),
      api<{ earnings: ProviderEarnings }>("workers/me/earnings")
    ])
      .then(([profile, result, income]) => {
        setWorker(profile.worker);
        setWorkerCity(profile.worker.city);
        setBookings(result.bookings);
        setEarnings(income.earnings);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setBusy(false));
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api<{ earnings: ProviderEarnings }>("workers/me/earnings")
        .then(({ earnings: latestEarnings }) => {
          if (active) {
            setEarnings(latestEarnings);
            setEarningsError("");
          }
        })
        .catch((reason: Error) => {
          if (active) setEarningsError(reason.message);
        });
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    api<{ categories: ServiceCategory[] }>("workers/categories")
      .then(({ categories: availableCategories }) => setCategories(availableCategories))
      .catch((reason: Error) => setError(reason.message));
  }, []);

  async function changeStatus(id: string, status: Booking["status"]) {
    try {
      await api(`bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      notify(`Request ${status}.`);
      onRefresh();
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Could not update this request.");
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!worker) return;
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      profession: String(formData.get("profession") || ""),
      category: String(formData.get("category") || ""),
      city: workerCity,
      description: String(formData.get("description") || ""),
      available: formData.get("available") === "on",
      experience: Number(formData.get("experience")),
      price: Number(formData.get("price")),
    };
    try {
      const result = await api<{ worker: Worker }>("workers/me", { method: "PATCH", body: JSON.stringify(payload) });
      setWorker(result.worker);
      notify(t("Your profile is saved."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!documentFile) {
      setError("Select a document to upload.");
      return;
    }
    setUploadingDocument(true);
    setError("");
    const formData = new FormData();
    formData.set("type", documentType);
    formData.set("document", documentFile);
    try {
      const result = await api<{ message: string; document: VerificationDocument }>("workers/me/documents", {
        method: "POST",
        body: formData,
      });
      setWorker((current) => current
        ? { ...current, verificationDocuments: [...(current.verificationDocuments || []), result.document] }
        : current);
      setDocumentFile(null);
      form.reset();
      notify("Document uploaded for admin verification.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload the verification document.");
    } finally {
      setUploadingDocument(false);
    }
  }

  return <>
    {worker?.approvalStatus !== "approved" && worker && <div className="review-banner"><ShieldCheck size={19} /><div><strong>{t("Profile")}{" "}{worker.approvalStatus === "pending" ? "under review" : "not approved yet"}</strong><span>{worker.approvalStatus === "pending" ? "Your listing goes live as soon as our team verifies it." : "Please get in touch with support if you need help with your profile."}</span></div></div>}
    {error && <p className="inline-error">{error}</p>}
    {earningsError && <p className="inline-error">{earningsError}</p>}
    <div className="metric-row provider-earnings"><Metric icon={CircleDollarSign} label={t("Total earning")} value={`₹${formatPrice(earnings.total)}`} foot={t("Customer payments received")} /><Metric icon={Clock3} label={t("Total pending")} value={`₹${formatPrice(earnings.pending)}`} foot={t("Awaiting admin payout")} /><Metric icon={BadgeCheck} label={t("Payment received")} value={`₹${formatPrice(earnings.cleared)}`} foot={t("Paid by admin")} /></div>
    <div className="metric-row"><Metric icon={ClipboardList} label={t("My bookings")} value={bookings.length} foot="Incoming customer requests" /><Metric icon={Clock3} label="Needs a reply" value={pending} foot="Waiting for your response" /><Metric icon={BadgeCheck} label="Jobs complete" value={completed} foot="Completed work" /><Metric icon={CircleDollarSign} label={t("Profile status")} value={worker?.approvalStatus || "—"} foot={worker?.available ? t("Accepting new bookings") : t("Not taking bookings")} /></div>
    <section className="dash-panel" id="requests"><div className="panel-heading"><div><p className="eyebrow">{t("MY WORKSPACE")}</p><h2>{t("Booking requests")}</h2></div><button className="button button-outline" onClick={onRefresh}><RefreshCw size={14} />{" "}{t("Refresh")}</button></div>{busy ? <LoadingLine /> : bookings.length ? <div className="request-list">{bookings.map((booking) => <article className="request-item" key={booking._id}><div className="request-top"><div><strong>{booking.customer?.name || booking.customerName}</strong><span>{t(formatDate(booking.scheduledAt, locale))} · {t("{count} hr", { count: booking.durationHours || 1 })} · ₹{formatPrice(booking.totalAmount || 0)}</span></div><StatusPill status={booking.status} /></div><p><MapPin size={13} /> {booking.address}</p><small>{booking.notes || t("No extra details")} · {booking.customer?.phone || booking.phone}</small>{booking.paymentStatus === "paid" && <small className={booking.providerPayoutStatus === "cleared" ? "payment-status-paid" : ""}>{t("Payout:")}{" "}{booking.providerPayoutStatus === "cleared" ? t("Paid") : t("Pending")}</small>}{booking.paymentStatus === "refund_required" && <small className="payment-status-error">Payment received; contact support to arrange the customer refund.</small>}{hasActivePayment(booking) && <small>Customer payment checkout is active; cancellation is temporarily unavailable.</small>}<div className="request-actions">{booking.status === "pending" && <><button className="button button-dark" onClick={() => void changeStatus(booking._id, "confirmed")}><Check size={14} />{" "}{t("Accept job")}</button><button className="button button-outline danger-button" onClick={() => void changeStatus(booking._id, "cancelled")}>{t("Decline")}</button></>}{booking.status === "confirmed" && <><button className="button button-dark" onClick={() => void changeStatus(booking._id, "completed")}><BadgeCheck size={14} />{" "}{t("Mark complete")}</button>{!hasActivePayment(booking) && <button className="button button-outline danger-button" onClick={() => void changeStatus(booking._id, "cancelled")}>{booking.paymentStatus === "paid" ? t("Cancel & flag refund") : t("Cancel")}</button>}</>}</div></article>)}</div> : <EmptyState title={t("No requests yet.")} text={t("Once your profile is approved, new service requests will appear here.")} />}</section>
    {worker && <section className="dash-panel" id="profile"><div className="panel-heading"><div><p className="eyebrow">{t("YOUR LISTING, YOUR STORY")}</p><h2>{t("Professional profile")}</h2></div><StatusPill status={worker.available ? "available" : "paused"} /></div><form className="profile-form" onSubmit={saveProfile}><div className="form-grid-two"><label>{t("Your profession")}<input name="profession" defaultValue={worker.profession} required maxLength={80} /></label><label>{t("Service category")}<select name="category" defaultValue={worker.category} required>{categories.map(({ name, label }) => <option key={name} value={name}>{t(label)}</option>)}</select></label></div><div className="form-grid-two"><div className="location-field"><label>{t("City")}<input name="city" value={workerCity} onChange={(event) => setWorkerCity(event.target.value)} required maxLength={80} /></label><DetectCityButton compact onCity={setWorkerCity} /></div><label>{t("Experience (years)")}<input name="experience" defaultValue={worker.experience} type="number" min={0} max={60} required /></label></div><div className="form-grid-two"><label>{t("Hourly rate (₹)")}<input name="price" defaultValue={worker.price} type="number" min={1} required /></label><label className="availability-check"><input name="available" type="checkbox" defaultChecked={worker.available} />{" "}{t("Accept new bookings")}</label></div><label>{t("About your service")}<textarea name="description" defaultValue={worker.description || ""} rows={3} minLength={10} maxLength={300} required /></label><button className="button button-dark" disabled={saving}>{saving ? t("Saving…") : t("Save profile")} <ArrowRight size={15} /></button></form><div className="document-upload-panel"><div className="panel-heading"><div><p className="eyebrow">{t("IDENTITY & SKILL CHECK")}</p><h3>{t("Verification documents")}</h3></div><span className="result-count">{t("{count}/10 uploaded", { count: worker.verificationDocuments?.length || 0 })}</span></div><p>Upload an ID, address proof, or service certificate. PDF, JPG, or PNG, up to 5 MB each. Documents are private and reviewed by admin.</p><form className="document-upload-form" onSubmit={uploadDocument}><label>{t("Document type")}<select value={documentType} onChange={(event) => setDocumentType(event.target.value as VerificationDocument["type"])}><option value="identity">{t("Identity proof")}</option><option value="address">{t("Address proof")}</option><option value="certificate">{t("Service certificate")}</option><option value="other">{t("Other")}</option></select></label><label>{t("Choose document")}<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} required /></label><button className="button button-dark" disabled={uploadingDocument}>{uploadingDocument ? t("Uploading…") : t("Upload document")}</button></form>{worker.verificationDocuments?.length ? <div className="document-status-list">{worker.verificationDocuments.map((document) => <div className="document-status-item" key={document._id}><span>{document.type} · {document.originalName}</span><StatusPill status={document.status} /></div>)}</div> : <p>{t("No verification documents uploaded yet.")}</p>}</div></section>}
  </>;
}

export default function WorkerDashboardPage() {
  return <DashboardFrame expectedRole="worker" Screen={WorkerDashboard} />;
}
