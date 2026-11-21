"use client";

import { useState, type FormEvent } from "react";
import { api, formatDate, formatPrice } from "@/lib/api";
import { refundStatuses, ticketCategories, ticketLevels, ticketPriorities, ticketStatuses, type Ticket } from "@/lib/customerExperience";

export function TicketDetails({ ticket }: { ticket: Ticket }) {
  return <dl className="ticket-details">
    <div><dt>Ticket ID</dt><dd>{ticket._id}</dd></div>
    {ticket.booking && <div><dt>Booking ID</dt><dd>{ticket.booking}</dd></div>}
    {ticket.customer && <div><dt>Customer</dt><dd>{ticket.customer.name}</dd></div>}
    {ticket.professional && <div><dt>Professional</dt><dd>{ticket.professional.name}</dd></div>}
    <div><dt>Category</dt><dd>{ticketCategories[ticket.category]}</dd></div>
    <div><dt>Priority</dt><dd>{ticketPriorities[ticket.priority]}</dd></div>
    <div><dt>Status</dt><dd>{ticketStatuses[ticket.status]}</dd></div>
    <div><dt>Escalation</dt><dd>{ticketLevels[ticket.level]}</dd></div>
    <div><dt>Assigned agent</dt><dd>{ticket.assignedAgent?.name ?? "Unassigned"}</dd></div>
    <div><dt>Created</dt><dd>{formatDate(ticket.createdAt)}</dd></div>
    <div><dt>Response due</dt><dd>{formatDate(ticket.responseDueAt)} · {ticket.responseSla}</dd></div>
    <div><dt>Resolution due</dt><dd>{formatDate(ticket.resolutionDueAt)} · {ticket.resolutionSla}</dd></div>
    {ticket.refund?.status && <div><dt>Refund</dt><dd>{refundStatuses[ticket.refund.status]} · INR {formatPrice(ticket.refund.amount / 100)}</dd></div>}
  </dl>;
}

export function TicketEvidence({ ticket, staff, onUploaded }: { ticket: Ticket; staff?: boolean; onUploaded: () => void }) {
  const path = `${staff ? "admin" : "customer-experience"}/complaints/${ticket._id}/evidence`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      await api(path, { method: "POST", body: new FormData(form) });
      form.reset();
      onUploaded();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not attach the evidence.");
    } finally {
      setBusy(false);
    }
  }
  return <div>
    <h4>Evidence attachments</h4>
    {ticket.evidence.length > 0 && <ul>{ticket.evidence.map((file) => <li key={file._id}>
      <a className="text-link" href={`/api/${path}/${file._id}`} download>{file.name}</a>
    </li>)}</ul>}
    {ticket.status !== "closed" && ticket.evidence.length < 5 && <form className="profile-form customer-experience-form" onSubmit={upload}>
      <label>PDF, JPG or PNG, up to 5 MB<input name="document" type="file" accept=".pdf,.jpg,.jpeg,.png" required /></label>
      <button className="button button-outline" disabled={busy}>Attach evidence</button>
    </form>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </div>;
}
