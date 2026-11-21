"use client";

import { useEffect, useState, type FormEvent } from "react";
import DashboardFrame from "@/components/DashboardFrame";
import { LoadingLine } from "@/components/DashboardParts";
import { api, formatDate } from "@/lib/api";
import type { Booking } from "@/lib/types";

import { complaintStatuses, type Complaint } from "@/lib/customerExperience";

function CustomerComplaints({ refresh, onRefresh, notify }: { refresh: number; onRefresh: () => void; notify: (value: string) => void }) {
  const [data, setData] = useState<{ complaints: Complaint[]; bookings: Booking[] }>();
  const [kind, setKind] = useState<Complaint["kind"]>("complaint");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([
      api<{ complaints: Complaint[] }>("customer-experience/complaints", options),
      api<{ bookings: Booking[] }>("bookings", options),
    ]).then(([cases, bookings]) => { setData({ ...cases, ...bookings }); setError(""); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    try {
      await api("customer-experience/complaints", {
        method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      setKind("complaint");
      notify("Case submitted to support.");
      onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit the case.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="dash-panel customer-experience">
    <div className="panel-heading"><h2>Complaints &amp; Disputes</h2><button className="button button-outline" onClick={onRefresh}>Refresh status</button></div>
    <p>Raise a complaint about your account or service, or select a booking to dispute it.</p>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {!data && !error && <LoadingLine />}
    {data && <>
      <form className="profile-form customer-experience-form" onSubmit={submit}>
        <label>Type<select name="kind" value={kind} onChange={(event) => setKind(event.target.value as Complaint["kind"])}>
          <option value="complaint">General complaint</option><option value="dispute" disabled={!data.bookings.length}>Booking dispute</option>
        </select></label>
        <label>Booking {kind === "complaint" ? "(optional)" : ""}<select name="bookingId" defaultValue="" required={kind === "dispute"}>
          <option value="">Select a booking</option>
          {data.bookings.map((booking) => <option key={booking._id} value={booking._id}>
            {booking.worker?.name ?? "Professional"} — {formatDate(booking.scheduledAt)}
          </option>)}
        </select></label>
        <label>Subject<input name="subject" minLength={3} maxLength={100} required /></label>
        <label>What happened?<textarea name="details" rows={4} minLength={10} maxLength={2000} required /></label>
        <button className="button button-dark" disabled={saving}>Submit to support</button>
      </form>
      <h3>Your cases</h3>
      <div className="customer-experience-list">
        {!data.complaints.length && <p>No cases yet.</p>}
        {data.complaints.map((item) => <article key={item._id}>
          <strong>{item.subject} · {complaintStatuses[item.status]}</strong>
          <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
          <p>{item.details}</p>
          {item.response && <p><strong>Support update</strong> {item.response}</p>}
        </article>)}
      </div>
    </>}
  </section>;
}

export default function CustomerComplaintsPage() {
  return <DashboardFrame expectedRole="customer" Screen={CustomerComplaints} />;
}
