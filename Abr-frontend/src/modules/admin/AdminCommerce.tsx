"use client";

import type { FormEvent } from "react";
import { formatDate, formatPrice } from "@/lib/api";
import { SectionData, type Save, type SectionProps } from "./AdminManagement";
import { commerceTabs, type CommerceTab } from "./navigation";

type Coupon = {
  _id: string; code: string; description: string; kind: "fixed" | "percent"; value: number; expiresAt?: string; active: boolean;
};
type Membership = { _id: string; name: string; benefits: string; price: number; days: number; active: boolean };
type Payout = { _id: string; name?: string; pending: number; cleared: number; canClear: boolean };
type Referral = { _id: string; name: string; referredBy?: { name: string }; createdAt: string };
type Enrollment = { _id: string; name: string; email: string; membership: { name: string; expiresAt: string } };

function fields(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}

function CouponForm({ coupon, save, saving }: { coupon?: Coupon; save: Save; saving: boolean }) {
  return <form className="admin-management-form" onSubmit={(event) => {
    const data = fields(event);
    const expiry = String(data.get("expiresAt") || "");
    void save(coupon ? `coupons/${coupon._id}` : "coupons", coupon ? "PATCH" : "POST", {
      code: data.get("code"), description: data.get("description"), kind: data.get("kind"),
      value: Number(data.get("value")), expiresAt: expiry ? new Date(expiry + "T23:59:59.999+05:30").toISOString() : null,
      active: data.has("active"),
    });
  }}>
    <h3>{coupon ? coupon.code : "Create coupon"}</h3>
    <label>Code<input name="code" pattern="[A-Za-z0-9\-]{3,32}" defaultValue={coupon?.code} required /></label>
    <label>Offer description<input name="description" defaultValue={coupon?.description} maxLength={160} required /></label>
    <label>Discount type<select name="kind" defaultValue={coupon?.kind ?? "fixed"}>
      <option value="fixed">Fixed amount (INR)</option><option value="percent">Percent of booking</option>
    </select></label>
    <label>Discount value<input name="value" type="number" min=".01" step=".01" defaultValue={coupon?.value} required /></label>
    <label>Valid through (India time)<input name="expiresAt" type="date" defaultValue={coupon?.expiresAt ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata", dateStyle: "short" }).format(new Date(coupon.expiresAt)) : ""} /></label>
    <label className="admin-commerce-check"><input type="checkbox" name="active" defaultChecked={coupon?.active ?? true} />Active</label>
    <button className="button button-dark" disabled={saving}>{coupon ? "Save coupon" : "Create coupon"}</button>
  </form>;
}

function Coupons(props: SectionProps) {
  return <SectionData<{ records: Coupon[] }> path="coupons" {...props}>{({ records }, save, saving) => <>
    <p>Share an active code with customers. The discount comes from the platform fee, so the professional receives their full share.</p>
    <div className="admin-management-forms admin-commerce-forms">
      <CouponForm save={save} saving={saving} />
      {records.map((coupon) => <CouponForm key={coupon._id} coupon={coupon} save={save} saving={saving} />)}
    </div>
  </>}</SectionData>;
}

function MembershipForm({ plan, save, saving }: { plan?: Membership; save: Save; saving: boolean }) {
  return <form className="admin-management-form" onSubmit={(event) => {
    const data = fields(event);
    void save(plan ? `memberships/${plan._id}` : "memberships", plan ? "PATCH" : "POST", {
      name: data.get("name"), benefits: data.get("benefits"), price: Number(data.get("price")),
      days: Number(data.get("days")), active: data.has("active"),
    });
  }}>
    <h3>{plan ? plan.name : "Create membership plan"}</h3>
    <label>Plan name<input name="name" defaultValue={plan?.name} maxLength={80} required /></label>
    <label>Benefits<textarea name="benefits" defaultValue={plan?.benefits} maxLength={500} rows={3} required /></label>
    <label>Listed price (INR)<input name="price" type="number" min={0} step=".01" defaultValue={plan?.price ?? 0} required /></label>
    <label>Duration in days<input name="days" type="number" min={1} max={3650} defaultValue={plan?.days ?? 30} required /></label>
    <label className="admin-commerce-check"><input type="checkbox" name="active" defaultChecked={plan?.active ?? true} />Active</label>
    <button className="button button-dark" disabled={saving}>{plan ? "Save plan" : "Create plan"}</button>
  </form>;
}

function Memberships(props: SectionProps) {
  return <SectionData<{ records: Membership[] }> path="memberships" {...props}>{({ records }, save, saving) => {
    const plans = records.filter((plan) => plan.active);
    return <>
      <p>Plans are assigned by an admin. The listed price is for reference.</p>
      <div className="admin-management-forms admin-commerce-forms">
        <MembershipForm save={save} saving={saving} />
        {records.map((plan) => <MembershipForm key={plan._id} plan={plan} save={save} saving={saving} />)}
      </div>
      <section className="admin-management-group">
        <h3>Active memberships</h3>
        <SectionData<{ customers: Enrollment[] }> path="memberships/enrollments" {...props}>{({ customers }, enroll, enrolling) => <>
          {plans.length > 0 && <form className="admin-management-row" onSubmit={(event) => {
            void enroll("memberships/enrollments", "POST", Object.fromEntries(fields(event)));
          }}>
            <label>Customer email<input name="email" type="email" required maxLength={254} /></label>
            <label>Membership plan<select name="planId" required>
              {plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.name}</option>)}
            </select></label>
            <button className="button button-dark" disabled={enrolling}>Assign membership</button>
          </form>}
          {customers.length === 0 && <p>No active memberships.</p>}
          {customers.map((customer) => <div className="admin-management-row" key={customer._id}>
            <strong>{customer.name}</strong><span>{customer.email}</span><span>{customer.membership.name}</span>
            <span>Expires {formatDate(customer.membership.expiresAt)}</span>
          </div>)}
        </>}</SectionData>
      </section>
    </>;
  }}</SectionData>;
}

