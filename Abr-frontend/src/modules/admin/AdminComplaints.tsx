"use client";

import { useState } from "react";
import { TicketDetails, TicketEvidence } from "@/components/TicketDetails";
import { formatDate } from "@/lib/api";
import { ticketLevels, ticketPriorities, ticketStatuses, type Ticket, type TicketLevel, type TicketStatus } from "@/lib/customerExperience";
import { SectionData, type Save, type SectionProps } from "./AdminManagement";

type Agent = { _id: string; name: string; level: TicketLevel };
const nextStatuses: Record<TicketStatus, TicketStatus[]> = {
  open: [], assigned: ["in_progress"], in_progress: ["waiting", "resolved"],
  waiting: ["in_progress", "resolved"], resolved: ["in_progress", "closed"], closed: [],
};

function TicketRefund({ ticket, level, save, saving }: { ticket: Ticket; level: TicketLevel; save: Save; saving: boolean }) {
  const refund = ticket.refund;
  const status = refund?.status;
  const editable = !["resolved", "closed"].includes(ticket.status);
  if (!ticket.booking || (!editable && !status)) return null;
  return <details className="ticket-tools">
    <summary>Refund workflow</summary>
    {refund?.reason && <p>Request reason: {refund.reason}</p>}
    {refund?.decision && <p>Decision: {refund.decision}</p>}
    {refund?.reference && <p>Refund reference: {refund.reference}</p>}
    {status === "requested" && level !== "management" && <p>Management approval required.</p>}
    {editable && (!status || status === "rejected") && <form className="profile-form customer-experience-form" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      void save(`complaints/${ticket._id}`, "PATCH", {
        action: "refund", refundAction: "request", updatedAt: ticket.updatedAt,
        reason: data.get("reason"), amount: Math.round(Number(data.get("amount")) * 100),
      });
    }}>
      <label>Refund amount (INR)<input name="amount" type="number" min=".01" step=".01" required /></label>
      <label>Reason<textarea name="reason" minLength={3} maxLength={500} rows={2} required /></label>
      <button className="button button-dark" disabled={saving}>Request refund approval</button>
    </form>}
    {editable && level === "management" && status === "requested" && <form className="profile-form customer-experience-form" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      void save(`complaints/${ticket._id}`, "PATCH", {
        action: "refund", refundAction: data.get("refundAction"), updatedAt: ticket.updatedAt, reason: data.get("reason"),
      });
    }}>
      <label>Decision<select name="refundAction"><option value="approve">Approve</option><option value="reject">Reject</option></select></label>
      <label>Decision reason<textarea name="reason" minLength={3} maxLength={500} rows={2} required /></label>
      <button className="button button-dark" disabled={saving}>Save refund decision</button>
    </form>}
    {editable && level === "management" && status === "approved" && <form className="profile-form customer-experience-form" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      void save(`complaints/${ticket._id}`, "PATCH", {
        action: "refund", refundAction: "record", updatedAt: ticket.updatedAt, reference: data.get("reference"),
      });
    }}>
      <p>Process the approved refund through the payment provider, then record its reference here.</p>
      <label>Refund reference<input name="reference" minLength={3} maxLength={100} required /></label>
      <button className="button button-dark" disabled={saving}>Record completed refund</button>
    </form>}
  </details>;
}

function TicketActions({ ticket, agents, level, save, saving }: { ticket: Ticket; agents: Agent[]; level: TicketLevel; save: Save; saving: boolean }) {
  const tiers = Object.keys(ticketLevels);
  const available = agents.filter((agent) => tiers.indexOf(agent.level) >= tiers.indexOf(ticket.level));
  function update(action: string, fields: object = {}) {
    void save(`complaints/${ticket._id}`, "PATCH", { action, updatedAt: ticket.updatedAt, ...fields });
  }
  return <>
    {ticket.status !== "closed" && <>
      <div className="ticket-action-grid">
        <form className="profile-form customer-experience-form" onSubmit={(event) => {
          event.preventDefault();
          update("assign", Object.fromEntries(new FormData(event.currentTarget)));
        }}>
          <label>Assign agent<select name="agentId" required defaultValue="">
            <option value="" disabled>{available.length ? "Select an agent" : "No active agents at this level"}</option>
            {available.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}
          </select></label>
          <button className="button button-outline" disabled={saving || !available.length}>Assign agent</button>
          {ticket.level !== "management" && ticket.status !== "resolved" && <button className="button button-outline" type="button" disabled={saving} onClick={() => {
            if (window.confirm("Escalate this ticket and send it to the next team for assignment?")) update("escalate");
          }}>Escalate to {ticket.level === "support" ? "Operations Manager" : "Admin / Management"}</button>}
        </form>
        <form className="profile-form customer-experience-form" onSubmit={(event) => {
          event.preventDefault();
          update("update", Object.fromEntries(new FormData(event.currentTarget)));
        }}>
          <label>Status<select name="status" defaultValue={ticket.status}>
            {[ticket.status, ...nextStatuses[ticket.status]].map((status) => <option key={status} value={status}>{ticketStatuses[status]}</option>)}
          </select></label>
          <label>Priority<select name="priority" defaultValue={ticket.priority}>
            {Object.entries(ticketPriorities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          <label>Reply visible to the customer<textarea name="response" maxLength={2000} rows={3} /></label>
          <button className="button button-dark" disabled={saving}>Save ticket update</button>
        </form>
      </div>
    </>}
    <TicketRefund ticket={ticket} level={level} save={save} saving={saving} />
    <details className="ticket-tools">
      <summary>Internal notes ({ticket.notes?.length ?? 0})</summary>
      {ticket.notes?.map((note) => <div className="ticket-note" key={note._id}>
        <p>{note.text}</p><small>{note.author} · {formatDate(note.createdAt)}</small>
      </div>)}
      {ticket.status !== "closed" && <form className="profile-form customer-experience-form" onSubmit={(event) => {
        event.preventDefault();
        update("note", Object.fromEntries(new FormData(event.currentTarget)));
      }}>
        <label>Staff-only note<textarea name="note" maxLength={2000} rows={3} required /></label>
        <button className="button button-outline" disabled={saving}>Add internal note</button>
      </form>}
    </details>
  </>;
}

export default function AdminComplaints({ onRefresh, ...props }: SectionProps & { onRefresh: () => void }) {
  const [status, setStatus] = useState<TicketStatus>("open");
  return <section className="dash-panel customer-experience">
    <div className="panel-heading"><h2>Support &amp; Complaint Center</h2>
      <label className="select-filter">Ticket status<select value={status} onChange={(event) => setStatus(event.target.value as TicketStatus)}>
        {Object.entries(ticketStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select></label>
    </div>
    <SectionData<{ complaints: Ticket[]; agents: Agent[]; level: TicketLevel }> path={`complaints?status=${status}`} {...props}>{({ complaints, agents, level }, save, saving) =>
      <div className="customer-experience-list">
        {!complaints.length && <p>No tickets with this status.</p>}
        {complaints.map((ticket) => <article key={ticket._id}>
          <h3>{ticket.subject}</h3>
          <TicketDetails ticket={ticket} />
          <p>{ticket.details}</p>
          {ticket.response && <p><strong>Last public reply</strong> {ticket.response}</p>}
          <TicketEvidence ticket={ticket} staff onUploaded={onRefresh} />
          <TicketActions ticket={ticket} agents={agents} level={level} save={save} saving={saving} />
        </article>)}
      </div>
    }</SectionData>
  </section>;
}
