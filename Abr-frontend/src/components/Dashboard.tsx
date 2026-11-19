"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, CalendarDays, Check, ChevronDown, CircleDollarSign, ClipboardList, Clock3, Home, LayoutDashboard, LogOut, MapPin, Menu, RefreshCw, ShieldCheck, Star, Users, X } from "lucide-react";
import { ApiError, api, formatDate, formatPrice } from "@/lib/api";
import type { Booking, ProviderEarnings, Role, ServiceCategory, User, VerificationDocument, Worker } from "@/lib/types";
import DetectCityButton from "@/components/DetectCityButton";

type DashboardProps = { expectedRole: Role };
type AdminStats = { customers: number; professionals: number; pendingApprovals: number; pendingDocuments: number; bookings: number; completedRevenue: number; paymentsReceived: number; paymentsReceivedCount: number; commissionReceived: number; providerAmountReceived: number };
type AdminOverview = { stats: AdminStats; recentBookings: Booking[] };
const verificationDocumentLabels: Record<VerificationDocument["type"], string> = {
  identity: "Identity proof",
  address: "Address proof",
  certificate: "Service certificate",
  other: "Other",
  aadhaar: "Aadhaar card",
  pan: "PAN card",
  police_verification: "Police verification"
};
const formatBookingAmount = (amount: number) => "\u20B9" + formatPrice(amount);
type AdminUser = { _id: string; name: string; email: string; phone: string; role: "customer" | "worker"; active: boolean; createdAt: string; worker?: Pick<Worker, "_id" | "profession" | "category" | "approvalStatus" | "earnings"> };
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

const roleTitles: Record<Role, string> = {
  customer: "My home",
  worker: "Pro workspace",
  admin: "Operations",
};

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status}`}>{status}</span>;
}

function hasActivePayment(booking: Booking) {
  return booking.paymentStatus !== "paid" &&
    booking.paymentStatus !== "refund_required" &&
    Boolean(booking.paymentOrderId || (booking.paymentOrderExpiresAt && Date.parse(booking.paymentOrderExpiresAt) > Date.now()));
}

function DashboardHeader({ user, onLogout, title }: { user: User; onLogout: () => void; title: string }) {
  return <header className="dash-topbar"><div className="dash-mobile-brand"><Link className="brand" href="/"><span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span></Link></div><div className="dash-heading"><p className="eyebrow">{roleTitles[user.role]} / 2026</p><h1>{title}</h1></div><div className="dash-user"><span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.role === "worker" ? "Local service partner" : `${user.role[0].toUpperCase()}${user.role.slice(1)} account`}</small></div><button title="Sign out" onClick={onLogout} className="logout-icon"><LogOut size={17} /></button></div></header>;
}

function DashboardShell({ user, onLogout, children, title }: { user: User; onLogout: () => void; children: React.ReactNode; title: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const links = user.role === "admin"
    ? [{ label: "Overview", href: "/admin", icon: LayoutDashboard }, { label: "Pending", href: "/admin#pending", icon: Users }, { label: "Approved", href: "/admin#approved", icon: Users }, { label: "Rejected", href: "/admin#rejected", icon: Users }, { label: "Categories", href: "/admin#categories", icon: BriefcaseBusiness }, { label: "Users", href: "/admin#users", icon: Users }, { label: "Bookings", href: "/admin#bookings", icon: ClipboardList }, { label: "My profile", href: "/admin#profile", icon: BriefcaseBusiness }]
    : user.role === "worker"
      ? [{ label: "Overview", href: "/provider", icon: LayoutDashboard }, { label: "Service requests", href: "/provider#requests", icon: ClipboardList }, { label: "My profile", href: "/provider#profile", icon: BriefcaseBusiness }]
      : [{ label: "Overview", href: "/customer", icon: LayoutDashboard }, { label: "My bookings", href: "/customer#bookings", icon: CalendarDays }, { label: "Find a pro", href: "/#professionals", icon: SearchIcon }];
  return <div className="dashboard-layout"><aside className={`dash-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}><Link className="brand dash-brand" href="/"><span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span></Link><p className="sidebar-eyebrow">{user.role === "admin" ? "ADMIN · PRIVATE CONSOLE" : user.role === "worker" ? "YOUR BUSINESS" : "YOUR HOME"}</p><nav className="dash-nav">{links.map(({ label, href, icon: Icon }, index) => <Link key={label} className={index === 0 ? "dash-nav-link active" : "dash-nav-link"} href={href} onClick={(event) => { if (user.role === "admin" && index > 0) { event.preventDefault(); window.dispatchEvent(new CustomEvent("kaamghar-admin-tab", { detail: href.split("#")[1] })); } setSidebarOpen(false); }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{index === 0 && <span className="nav-active-mark" />}</Link>)}</nav><div className="sidebar-help"><span className="sidebar-help-icon"><ShieldCheck size={19} /></span><strong>Need a hand?</strong><span>We’re here to help you out.</span><a href="mailto:hello@kaamghar.example">Get in touch <ArrowUpRight size={13} /></a></div><Link href="/" className="sidebar-back"><ArrowLeft size={15} /> Back to marketplace</Link><button className="sidebar-signout" onClick={onLogout}><LogOut size={16} /> Sign out</button></aside><div className="dash-content"><button className="dash-mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu"><Menu size={20} /></button><DashboardHeader user={user} onLogout={onLogout} title={title} />{children}</div></div>;
}

function SearchIcon({ size = 17 }: { size?: number }) {
  return <ArrowUpRight size={size} />;
}

