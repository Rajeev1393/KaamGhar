"use client";

import { useState } from "react";
import { formatDate } from "@/lib/api";
import { complaintStatuses, type Complaint } from "@/lib/customerExperience";
import { SectionData, type SectionProps } from "./AdminManagement";

export default function AdminComplaints(props: SectionProps) {
  const [status, setStatus] = useState<Complaint["status"]>("open");
  return <section className="dash-panel customer-experience">
    <div className="panel-heading"><h2>Complaints &amp; Disputes</h2>
      <label className="select-filter">Case status<select value={status} onChange={(event) => setStatus(event.target.value as Complaint["status"])}>
        {Object.entries(complaintStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select></label>
    </div>
    <SectionData<{ complaints: Complaint[] }> path={`complaints?status=${status}`} {...props}>{({ complaints }, save, saving) =>
      <div className="customer-experience-list">
        {!complaints.length && <p>No cases with this status.</p>}
        {complaints.map((item) => <article key={item._id}>
          <strong>{item.subject}</strong>
          <span>{item.kind === "dispute" ? "Booking dispute" : "Complaint"} · {item.customer?.name ?? "Customer"} · {formatDate(item.createdAt)}</span>
          {item.booking && <span>Booking ID {item.booking}</span>}
          <p>{item.details}</p>
          <form className="profile-form customer-experience-form" onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void save(`complaints/${item._id}`, "PATCH", {
              status: data.get("status"), previousStatus: item.status, updatedAt: item.updatedAt, response: data.get("response"),
            });
          }}>
            <label>Status<select name="status" defaultValue={item.status === "open" ? "in_review" : item.status}>
              <option value="in_review">In review</option><option value="resolved">Resolved</option>
            </select></label>
            <label>Reply visible to the customer<textarea name="response" defaultValue={item.response} maxLength={2000} rows={3} required /></label>
            <button className="button button-dark" disabled={saving}>Save case update</button>
          </form>
        </article>)}
      </div>
    }</SectionData>
  </section>;
}