function Referrals(props: SectionProps) {
  return <SectionData<{ enabled: boolean; total: number; referrals: Referral[] }> path="referrals" {...props}>{({ enabled, total, referrals }, save, saving) => <>
    <div className="admin-management-row">
      <strong>{enabled ? "Referrals enabled" : "Referrals paused"}</strong>
      <button className="button button-dark" disabled={saving} onClick={() => void save("referrals", "PATCH", { enabled: !enabled })}>
        {enabled ? "Pause referrals" : "Enable referrals"}
      </button>
    </div>
    <p>{total} referred signups</p>
    <p>Customers can share a code from their dashboard. Signups are tracked when the new customer enters that code.</p>
    <div className="admin-management-table"><table>
      <thead><tr><th>New customer</th><th>Referred by</th><th>Signed up</th></tr></thead>
      <tbody>{referrals.map((referral) => <tr key={referral._id}>
        <td>{referral.name}</td><td>{referral.referredBy?.name ?? "Unavailable"}</td><td>{formatDate(referral.createdAt)}</td>
      </tr>)}</tbody>
    </table></div>
  </>}</SectionData>;
}

function Payouts(props: SectionProps) {
  return <SectionData<{ payouts: Payout[] }> path="payouts" {...props}>{({ payouts }, save, saving) => <>
    <p>Record a payout here after you have transferred the money.</p>
    {payouts.length === 0 && <p>No professional payouts yet.</p>}
    <div className="admin-management-table"><table>
      <thead><tr><th>Professional</th><th>Pending</th><th>Cleared</th><th>Record transfer</th></tr></thead>
      <tbody>{payouts.map((payout) => <tr key={payout._id}>
        <td>{payout.name ?? "Unavailable professional"}</td>
        <td>₹{formatPrice(payout.pending / 100)}</td><td>₹{formatPrice(payout.cleared / 100)}</td>
        <td>{payout.canClear && payout.pending > 0 && <form className="admin-management-row" onSubmit={(event) => {
          const data = fields(event);
          if (window.confirm(`Mark ₹${formatPrice(payout.pending / 100)} as transferred to ${payout.name}?`)) {
            void save(`professionals/${payout._id}/payouts/clear`, "POST", { reference: data.get("reference"), expectedAmount: payout.pending });
          }
        }}>
          <label>Transfer reference<input name="reference" maxLength={100} required /></label>
          <button className="button button-outline" disabled={saving}>Mark paid</button>
        </form>}</td>
      </tr>)}</tbody>
    </table></div>
  </>}</SectionData>;
}

export default function AdminCommerce({ tab, ...props }: SectionProps & { tab: Exclude<CommerceTab, "transactions"> }) {
  return <section className="dash-panel admin-management">
    <div className="panel-heading"><h2>{commerceTabs.find(({ id }) => id === tab)?.label}</h2></div>
    {tab === "coupons" && <Coupons {...props} />}
    {tab === "memberships" && <Memberships {...props} />}
    {tab === "referrals" && <Referrals {...props} />}
    {tab === "payouts" && <Payouts {...props} />}
  </section>;
}