export default function Dashboard({ expectedRole }: DashboardProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountMismatch, setAccountMismatch] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [refresh, setRefresh] = useState(0);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  useEffect(() => {
    const authPath = expectedRole === "admin" ? "admin/auth" : "auth";
    api<{ user: User }>(`${authPath}/me`).then(({ user: current }) => {
      if (current.role !== expectedRole) {
        if (expectedRole === "customer") {
          setAccountMismatch(current.role);
        } else {
          router.replace(current.role === "admin" ? "/admin" : current.role === "worker" ? "/provider" : "/customer");
        }
        return;
      }
      setUser(current);
    }).catch((reason: unknown) => {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        router.replace(expectedRole === "admin" ? "/admin/login" : `/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      setError(reason instanceof Error ? reason.message : "Could not verify your account.");
    }).finally(() => setAuthLoading(false));
  }, [expectedRole, router]);

  async function logout() {
    try {
      const authPath = expectedRole === "admin" ? "admin/auth" : "auth";
      await api(`${authPath}/logout`, { method: "POST" });
      router.push("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign out.");
    }
  }

  async function switchToCustomerAccount() {
    try {
      await api("auth/logout", { method: "POST" });
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(returnTo)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not switch accounts.");
    }
  }

  if (authLoading) return <div className="dashboard-loading" role="status"><span className="loading-dot" /> Checking your account…</div>;
  if (accountMismatch) return <main className="dashboard-loading" role="alert">
    <h1>Customer account required</h1>
    <p>This browser is signed in as a {accountMismatch === "worker" ? "service provider" : accountMismatch}. Sign in with a customer account to book services.</p>
    {error && <p className="inline-error">{error}</p>}
    <button className="button button-dark" onClick={() => void switchToCustomerAccount()}>Sign out and switch to customer</button>
    <Link className="text-link" href="/">Back to marketplace</Link>
  </main>;
  if (!user) return <div className="dashboard-loading" role={error ? "alert" : "status"}><span className="loading-dot" /> {error || "Sign in is required to view this dashboard."} {error ? <button className="button button-outline" onClick={() => window.location.reload()}>Retry</button> : <Link className="text-link" href={expectedRole === "admin" ? "/admin/login" : "/login"}>Go to sign in</Link>}</div>;
  return <DashboardShell user={user} onLogout={() => void logout()} title={expectedRole === "customer" ? "Your home, taken care of." : expectedRole === "worker" ? "Provider dashboard" : "The whole picture."}>
    {error && <div className="dashboard-alert"><span>{error}</span><button onClick={() => setError("")}><X size={15} /></button></div>}
    {expectedRole === "customer" && <CustomerDashboard user={user} refresh={refresh} onRefresh={() => setRefresh(refresh + 1)} notify={notify} />}
    {expectedRole === "worker" && <WorkerDashboard refresh={refresh} onRefresh={() => setRefresh(refresh + 1)} notify={notify} />}
    {expectedRole === "admin" && <AdminDashboard user={user} refresh={refresh} onRefresh={() => setRefresh(refresh + 1)} notify={notify} />}
    {toast && <div className="dash-toast"><Check size={16} />{toast}</div>}
  </DashboardShell>;
}

function CustomerDashboard({ user, refresh, onRefresh, notify }: { user: User; refresh: number; onRefresh: () => void; notify: (message: string) => void }) {
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
      notify("Booking cancelled.");
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
        description: `${booking.worker?.profession || "Home service"} booking`,
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
            notify("Payment successful.");
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
    <section className="dash-welcome customer-welcome"><div className="welcome-orb"><Home size={24} /></div><div><span className="eyebrow">HEY, {user.name.split(" ")[0].toUpperCase()} ✳</span><h2>More time for the good stuff.</h2><p>Your home services and trusted local pros, all in one place.</p></div><Link className="button button-dark" href="/#professionals">Find a pro <ArrowRight size={16} /></Link></section>
    <div className="metric-row"><Metric icon={ClipboardList} label="Total bookings" value={bookings.length} foot="Your service history" /><Metric icon={Clock3} label="In progress" value={openCount} foot="Requests underway" /><Metric icon={BadgeCheck} label="Jobs completed" value={completedCount} foot="Good work, done" /></div>
    <section className="dash-panel" id="bookings"><div className="panel-heading"><div><p className="eyebrow">YOUR SERVICE HISTORY</p><h2>Bookings & visits</h2></div><button className="button button-outline" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button></div>
      {bookingError && <p className="inline-error">{bookingError}</p>}
      {busy ? <LoadingLine /> : bookings.length ? <div className="booking-list">{bookings.map((booking) => <article className="booking-item" key={booking._id}><span className="booking-item-icon"><WrenchIcon /></span><div className="booking-item-main"><div className="booking-item-title"><strong>{booking.worker?.name || "Your professional"}</strong><StatusPill status={booking.status} /></div><span>{booking.worker?.profession || "Home service"} · {formatDate(booking.scheduledAt)} · {booking.durationHours || 1} hr</span><small><MapPin size={12} /> {booking.address}</small>{booking.paymentStatus === "paid" && <small className="payment-status-paid">Payment received</small>}{booking.paymentStatus === "refund_required" && <small className="payment-status-error">Booking cancelled after payment. Contact support for a refund.</small>}{hasActivePayment(booking) && <small>Payment checkout is active; cancellation is temporarily unavailable.</small>}</div><div className="booking-item-price"><strong>₹{formatPrice(booking.totalAmount || 0)}</strong>{["confirmed", "completed"].includes(booking.status) && booking.paymentStatus !== "paid" && booking.paymentStatus !== "refund_required" && <button className="button button-dark" disabled={payingBookingId === booking._id} onClick={() => void payForBooking(booking)}>{payingBookingId === booking._id ? "Opening…" : "Pay now"}</button>}{["pending", "confirmed"].includes(booking.status) && booking.paymentStatus !== "paid" && !hasActivePayment(booking) && <button className="cancel-link" onClick={() => void cancelBooking(booking._id)}>Cancel</button>}</div></article>)}</div> : <EmptyState title="Your next booking starts here." text="Find someone good at what they do, right around the corner." action={<Link className="text-link" href="/#professionals">Browse professionals <ArrowRight size={15} /></Link>} />}
    </section>
    <section className="dash-panel browse-panel"><div className="panel-heading"><div><p className="eyebrow">GOOD HANDS, CLOSE BY</p><h2>Popular around you</h2></div><Link href="/#professionals" className="text-link">See everyone <ArrowRight size={15} /></Link></div><div className="mini-pro-grid">{workers.slice(0, 3).map((worker, index) => <button className="mini-pro-card" key={worker._id} onClick={() => setSelectedWorker(worker)}><span className={`mini-avatar mini-avatar-${index}`}>{worker.name[0]}</span><span className="mini-pro-copy"><strong>{worker.name}</strong><small>{worker.profession} · {worker.city}</small><span><Star size={12} fill="currentColor" /> {worker.rating} ({worker.reviewCount || 0}) · ₹{formatPrice(worker.price)}/hr</span></span><ArrowUpRight size={16} /></button>)}</div></section>
    {selectedWorker && <BookingModal worker={selectedWorker} user={user} onClose={() => { setSelectedWorker(null); window.history.replaceState({}, "", "/customer"); }} onSuccess={() => { setSelectedWorker(null); window.history.replaceState({}, "", "/customer"); notify("Payment successful. Your booking has been sent to your pro."); onRefresh(); }} />}
  </>;
}

function WorkerDashboard({ refresh, onRefresh, notify }: { refresh: number; onRefresh: () => void; notify: (message: string) => void }) {
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
      notify("Your profile is saved.");
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
    {worker?.approvalStatus !== "approved" && worker && <div className="review-banner"><ShieldCheck size={19} /><div><strong>Profile {worker.approvalStatus === "pending" ? "under review" : "not approved yet"}</strong><span>{worker.approvalStatus === "pending" ? "Your listing goes live as soon as our team verifies it." : "Please get in touch with support if you need help with your profile."}</span></div></div>}
    {error && <p className="inline-error">{error}</p>}
    {earningsError && <p className="inline-error">{earningsError}</p>}
    <div className="metric-row provider-earnings"><Metric icon={CircleDollarSign} label="Total earning" value={`₹${formatPrice(earnings.total)}`} foot="Customer payments received" /><Metric icon={Clock3} label="Total pending" value={`₹${formatPrice(earnings.pending)}`} foot="Awaiting admin payout" /><Metric icon={BadgeCheck} label="Payment received" value={`₹${formatPrice(earnings.cleared)}`} foot="Paid by admin" /></div>
    <div className="metric-row"><Metric icon={ClipboardList} label="My bookings" value={bookings.length} foot="Incoming customer requests" /><Metric icon={Clock3} label="Needs a reply" value={pending} foot="Waiting for your response" /><Metric icon={BadgeCheck} label="Jobs complete" value={completed} foot="Completed work" /><Metric icon={CircleDollarSign} label="Profile status" value={worker?.approvalStatus || "—"} foot={worker?.available ? "Accepting new bookings" : "Not taking bookings"} /></div>
    <section className="dash-panel" id="requests"><div className="panel-heading"><div><p className="eyebrow">MY WORKSPACE</p><h2>Booking requests</h2></div><button className="button button-outline" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button></div>{busy ? <LoadingLine /> : bookings.length ? <div className="request-list">{bookings.map((booking) => <article className="request-item" key={booking._id}><div className="request-top"><div><strong>{booking.customer?.name || booking.customerName}</strong><span>{formatDate(booking.scheduledAt)} · {booking.durationHours || 1} hr · ₹{formatPrice(booking.totalAmount || 0)}</span></div><StatusPill status={booking.status} /></div><p><MapPin size={13} /> {booking.address}</p><small>{booking.notes || "No extra details"} · {booking.customer?.phone || booking.phone}</small>{booking.paymentStatus === "paid" && <small className={booking.providerPayoutStatus === "cleared" ? "payment-status-paid" : ""}>Payout: {booking.providerPayoutStatus === "cleared" ? "Paid" : "Pending"}</small>}{booking.paymentStatus === "refund_required" && <small className="payment-status-error">Payment received; contact support to arrange the customer refund.</small>}{hasActivePayment(booking) && <small>Customer payment checkout is active; cancellation is temporarily unavailable.</small>}<div className="request-actions">{booking.status === "pending" && <><button className="button button-dark" onClick={() => void changeStatus(booking._id, "confirmed")}><Check size={14} /> Accept job</button><button className="button button-outline danger-button" onClick={() => void changeStatus(booking._id, "cancelled")}>Decline</button></>}{booking.status === "confirmed" && <><button className="button button-dark" onClick={() => void changeStatus(booking._id, "completed")}><BadgeCheck size={14} /> Mark complete</button>{!hasActivePayment(booking) && <button className="button button-outline danger-button" onClick={() => void changeStatus(booking._id, "cancelled")}>{booking.paymentStatus === "paid" ? "Cancel & flag refund" : "Cancel"}</button>}</>}</div></article>)}</div> : <EmptyState title="No requests yet." text="Once your profile is approved, new service requests will appear here." />}</section>
    {worker && <section className="dash-panel" id="profile"><div className="panel-heading"><div><p className="eyebrow">YOUR LISTING, YOUR STORY</p><h2>Professional profile</h2></div><StatusPill status={worker.available ? "available" : "paused"} /></div><form className="profile-form" onSubmit={saveProfile}><div className="form-grid-two"><label>Your profession<input name="profession" defaultValue={worker.profession} required maxLength={80} /></label><label>Service category<select name="category" defaultValue={worker.category} required>{categories.map(({ name, label }) => <option key={name} value={name}>{label}</option>)}</select></label></div><div className="form-grid-two"><div className="location-field"><label>City<input name="city" value={workerCity} onChange={(event) => setWorkerCity(event.target.value)} required maxLength={80} /></label><DetectCityButton compact onCity={setWorkerCity} /></div><label>Experience (years)<input name="experience" defaultValue={worker.experience} type="number" min={0} max={60} required /></label></div><div className="form-grid-two"><label>Hourly rate (₹)<input name="price" defaultValue={worker.price} type="number" min={1} required /></label><label className="availability-check"><input name="available" type="checkbox" defaultChecked={worker.available} /> Accept new bookings</label></div><label>About your service<textarea name="description" defaultValue={worker.description || ""} rows={3} minLength={10} maxLength={300} required /></label><button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save profile"} <ArrowRight size={15} /></button></form><div className="document-upload-panel"><div className="panel-heading"><div><p className="eyebrow">IDENTITY & SKILL CHECK</p><h3>Verification documents</h3></div><span className="result-count">{worker.verificationDocuments?.length || 0}/10 uploaded</span></div><p>Upload an ID, address proof, or service certificate. PDF, JPG, or PNG, up to 5 MB each. Documents are private and reviewed by admin.</p><form className="document-upload-form" onSubmit={uploadDocument}><label>Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value as VerificationDocument["type"])}><option value="identity">Identity proof</option><option value="address">Address proof</option><option value="certificate">Service certificate</option><option value="other">Other</option></select></label><label>Choose document<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} required /></label><button className="button button-dark" disabled={uploadingDocument}>{uploadingDocument ? "Uploading…" : "Upload document"}</button></form>{worker.verificationDocuments?.length ? <div className="document-status-list">{worker.verificationDocuments.map((document) => <div className="document-status-item" key={document._id}><span>{document.type} · {document.originalName}</span><StatusPill status={document.status} /></div>)}</div> : <p>No verification documents uploaded yet.</p>}</div></section>}
  </>;
}

function AdminDashboard({ user, refresh, onRefresh, notify }: { user: User; refresh: number; onRefresh: () => void; notify: (message: string) => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workersLoadedKey, setWorkersLoadedKey] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userRole, setUserRole] = useState<"all" | "customer" | "worker">("all");
  const [tab, setTab] = useState<"overview" | "pending" | "approved" | "rejected" | "categories" | "users" | "bookings" | "profile">("overview");
  const [showCreateProfessional, setShowCreateProfessional] = useState(false);
  const [professionalCategory, setProfessionalCategory] = useState("");
  const professionalRateCategory = categories.find(({ name }) => name === professionalCategory);
  const hourlyCommission = professionalRateCategory?.commission;
  const baseRate = professionalRateCategory?.price ?? 0;
  const commissionPaise = Math.round(hourlyCommission?.type === "percentage"
    ? baseRate * hourlyCommission.value
    : (hourlyCommission?.value ?? 0) * 100);
  const customerHourlyRate = (Math.round(baseRate * 100) + commissionPaise) / 100;
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [busy, setBusy] = useState(true);
  const [usersLoadedKey, setUsersLoadedKey] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingCategoryPrice, setSavingCategoryPrice] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [savingProfessional, setSavingProfessional] = useState(false);
  const [deletingProfessionalId, setDeletingProfessionalId] = useState<string | null>(null);
  const [clearingPayoutId, setClearingPayoutId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const professionalTabStatus = tab === "approved" || tab === "rejected" ? tab : "pending";
  const showProfessionalApplications = tab === "pending" || tab === "approved" || tab === "rejected";
  const workersRequestKey = `${professionalTabStatus}:${refresh}`;
  const workersLoading = showProfessionalApplications && workersLoadedKey !== workersRequestKey;
  const usersQuery = userRole === "all" ? "" : `?role=${userRole}`;
  const usersRequestKey = `${usersQuery}:${refresh}`;
  const usersLoading = tab === "users" && usersLoadedKey !== usersRequestKey;

  useEffect(() => {
    function selectAdminTab(event: Event) {
      const selectedTab = (event as CustomEvent<string>).detail;
      if (["overview", "pending", "approved", "rejected", "categories", "users", "bookings", "profile"].includes(selectedTab)) {
        setTab(selectedTab as "overview" | "pending" | "approved" | "rejected" | "categories" | "users" | "bookings" | "profile");
      }
    }
    window.addEventListener("kaamghar-admin-tab", selectAdminTab);
    return () => window.removeEventListener("kaamghar-admin-tab", selectAdminTab);
  }, []);

  useEffect(() => {
    Promise.all([api<AdminOverview>("admin/overview"), api<{ bookings: Booking[] }>("admin/bookings")])
      .then(([stats, result]) => { setOverview(stats); setBookings(result.bookings); })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setBusy(false));
  }, [refresh]);

  useEffect(() => {
    if (!showProfessionalApplications) return;
    let active = true;
    api<{ workers: Worker[] }>(`admin/professionals?status=${professionalTabStatus}`)
      .then(({ workers: result }) => {
        if (active) {
          setWorkers(result);
          setWorkersLoadedKey(workersRequestKey);
        }
      })
      .catch((reason: Error) => {
        if (active) {
          setError(reason.message);
          setWorkersLoadedKey(workersRequestKey);
        }
      });
    return () => { active = false; };
  }, [showProfessionalApplications, professionalTabStatus, workersRequestKey]);

  useEffect(() => {
    if (tab !== "users") return;
    let active = true;
    api<{ users: AdminUser[] }>(`admin/users${usersQuery}`)
      .then(({ users: result }) => {
        if (active) {
          setUsers(result);
          setUsersLoadedKey(usersRequestKey);
        }
      })
      .catch((reason: Error) => {
        if (active) {
          setError(reason.message);
          setUsersLoadedKey(usersRequestKey);
        }
      });
    return () => { active = false; };
  }, [tab, usersQuery, usersRequestKey]);

  useEffect(() => {
    if (tab !== "categories" && !(tab === "users" && showCreateProfessional)) return;
    let active = true;
    async function loadCategories() {
      await Promise.resolve();
      if (!active) return;
      setCategoriesLoading(true);
      try {
        const { categories: result } = await api<{ categories: ServiceCategory[] }>("admin/categories");
        if (active) setCategories(result);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load categories.");
      } finally {
        if (active) setCategoriesLoading(false);
      }
    }
    void loadCategories();
    return () => { active = false; };
  }, [tab, refresh, showCreateProfessional]);

  async function moderate(id: string, nextStatus: "approved" | "rejected") {
    try {
      await api(`admin/professionals/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      notify(nextStatus === "approved"
        ? "Employee approved successfully and moved to Users."
        : "Professional rejected successfully and moved to Rejected.");
      if (nextStatus === "approved") {
        setUserRole("worker");
        setTab("users");
      } else {
        setTab("rejected");
      }
      onRefresh();
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Could not update this profile.");
    }
  }

  async function deleteProfessional(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? Their login and documents will be removed. Booking history will be kept with employee details anonymized.`)) return;
    setDeletingProfessionalId(id);
    try {
      await api(`admin/professionals/${id}`, { method: "DELETE" });
      setWorkers((current) => current.filter((worker) => worker._id !== id));
      setUsers((current) => current.filter((account) => account.worker?._id !== id));
      notify(`${name} deleted. Booking history was preserved.`);
      onRefresh();
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Could not delete this employee.");
    } finally {
      setDeletingProfessionalId(null);
    }
  }

  async function clearPayout(workerId: string, workerName: string, pendingAmount: number) {
    if (!pendingAmount) return;
    if (!window.confirm(`Mark ₹${formatPrice(pendingAmount)} for ${workerName} as paid out? This records a manual payout; it does not transfer money.`)) return;
    setClearingPayoutId(workerId);
    try {
      const result = await api<{ message: string; payout: { amount: number; bookingCount: number } }>(
        `admin/professionals/${workerId}/payouts/clear`,
        { method: "POST", body: JSON.stringify({}) }
      );
      notify(`₹${formatPrice(result.payout.amount)} marked as payment received for ${workerName}.`);
      onRefresh();
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Could not clear this payout.");
    } finally {
      setClearingPayoutId(null);
    }
  }

  async function reviewDocument(workerId: string, documentId: string, nextStatus: "verified" | "rejected") {
    try {
      await api(`admin/professionals/${workerId}/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      notify(`Document ${nextStatus}.`);
      onRefresh();
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Could not update this document.");
    }
  }

  async function setUserActive(userId: string, active: boolean) {
    try {
      await api(`admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });
      notify(`Account ${active ? "activated" : "deactivated"}.`);
      onRefresh();
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Could not update this account.");
    }
  }

  async function addCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavingCategory(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") || "").trim();
    const label = String(form.get("label") || "").trim();
    try {
      const result = await api<{ category: ServiceCategory }>("admin/categories", {
        method: "POST",
        body: JSON.stringify({ name, label }),
      });
      setCategories((current) => [...current, result.category].sort((left, right) => left.name.localeCompare(right.name)));
      formElement.reset();
      notify(`${result.category.name} category added.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add this category.");
    } finally {
      setSavingCategory(false);
    }
  }

  async function updateCategoryPrice(event: React.FormEvent<HTMLFormElement>, categoryName: string) {
    event.preventDefault();
    setError("");
    setSavingCategoryPrice(categoryName);
    const form = new FormData(event.currentTarget);
    const price = Number(form.get("price"));
    try {
      const result = await api<{ category: ServiceCategory }>(`admin/categories/${encodeURIComponent(categoryName)}`, {
        method: "PATCH",
        body: JSON.stringify({
          price,
          commission: { type: form.get("commissionType"), value: Number(form.get("commissionValue")) }
        }),
      });
      setCategories((current) => current.map((category) =>
        category.name === categoryName ? result.category : category
      ));
      notify(`${categoryName} price and commission updated.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this category price.");
    } finally {
      setSavingCategoryPrice(null);
    }
  }

  async function deleteCategory(categoryName: string) {
    if (!window.confirm(`Delete the ${categoryName} category? Categories assigned to professionals cannot be deleted.`)) return;
    setError("");
    setDeletingCategory(categoryName);
    try {
      await api(`admin/categories/${encodeURIComponent(categoryName)}`, { method: "DELETE" });
      setCategories((current) => current.filter((category) => category.name !== categoryName));
      notify(`${categoryName} category deleted.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this category.");
    } finally {
      setDeletingCategory(null);
    }
  }

  async function addProfessional(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavingProfessional(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const professional = {
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      password: String(form.get("password") || ""),
      profession: String(form.get("profession") || "").trim(),
      category: String(form.get("category") || ""),
      city: String(form.get("city") || "").trim(),
    };
    try {
      await api("admin/professionals", {
        method: "POST",
        body: JSON.stringify(professional),
      });
      formElement.reset();
      setProfessionalCategory("");
      notify(`${professional.name} added as a pending professional.`);
      setShowCreateProfessional(false);
      setTab("pending");
      onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not register this professional.");
    } finally {
      setSavingProfessional(false);
    }
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "pending", label: overview?.stats.pendingApprovals ? `Pending · ${overview.stats.pendingApprovals}` : "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "categories", label: "Categories" },
    { id: "users", label: "Users" },
    { id: "bookings", label: "All bookings" },
    { id: "profile", label: "My profile" }
  ] as const;

  return <>
    {error && <p className="inline-error">{error}</p>}
    <div className="admin-tabs">{tabs.map((item) => <button className={tab === item.id ? "admin-tab selected" : "admin-tab"} key={item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}<button className="button button-dark" onClick={() => { setShowCreateProfessional(true); setTab("users"); }}>Create professional</button><button className="button button-outline tab-refresh" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button></div>
    {tab === "overview" && <>
      <section className="admin-welcome"><div><p className="eyebrow">A GOOD DAY TO GET THINGS DONE</p><h2>The whole picture.</h2><span>Here’s what’s happening across your neighbourhood.</span></div><div className="admin-welcome-art"><SparkleIcon /></div></section>
      <div className="metric-row admin-metrics"><Metric icon={Users} label="Customers" value={overview?.stats.customers ?? "—"} foot="Registered households" onClick={() => { setUserRole("customer"); setTab("users"); }} /><Metric icon={BriefcaseBusiness} label="Live professionals" value={overview?.stats.professionals ?? "—"} foot="Approved service pros" onClick={() => setTab("approved")} /><Metric icon={ShieldCheck} label="Needs your review" value={overview?.stats.pendingApprovals ?? "—"} foot={`${overview?.stats.pendingDocuments ?? 0} documents pending`} onClick={() => setTab("pending")} /><Metric icon={ClipboardList} label="Total bookings" value={overview?.stats.bookings ?? "—"} foot="Marketplace requests" onClick={() => setTab("bookings")} /><Metric icon={CircleDollarSign} label="Payments received" value={`₹${formatPrice(overview?.stats.paymentsReceived ?? 0)}`} foot={`${overview?.stats.paymentsReceivedCount ?? 0} captured bookings`} onClick={() => setTab("bookings")} /></div>
      <section className="dash-panel"><div className="panel-heading"><div><p className="eyebrow">THE NEIGHBOURHOOD PULSE</p><h2>Latest bookings</h2></div><button className="text-link" onClick={() => setTab("bookings")}>See all <ArrowRight size={15} /></button></div>{busy ? <LoadingLine /> : overview?.recentBookings.length ? <div className="booking-list">{overview.recentBookings.map((booking) => <article className="booking-item" key={booking._id}><span className="booking-item-icon"><WrenchIcon /></span><div className="booking-item-main"><div className="booking-item-title"><strong>{booking.customer?.name || booking.customerName}</strong><StatusPill status={booking.status} /></div><span>{booking.worker?.name || "Pro"} · {formatDate(booking.scheduledAt)}</span><small><MapPin size={12} /> {booking.address}</small><small>Razorpay Order ID: {booking.paymentOrderId || "—"} · {booking.paymentStatus === "paid" ? "Payment received" : booking.paymentStatus === "refund_required" ? "Refund required" : "Unpaid"}</small></div><strong className="booking-item-price">₹{formatPrice(booking.totalAmount || 0)}</strong></article>)}</div> : <EmptyState title="No bookings yet." text="Marketplace activity will show up here." />}</section>
      <div className="revenue-card"><span><CircleDollarSign size={20} /></span><div><small>COMPLETED SERVICE VALUE</small><strong>₹{formatPrice(overview?.stats.completedRevenue || 0)}</strong></div><span className="revenue-note"><Check size={14} /> Completed bookings</span></div>
      <div className="revenue-card"><span><CircleDollarSign size={20} /></span><div><small>PLATFORM COMMISSION COLLECTED</small><strong>₹{formatPrice(overview?.stats.commissionReceived ?? 0)}</strong></div></div>
    </>}
    {tab === "profile" && <section className="dash-panel"><div className="panel-heading"><div><p className="eyebrow">ADMIN ACCOUNT</p><h2>My profile</h2></div></div><article className="admin-pro-item"><span className="mini-avatar">{user.name[0]?.toUpperCase() || "A"}</span><div className="admin-pro-info"><strong>{user.name}</strong><span>Administrator</span><small>Email: {user.email}</small><small>Phone: {user.phone}</small></div></article></section>}
    {showProfessionalApplications && <section className="dash-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">QUALITY & TRUST</p><h2>{professionalTabStatus === "pending" ? "Pending applications" : `${professionalTabStatus[0].toUpperCase()}${professionalTabStatus.slice(1)} professionals`}</h2></div>
        <span className="result-count">{professionalTabStatus === "pending" ? "Awaiting review" : `${professionalTabStatus[0].toUpperCase()}${professionalTabStatus.slice(1)} applications`}</span>
      </div>
      {workersLoading ? <LoadingLine /> : workers.length ? <div className="admin-pro-list">{workers.map((worker) => {
        const documents = worker.verificationDocuments || [];
        const unverifiedCount = documents.filter((document) => document.status !== "verified").length;
        const canApprove = unverifiedCount === 0;
        return <article className="admin-pro-item" key={worker._id}>
          <span className="mini-avatar">{worker.name[0]}</span>
          <div className="admin-pro-info">
            <strong>{worker.name}</strong>
            <span>{worker.profession} · {worker.category}</span>
            <small>{worker.user?.email} · {worker.user?.phone}</small>
            <small>{worker.experience} years · {worker.city} · ₹{formatPrice(worker.price)} / hour</small>
            <small>Income: ₹{formatPrice(worker.earnings?.total || 0)} · Pending: ₹{formatPrice(worker.earnings?.pending || 0)} · Payment received: ₹{formatPrice(worker.earnings?.cleared || 0)}</small>
            <p>{worker.description}</p>
            <div className="verification-documents">
              <strong>Verification documents ({documents.length})</strong>
              {documents.length
                ? documents.map((document) => <div className="verification-document" key={document._id}>
                    <div className="verification-document-name">
                      <strong>{verificationDocumentLabels[document.type]}</strong>
                      <span>{document.originalName}</span>
                    </div>
                    <a className="button button-outline" href={`/api/admin/professionals/${worker._id}/documents/${document._id}/file`} target="_blank" rel="noreferrer" aria-label={`Preview ${verificationDocumentLabels[document.type]}: ${document.originalName} (opens in a new tab)`}>Preview</a>
                    <StatusPill status={document.status} />
                    {document.status === "pending" && <><button className="button button-outline" onClick={() => void reviewDocument(worker._id, document._id, "verified")}>Verify</button><button className="button button-outline danger-button" onClick={() => void reviewDocument(worker._id, document._id, "rejected")}>Reject</button></>}
                  </div>)
                : <small>No documents uploaded yet.</small>}
              {professionalTabStatus !== "approved" && !canApprove && <small className="inline-error">Review and verify each uploaded document before approving this application.</small>}
            </div>
          </div>
          <div className="admin-pro-actions">
            <StatusPill status={worker.approvalStatus} />
            {(worker.earnings?.pending || 0) > 0 && <button className="button button-outline" disabled={clearingPayoutId === worker._id} onClick={() => void clearPayout(worker._id, worker.name, worker.earnings?.pending || 0)}>
              {clearingPayoutId === worker._id ? "Processing…" : `Payout ₹${formatPrice(worker.earnings?.pending || 0)}`}
            </button>}
            {professionalTabStatus === "pending"
              ? <><button className="button button-dark" disabled={!canApprove} onClick={() => void moderate(worker._id, "approved")}><Check size={14} /> {canApprove ? "Approve" : `Verify ${unverifiedCount} first`}</button><button className="button button-outline danger-button" onClick={() => void moderate(worker._id, "rejected")}>Reject</button></>
              : professionalTabStatus === "approved"
                ? <button className="button button-outline danger-button" onClick={() => void moderate(worker._id, "rejected")}>Reject</button>
                : <button className="button button-dark" disabled={!canApprove} onClick={() => void moderate(worker._id, "approved")}>{canApprove ? "Approve profile" : `Verify ${unverifiedCount} first`}</button>}
            <button className="button button-outline danger-button" disabled={deletingProfessionalId === worker._id} onClick={() => void deleteProfessional(worker._id, worker.name)}>
              {deletingProfessionalId === worker._id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </article>;
      })}</div> : <EmptyState title={`No ${professionalTabStatus} applications.`} text={professionalTabStatus === "pending" ? "New professional applications will appear here." : `${professionalTabStatus[0].toUpperCase()}${professionalTabStatus.slice(1)} professionals will appear here.`} />}
    </section>}
    {tab === "categories" && <>
      <section className="dash-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">MARKETPLACE SETUP</p><h2>Service categories</h2></div>
          <span className="result-count">{categories.length} total</span>
        </div>
        <p>Create categories for professional registration. New options appear in the signup form right away.</p>
        <form className="profile-form" onSubmit={addCategory}>
          <div className="form-grid-two">
            <label>Category name<input name="name" required minLength={2} maxLength={60} placeholder="e.g. Appliance repair" /></label>
            <label>Display label (optional)<input name="label" maxLength={80} placeholder="Defaults to category name" /></label>
          </div>
          <button className="button button-dark" disabled={savingCategory}>{savingCategory ? "Adding…" : "Add category"}</button>
        </form>
        {categories.length ? <div className="admin-pro-list">{categories.map((category) => <article className="admin-pro-item" key={category.name}>
          <span className="mini-avatar">{category.name[0]}</span>
          <div className="admin-pro-info"><strong>{category.name}</strong><span>Signup label: {category.label}</span></div>
          <form className="category-price-form" key={`${category.price}-${category.commission?.type}-${category.commission?.value}`} onSubmit={(event) => void updateCategoryPrice(event, category.name)}>
            <label>Price (₹)<input name="price" type="number" min={1} max={1000000} step="1" defaultValue={category.price} required /></label>
            <label>Commission type<select name="commissionType" defaultValue={category.commission?.type ?? "percentage"}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed (₹)</option>
            </select></label>
            <label>Commission value<input name="commissionValue" type="number" min={0} step="0.01" defaultValue={category.commission?.value ?? 0} required /></label>
            <button className="button button-dark" disabled={savingCategoryPrice === category.name || deletingCategory === category.name}>{savingCategoryPrice === category.name ? "Saving…" : "Save"}</button>
          </form>
          <button className="button button-outline danger-button" disabled={deletingCategory === category.name || savingCategoryPrice === category.name} onClick={() => void deleteCategory(category.name)}>
            {deletingCategory === category.name ? "Deleting…" : "Delete"}
          </button>
        </article>)}</div> : <EmptyState title="No categories yet." text="Add a service category to make it available to professionals." />}
      </section>
    </>}
    {tab === "users" && <section className="dash-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">ACCOUNT MANAGEMENT</p><h2>Customers & professionals</h2></div>
        <div className="panel-actions">
          <label className="select-filter">Role<select value={userRole} onChange={(event) => setUserRole(event.target.value as "all" | "customer" | "worker")}><option value="all">Everyone</option><option value="customer">Customers</option><option value="worker">Professionals</option></select><ChevronDown size={14} /></label>
          <button className="button button-dark" onClick={() => { setProfessionalCategory(""); setShowCreateProfessional(!showCreateProfessional); }}>{showCreateProfessional ? "Close form" : "Create professional"}</button>
        </div>
      </div>
      {showCreateProfessional && <div className="user-create-form">
        <p className="eyebrow">PROFESSIONAL ONBOARDING</p>
        <h3>Create a professional account</h3>
        <p>This creates the professional login and a pending listing. The professional can sign in after creation; the listing appears on the marketplace after approval.</p>
        <form className="profile-form" onSubmit={addProfessional}>
          <div className="form-grid-two">
            <label>Provider name<input name="name" required minLength={2} maxLength={80} /></label>
            <label>Location / city<input name="city" required minLength={2} maxLength={80} /></label>
          </div>
          <div className="form-grid-two">
            <label>Service provided<input name="profession" required minLength={2} maxLength={80} placeholder="e.g. AC repair technician" /></label>
            <label>Service category<select name="category" required value={professionalRateCategory?.name ?? ""} onChange={(event) => setProfessionalCategory(event.target.value)} disabled={categoriesLoading || categories.length === 0}><option value="" disabled>{categoriesLoading ? "Loading categories…" : categories.length ? "Choose a category" : "No categories available"}</option>{categories.map(({ name, label }) => <option key={name} value={name}>{label}</option>)}</select></label>
          </div>
          <div className="form-grid-two">
            <label>Email for login<input name="email" type="email" required maxLength={254} /></label>
            <label>Phone<input name="phone" type="tel" required minLength={8} maxLength={20} /></label>
          </div>
          <div className="form-grid-two">
            <label>Customer hourly rate (₹)<input type="text" value={professionalRateCategory ? formatPrice(customerHourlyRate) : ""} placeholder="Choose a category" readOnly />
              {professionalRateCategory && <small>Category rate ₹{formatPrice(baseRate)} + commission ₹{formatPrice(commissionPaise / 100)}{hourlyCommission?.type === "percentage" ? ` (${hourlyCommission.value}%)` : ""}</small>}
            </label>
            <label>Temporary password<input name="password" type="password" required minLength={8} maxLength={72} /></label>
          </div>
          <button className="button button-dark" disabled={savingProfessional || categoriesLoading || !professionalRateCategory}>{savingProfessional ? "Creating…" : "Create professional account"}</button>
        </form>
      </div>}
      {usersLoading ? <LoadingLine /> : users.length ? <div className="admin-pro-list">{users.map((account) => <article className="admin-pro-item" key={account._id}>
        <span className="mini-avatar">{account.name[0]}</span>
        <div className="admin-pro-info">
          <strong>{account.name}</strong>
          <span>{account.role === "worker" ? `${account.worker?.profession || "Professional"} · ${account.worker?.category || "No category"}` : "Customer account"}</span>
          <small>{account.email} · {account.phone}</small>
          <small>Joined {formatDate(account.createdAt)} · {account.worker?.approvalStatus || (account.active ? "active" : "inactive")}</small>
          {account.role === "worker" && <small>Income: ₹{formatPrice(account.worker?.earnings?.total || 0)} · Pending: ₹{formatPrice(account.worker?.earnings?.pending || 0)} · Payment received: ₹{formatPrice(account.worker?.earnings?.cleared || 0)}</small>}
        </div>
        <div className="admin-pro-actions">
          <StatusPill status={account.active ? "active" : "inactive"} />
          <button className={account.active ? "button button-outline danger-button" : "button button-dark"} onClick={() => void setUserActive(account._id, !account.active)}>{account.active ? "Deactivate" : "Reactivate"}</button>
          {account.role === "worker" && account.worker?._id && (account.worker.earnings?.pending || 0) > 0 && <button className="button button-outline" disabled={clearingPayoutId === account.worker._id} onClick={() => {
            const workerId = account.worker?._id;
            if (workerId) void clearPayout(workerId, account.name, account.worker?.earnings?.pending || 0);
          }}>
            {clearingPayoutId === account.worker._id ? "Processing…" : `Payout ₹${formatPrice(account.worker.earnings?.pending || 0)}`}
          </button>}
          {account.role === "worker" && account.worker?._id && <button className="button button-outline danger-button" disabled={deletingProfessionalId === account.worker?._id} onClick={() => {
            const workerId = account.worker?._id;
            if (workerId) void deleteProfessional(workerId, account.name);
          }}>
            {deletingProfessionalId === account.worker?._id ? "Deleting…" : "Delete"}
          </button>}
        </div>
      </article>)}</div> : <EmptyState title="No accounts found." text="Registered customer and professional accounts will appear here." />}
    </section>}
    {tab === "bookings" && <section className="dash-panel">
      <div className="panel-heading"><div><p className="eyebrow">MARKETPLACE OPERATIONS</p><h2>All bookings</h2></div><span className="result-count">{bookings.length} total</span></div>
      <BookingPaymentSummary stats={overview?.stats} bookings={bookings} />
      {bookings.length ? <div className="admin-booking-list">{bookings.map((booking) => {
        const total = booking.totalAmount ?? 0;
        const commission = booking.commissionAmount ?? 0;
        const provider = (Math.round(total * 100) - Math.round(commission * 100)) / 100;
        return <article className="admin-booking-item" key={booking._id}>
          <div><strong>{booking.customer?.name || booking.customerName}</strong><span>Customer</span></div>
          <ArrowRight size={15} />
          <div><strong>{booking.worker?.name || "Professional"}</strong><span>{booking.worker?.profession}</span></div>
          <div><strong>{formatDate(booking.scheduledAt)}</strong><span>{booking.address}</span><span>Razorpay Order ID: {booking.paymentOrderId || "\u2014"}</span><span>{booking.paymentStatus === "paid" ? "Payment received" : booking.paymentStatus === "refund_required" ? "Refund required" : "Unpaid"}</span></div>
          <dl className="booking-payment-breakdown">
            <div><dt>Customer total</dt><dd>{formatBookingAmount(total)}</dd></div>
            <div><dt>Provider share</dt><dd>{formatBookingAmount(provider)}</dd></div>
            <div><dt>Platform commission</dt><dd>{formatBookingAmount(commission)}</dd></div>
          </dl>
          <StatusPill status={booking.status} />
        </article>;
      })}</div> : <EmptyState title="No bookings yet." text="New customer bookings will appear here." />}
    </section>}
  </>;
}

function BookingPaymentSummary({ stats, bookings }: { stats?: AdminStats; bookings: Booking[] }) {
  const hasServerTotals = stats?.providerAmountReceived != null && stats.commissionReceived != null;
  let providerPaise = 0;
  let commissionPaise = 0;
  if (hasServerTotals) {
    providerPaise = Math.round(stats.providerAmountReceived * 100);
    commissionPaise = Math.round(stats.commissionReceived * 100);
  } else {
    for (const booking of bookings) {
      if (booking.paymentStatus !== "paid") continue;
      const commission = Math.round((booking.commissionAmount ?? 0) * 100);
      commissionPaise += commission;
      providerPaise += Math.round((booking.totalAmount ?? 0) * 100) - commission;
    }
  }

  const foot = hasServerTotals || stats?.bookings === bookings.length ? "From paid bookings" : "From listed paid bookings";
  const showAmount = (paise: number) => stats ? formatBookingAmount(paise / 100) : "\u2014";
  return <div className="booking-payment-summary" aria-label="Paid booking totals">
    <Metric icon={CircleDollarSign} label="Total paid" value={showAmount(providerPaise + commissionPaise)} foot={foot} />
    <Metric icon={BriefcaseBusiness} label="Provider share" value={showAmount(providerPaise)} foot={foot} />
    <Metric icon={CircleDollarSign} label="Platform commission" value={showAmount(commissionPaise)} foot={foot} />
  </div>;
}

function BookingModal({ worker, user, onClose, onSuccess }: { worker: Worker; user: User; onClose: () => void; onSuccess: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [minimumDateTime, setMinimumDateTime] = useState("");
  const durationHours = 1;

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
          notes: form.get("notes")
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
        `Date and time: ${formatDate(pending.scheduledAt)}`,
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
  return <div className="modal-backdrop" onMouseDown={(event) => { if (!saving && event.target === event.currentTarget) onClose(); }}><section className="booking-modal"><button className="modal-close" disabled={saving} onClick={onClose} aria-label="Close"><X size={19} /></button><p className="eyebrow">LET&apos;S GET IT SORTED</p><h2>Book {worker.name.split(" ")[0]}.</h2><p className="modal-intro">{worker.profession} · ₹{formatPrice(worker.price)} per hour</p><form className="modal-form" onSubmit={submit}><label>Service address<textarea name="address" required minLength={8} maxLength={300} rows={3} placeholder="House number, street, area, city" /></label><label>Preferred date & time<input name="scheduledAt" required type="datetime-local" min={minimumDateTime} onFocus={() => { if (!minimumDateTime) setMinimumDateTime(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)); }} /></label>{/* <label>How many hours?<select name="durationHours" value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))}><option value="1">1 hour · ₹{formatPrice(worker.price)}</option><option value="2">2 hours · ₹{formatPrice(worker.price * 2)}</option><option value="3">3 hours · ₹{formatPrice(worker.price * 3)}</option><option value="4">4 hours · ₹{formatPrice(worker.price * 4)}</option><option value="6">6 hours · ₹{formatPrice(worker.price * 6)}</option><option value="8">8 hours · ₹{formatPrice(worker.price * 8)}</option><option value="12">12 hours · ₹{formatPrice(worker.price * 12)}</option></select></label> */}<div>Duration: {durationHours} hour</div><label>Anything else? <span className="optional-text">Optional</span><textarea name="notes" rows={2} maxLength={500} placeholder="A little more about the job" /></label>{error && <p className="inline-error">{error}</p>}<button disabled={saving} className="button button-dark modal-submit">{saving ? "Opening payment…" : `Pay ₹${formatPrice(worker.price * durationHours)} & book`} <ArrowRight size={16} /></button><small>Your booking is sent to the professional only after successful payment.</small></form></section></div>;
}

function Metric({ icon: Icon, label, value, foot, onClick }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; value: string | number; foot: string; onClick?: () => void }) {
  const content = <><span className="metric-icon"><Icon size={18} strokeWidth={1.8} /></span><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-foot">{foot}</span></>;
  return onClick
    ? <button type="button" className="metric-card metric-card-clickable" onClick={onClick} aria-label={`View ${label.toLowerCase()}: ${value}`}>{content}</button>
    : <article className="metric-card">{content}</article>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-state-icon"><CalendarDays size={20} /></span><strong>{title}</strong><p>{text}</p>{action}</div>;
}

function LoadingLine() {
  return <div className="table-loading"><span className="loading-dot" /> Loading your latest…</div>;
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

function WrenchIcon() {
  return <BriefcaseBusiness size={18} />;
}

function SparkleIcon() {
  return <span className="sparkle-drawing">✳</span>;
}
