"use client";

import CustomerBenefits from "./CustomerBenefits";
import DashboardFrame from "@/components/DashboardFrame";
import { EmptyState, LoadingLine, Metric, StatusPill, WrenchIcon, hasActivePayment } from "@/components/DashboardParts";
import { useTranslation } from "@/components/LanguageProvider";
import { api, formatDate, formatPrice } from "@/lib/api";
import type { Booking, User, Worker } from "@/lib/types";
import { ArrowRight, ArrowUpRight, BadgeCheck, ClipboardList, Clock3, Home, MapPin, RefreshCw, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function CustomerDashboard({ user, refresh, onRefresh, notify }: { user: User; refresh: number; onRefresh: () => void; notify: (message: string) => void }) {
  const { t, locale } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [bookingError, setBookingError] = useState("");
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);

  useEffect(() => {
    api<{ bookings: Booking[] }>("bookings").then((result) => setBookings(result.bookings)).catch((error: Error) => setBookingError(error.message)).finally(() => setBusy(false));
  }, [refresh]);

  useEffect(() => {
    api<{ workers: Worker[] }>("workers").then(({ workers: found }) => setWorkers(found)).catch(() => setWorkers([]));
    const workerId = new URLSearchParams(window.location.search).get("book");
    if (workerId) {
      api<{ workers: Worker[] }>("workers").then(({ workers: found }) => {
        setWorkers(found);
        const selected = found.find((worker) => worker._id === workerId);
        if (selected) setSelectedWorker(selected);
      }).catch(() => setBookingError("Could not load the professional you selected."));
    }
  }, []);

  const openCount = bookings.filter((booking) => ["pending", "confirmed"].includes(booking.status)).length;
  const completedCount = bookings.filter((booking) => booking.status === "completed").length;
  async function cancelBooking(id: string) {
    try {
      await api(`bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
      notify(t("Booking cancelled."));
      onRefresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not cancel booking.");
    }
  }

  async function payForBooking(booking: Booking) {
    setBookingError("");
    setPayingBookingId(booking._id);
    try {
      const order = await api<{
        keyId?: string;
        orderId?: string;
        amount?: number;
        currency?: string;
        alreadyPaid?: boolean;
      }>(`bookings/${booking._id}/payment/order`, { method: "POST" });
      if (order.alreadyPaid) {
        notify("This booking is already paid.");
        onRefresh();
        setPayingBookingId(null);
        return;
      }

      await loadRazorpayCheckout();
      if (!window.Razorpay || !order.keyId || !order.orderId || !order.amount || !order.currency) {
        throw new Error("Could not start Razorpay checkout. Please try again.");
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "KaamGhar",
        description: `${booking.worker?.profession || t("Home service")} booking`,
        order_id: order.orderId,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone,
        },
        theme: { color: "#245c42" },
        handler: (response) => {
          void api<{ message: string; paymentStatus: "paid" }>(`bookings/${booking._id}/payment/verify`, {
            method: "POST",
            body: JSON.stringify(response),
          }).then(() => {
            notify(t("Payment successful."));
            onRefresh();
          }).catch((reason: unknown) => {
            setBookingError(reason instanceof Error ? reason.message : "Could not verify the payment.");
          }).finally(() => setPayingBookingId(null));
        },
        modal: {
          ondismiss: () => setPayingBookingId(null),
        },
      });
      checkout.on("payment.failed", (response) => {
        setBookingError(response.error?.description || "Payment failed. Please try again.");
        setPayingBookingId(null);
      });
      checkout.open();
    } catch (reason) {
      setBookingError(reason instanceof Error ? reason.message : "Could not start the payment.");
      setPayingBookingId(null);
    }
  }

  return <>
    <CustomerBenefits refresh={refresh} />
    <section className="dash-welcome customer-welcome"><div className="welcome-orb"><Home size={24} /></div><div><span className="eyebrow">HEY, {user.name.split(" ")[0].toUpperCase()} ✳</span><h2>{t("More time for the good stuff.")}</h2><p>Your home services and trusted local pros, all in one place.</p></div><Link className="button button-dark" href="/#professionals">{t("Find a pro")}{" "}<ArrowRight size={16} /></Link></section>
    <div className="metric-row"><Metric icon={ClipboardList} label={t("Total bookings")} value={bookings.length} foot={t("Your service history")} /><Metric icon={Clock3} label={t("In progress")} value={openCount} foot={t("Requests underway")} /><Metric icon={BadgeCheck} label={t("Jobs completed")} value={completedCount} foot={t("Good work, done")} /></div>
    <section className="dash-panel" id="bookings"><div className="panel-heading"><div><p className="eyebrow">{t("YOUR SERVICE HISTORY")}</p><h2>{t("Bookings & visits")}</h2></div><button className="button button-outline" onClick={onRefresh}><RefreshCw size={14} />{" "}{t("Refresh")}</button></div>
      {bookingError && <p className="inline-error">{bookingError}</p>}
      {busy ? <LoadingLine /> : bookings.length ? <div className="booking-list">{bookings.map((booking) => <article className="booking-item" key={booking._id}><span className="booking-item-icon"><WrenchIcon /></span><div className="booking-item-main"><div className="booking-item-title"><strong>{booking.worker?.name || t("Your professional")}</strong><StatusPill status={booking.status} /></div><span>{booking.worker?.profession || t("Home service")} · {t(formatDate(booking.scheduledAt, locale))} · {t("{count} hr", { count: booking.durationHours || 1 })}</span><small><MapPin size={12} /> {booking.address}</small>{booking.paymentStatus === "paid" && <small className="payment-status-paid">{t("Payment received")}</small>}{booking.paymentStatus === "refund_required" && <small className="payment-status-error">{t("Booking cancelled after payment. Contact support for a refund.")}</small>}{hasActivePayment(booking) && <small>{t("Payment checkout is active; cancellation is temporarily unavailable.")}</small>}</div><div className="booking-item-price"><strong>₹{formatPrice(booking.totalAmount || 0)}</strong>{["confirmed", "completed"].includes(booking.status) && booking.paymentStatus !== "paid" && booking.paymentStatus !== "refund_required" && <button className="button button-dark" disabled={payingBookingId === booking._id} onClick={() => void payForBooking(booking)}>{payingBookingId === booking._id ? t("Opening…") : t("Pay now")}</button>}{["pending", "confirmed"].includes(booking.status) && booking.paymentStatus !== "paid" && !hasActivePayment(booking) && <button className="cancel-link" onClick={() => void cancelBooking(booking._id)}>{t("Cancel")}</button>}</div></article>)}</div> : <EmptyState title={t("Your next booking starts here.")} text="Find someone good at what they do, right around the corner." action={<Link className="text-link" href="/#professionals">{t("Browse professionals")}{" "}<ArrowRight size={15} /></Link>} />}
    </section>
    <section className="dash-panel browse-panel"><div className="panel-heading"><div><p className="eyebrow">{t("GOOD HANDS, CLOSE BY")}</p><h2>{t("Popular around you")}</h2></div><Link href="/#professionals" className="text-link">{t("See everyone")}{" "}<ArrowRight size={15} /></Link></div><div className="mini-pro-grid">{workers.slice(0, 3).map((worker, index) => <button className="mini-pro-card" key={worker._id} onClick={() => setSelectedWorker(worker)}><span className={`mini-avatar mini-avatar-${index}`}>{worker.name[0]}</span><span className="mini-pro-copy"><strong>{worker.name}</strong><small>{worker.profession} · {worker.city}</small><span><Star size={12} fill="currentColor" /> {worker.rating} ({worker.reviewCount || 0}) · ₹{formatPrice(worker.price)}/hr</span></span><ArrowUpRight size={16} /></button>)}</div></section>
    {selectedWorker && <BookingModal worker={selectedWorker} user={user} onClose={() => { setSelectedWorker(null); window.history.replaceState({}, "", "/customer"); }} onSuccess={() => { setSelectedWorker(null); window.history.replaceState({}, "", "/customer"); notify("Payment successful. Your booking has been sent to your pro."); onRefresh(); }} />}
  </>;
}

type RazorpayPaymentResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal: { ondismiss: () => void };
};

type RazorpayCheckout = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckout;
  }
}

function BookingModal({ worker, user, onClose, onSuccess }: { worker: Worker; user: User; onClose: () => void; onSuccess: () => void }) {
  const { t, locale } = useTranslation();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [minimumDateTime, setMinimumDateTime] = useState("");
  const durationHours = 1;
  const [couponCode, setCouponCode] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const scheduledDate = new Date(String(form.get("scheduledAt") || ""));
    if (Number.isNaN(scheduledDate.getTime())) {
      setError("Please choose a valid date and time.");
      setSaving(false);
      return;
    }
    const scheduledAt = scheduledDate.toISOString();
    try {
      const order = await api<{
        keyId?: string;
        orderId?: string;
        amount?: number;
        currency?: string;
        alreadyPaid?: boolean;
        pendingBooking?: {
          provider: string;
          profession: string;
          address: string;
          scheduledAt: string;
          durationHours: number;
          notes?: string;
        };
      }>("bookings/payment/order", {
        method: "POST",
        body: JSON.stringify({
          workerId: worker._id,
          address: form.get("address"),
          scheduledAt,
          durationHours,
          notes: form.get("notes"),
          couponCode: couponCode.trim()
        })
      });
      if (order.alreadyPaid) {
        onSuccess();
        return;
      }

      if (!order.keyId || !order.orderId || !order.amount || !order.currency) {
        throw new Error("Could not start Razorpay checkout. Please try again.");
      }
      const pending = order.pendingBooking;
      const checkoutHours = pending?.durationHours ?? durationHours;
      const checkoutProfession = pending?.profession ?? worker.profession;
      const duration = `${checkoutHours} hour${checkoutHours === 1 ? "" : "s"}`;
      if (pending && !window.confirm([
        "Resume your previous booking checkout?",
        `Professional: ${pending.provider} (${pending.profession})`,
        `Address: ${pending.address}`,
        `Date and time: ${t(formatDate(pending.scheduledAt, locale))}`,
        `Duration: ${duration}`,
        `Notes: ${pending.notes || "None"}`,
        `Total: ₹${(order.amount / 100).toLocaleString("en-IN")}`
      ].join("\n"))) {
        setError("Your previous checkout is still pending.");
        setSaving(false);
        return;
      }

      await loadRazorpayCheckout();
      if (!window.Razorpay) {
        throw new Error("Could not start Razorpay checkout. Please try again.");
      }
      let verificationStarted = false;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "KaamGhar",
        description: `${checkoutProfession} · ${duration}`,
        order_id: order.orderId,
        prefill: { name: user.name, email: user.email, contact: user.phone },
        theme: { color: "#243d32" },
        handler: (response) => {
          verificationStarted = true;
          void api<{ booking: Booking }>("bookings/payment/verify", {
            method: "POST",
            body: JSON.stringify(response)
          }).then(() => {
            onSuccess();
          }).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : "Could not verify the payment.");
            setSaving(false);
          });
        },
        modal: {
          ondismiss: () => {
            if (!verificationStarted) setSaving(false);
          }
        }
      });
      checkout.on("payment.failed", (response) => {
        setError(response.error?.description || "Payment did not go through. Please try again.");
        setSaving(false);
      });
      checkout.open();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the payment.");
      setSaving(false);
    }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (!saving && event.target === event.currentTarget) onClose(); }}><section className="booking-modal"><button className="modal-close" disabled={saving} onClick={onClose} aria-label={t("Close")}><X size={19} /></button><p className="eyebrow">{t("LET'S GET IT SORTED")}</p><h2>{t("Book {name}.", { name: worker.name.split(" ")[0] })}</h2><p className="modal-intro">{worker.profession} · ₹{formatPrice(worker.price)}{" "}{t("per hour")}</p><form className="modal-form" onSubmit={submit}><label>{t("Service address")}<textarea name="address" required minLength={8} maxLength={300} rows={3} placeholder={t("House number, street, area, city")} /></label><label>{t("Preferred date & time")}<input name="scheduledAt" required type="datetime-local" min={minimumDateTime} onFocus={() => { if (!minimumDateTime) setMinimumDateTime(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)); }} /></label>{/* <label>How many hours?<select name="durationHours" value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))}><option value="1">1 hour · ₹{formatPrice(worker.price)}</option><option value="2">2 hours · ₹{formatPrice(worker.price * 2)}</option><option value="3">3 hours · ₹{formatPrice(worker.price * 3)}</option><option value="4">4 hours · ₹{formatPrice(worker.price * 4)}</option><option value="6">6 hours · ₹{formatPrice(worker.price * 6)}</option><option value="8">8 hours · ₹{formatPrice(worker.price * 8)}</option><option value="12">12 hours · ₹{formatPrice(worker.price * 12)}</option></select></label> */}<div>{t("Duration:")}{" "}{durationHours}{" "}{t("hour")}</div><label>{t("Anything else?")}{" "}<span className="optional-text">{t("Optional")}</span><textarea name="notes" rows={2} maxLength={500} placeholder={t("A little more about the job")} /></label><label>Coupon code (optional)<input name="couponCode" maxLength={32} value={couponCode} onChange={(event) => setCouponCode(event.target.value)} autoComplete="off" /></label>{error && <p className="inline-error">{error}</p>}<button disabled={saving} className="button button-dark modal-submit">{saving ? t("Opening payment…") : couponCode.trim() ? "Apply coupon and pay" : t("Pay ₹{amount} & book", { amount: formatPrice(worker.price * durationHours) })} <ArrowRight size={16} /></button><small>{t("Your booking is sent to the professional only after successful payment.")}</small></form></section></div>;
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve();
      else reject(new Error("Razorpay checkout did not load. Please try again."));
    };
    script.onerror = () => reject(new Error("Could not load Razorpay checkout. Check your internet connection."));
    document.body.appendChild(script);
  });
}

export default function CustomerDashboardPage() {
  return <DashboardFrame expectedRole="customer" Screen={CustomerDashboard} />;
}
