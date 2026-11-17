"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, CalendarDays, Check, ChevronDown, CircleDollarSign, ClipboardList, Clock3, Home, LayoutDashboard, LogOut, MapPin, Menu, RefreshCw, ShieldCheck, Star, Users, X } from "lucide-react";
import { ApiError, api, formatDate, formatPrice } from "@/lib/api";
import type { Booking, Role, ServiceCategory, User, VerificationDocument, Worker } from "@/lib/types";
import DetectCityButton from "@/components/DetectCityButton";

type DashboardProps = { expectedRole: Role };
type AdminStats = { customers: number; professionals: number; pendingApprovals: number; pendingDocuments: number; bookings: number; completedRevenue: number };
type AdminOverview = { stats: AdminStats; recentBookings: Booking[] };
type AdminUser = { _id: string; name: string; email: string; phone: string; role: "customer" | "worker"; active: boolean; createdAt: string; worker?: Pick<Worker, "_id" | "profession" | "category" | "approvalStatus"> };

const roleTitles: Record<Role, string> = {
  customer: "My home",
  worker: "Pro workspace",
  admin: "Operations",
};

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status}`}>{status}</span>;
}

function DashboardHeader({ user, onLogout, title }: { user: User; onLogout: () => void; title: string }) {
  return <header className="dash-topbar"><div className="dash-mobile-brand"><Link className="brand" href="/"><span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span></Link></div><div className="dash-heading"><p className="eyebrow">{roleTitles[user.role]} / 2026</p><h1>{title}</h1></div><div className="dash-user"><span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.role === "worker" ? "Local service partner" : `${user.role[0].toUpperCase()}${user.role.slice(1)} account`}</small></div><button title="Sign out" onClick={onLogout} className="logout-icon"><LogOut size={17} /></button></div></header>;
}

function DashboardShell({ user, onLogout, children, title }: { user: User; onLogout: () => void; children: React.ReactNode; title: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const links = user.role === "admin"
    ? [{ label: "Overview", href: "/admin", icon: LayoutDashboard }, { label: "Pending", href: "/admin#pending", icon: Users }, { label: "Approved", href: "/admin#approved", icon: Users }, { label: "Rejected", href: "/admin#rejected", icon: Users }, { label: "Categories", href: "/admin#categories", icon: BriefcaseBusiness }, { label: "Users", href: "/admin#users", icon: Users }, { label: "Bookings", href: "/admin#bookings", icon: ClipboardList }]
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
        router.replace(current.role === "admin" ? "/admin" : `/${current.role}`);
        return;
      }
      setUser(current);
    }).catch((reason: unknown) => {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
        router.replace(expectedRole === "admin" ? "/admin/login" : "/login");
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

  if (authLoading) return <div className="dashboard-loading" role="status"><span className="loading-dot" /> Checking your account…</div>;
  if (!user) return <div className="dashboard-loading" role={error ? "alert" : "status"}><span className="loading-dot" /> {error || "Sign in is required to view this dashboard."} {error ? <button className="button button-outline" onClick={() => window.location.reload()}>Retry</button> : <Link className="text-link" href={expectedRole === "admin" ? "/admin/login" : "/login"}>Go to sign in</Link>}</div>;
  return <DashboardShell user={user} onLogout={() => void logout()} title={expectedRole === "customer" ? "Your home, taken care of." : expectedRole === "worker" ? "Provider dashboard" : "The whole picture."}>
    {error && <div className="dashboard-alert"><span>{error}</span><button onClick={() => setError("")}><X size={15} /></button></div>}
    {expectedRole === "customer" && <CustomerDashboard user={user} refresh={refresh} onRefresh={() => setRefresh(refresh + 1)} notify={notify} />}
    {expectedRole === "worker" && <WorkerDashboard refresh={refresh} onRefresh={() => setRefresh(refresh + 1)} notify={notify} />}
    {expectedRole === "admin" && <AdminDashboard refresh={refresh} onRefresh={() => setRefresh(refresh + 1)} notify={notify} />}
    {toast && <div className="dash-toast"><Check size={16} />{toast}</div>}
  </DashboardShell>;
}

function CustomerDashboard({ user, refresh, onRefresh, notify }: { user: User; refresh: number; onRefresh: () => void; notify: (message: string) => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [bookingError, setBookingError] = useState("");

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

  return <>
    <section className="dash-welcome customer-welcome"><div className="welcome-orb"><Home size={24} /></div><div><span className="eyebrow">HEY, {user.name.split(" ")[0].toUpperCase()} ✳</span><h2>More time for the good stuff.</h2><p>Your home services and trusted local pros, all in one place.</p></div><Link className="button button-dark" href="/#professionals">Find a pro <ArrowRight size={16} /></Link></section>
    <div className="metric-row"><Metric icon={ClipboardList} label="Total bookings" value={bookings.length} foot="Your service history" /><Metric icon={Clock3} label="In progress" value={openCount} foot="Requests underway" /><Metric icon={BadgeCheck} label="Jobs completed" value={completedCount} foot="Good work, done" /></div>
    <section className="dash-panel" id="bookings"><div className="panel-heading"><div><p className="eyebrow">YOUR SERVICE HISTORY</p><h2>Bookings & visits</h2></div><button className="button button-outline" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button></div>
      {bookingError && <p className="inline-error">{bookingError}</p>}
      {busy ? <LoadingLine /> : bookings.length ? <div className="booking-list">{bookings.map((booking) => <article className="booking-item" key={booking._id}><span className="booking-item-icon"><WrenchIcon /></span><div className="booking-item-main"><div className="booking-item-title"><strong>{booking.worker?.name || "Your professional"}</strong><StatusPill status={booking.status} /></div><span>{booking.worker?.profession || "Home service"} · {formatDate(booking.scheduledAt)} · {booking.durationHours || 1} hr</span><small><MapPin size={12} /> {booking.address}</small></div><div className="booking-item-price"><strong>₹{formatPrice(booking.totalAmount || 0)}</strong>{["pending", "confirmed"].includes(booking.status) && <button className="cancel-link" onClick={() => void cancelBooking(booking._id)}>Cancel</button>}</div></article>)}</div> : <EmptyState title="Your next booking starts here." text="Find someone good at what they do, right around the corner." action={<Link className="text-link" href="/#professionals">Browse professionals <ArrowRight size={15} /></Link>} />}
    </section>
    <section className="dash-panel browse-panel"><div className="panel-heading"><div><p className="eyebrow">GOOD HANDS, CLOSE BY</p><h2>Popular around you</h2></div><Link href="/#professionals" className="text-link">See everyone <ArrowRight size={15} /></Link></div><div className="mini-pro-grid">{workers.slice(0, 3).map((worker, index) => <button className="mini-pro-card" key={worker._id} onClick={() => setSelectedWorker(worker)}><span className={`mini-avatar mini-avatar-${index}`}>{worker.name[0]}</span><span className="mini-pro-copy"><strong>{worker.name}</strong><small>{worker.profession} · {worker.city}</small><span><Star size={12} fill="currentColor" /> {worker.rating} ({worker.reviewCount || 0}) · ₹{formatPrice(worker.price)}/hr</span></span><ArrowUpRight size={16} /></button>)}</div></section>
    {selectedWorker && <BookingModal worker={selectedWorker} onClose={() => { setSelectedWorker(null); window.history.replaceState({}, "", "/customer"); }} onSuccess={() => { setSelectedWorker(null); window.history.replaceState({}, "", "/customer"); notify("Booking request sent. Your pro will be in touch."); onRefresh(); }} />}
  </>;
}

function WorkerDashboard({ refresh, onRefresh, notify }: { refresh: number; onRefresh: () => void; notify: (message: string) => void }) {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [workerCity, setWorkerCity] = useState("");
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<VerificationDocument["type"]>("identity");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = bookings.filter((booking) => booking.status === "pending").length;
  const completed = bookings.filter((booking) => booking.status === "completed").length;

  useEffect(() => {
    Promise.all([api<{ worker: Worker }>("workers/me"), api<{ bookings: Booking[] }>("bookings")])
      .then(([profile, result]) => { setWorker(profile.worker); setWorkerCity(profile.worker.city); setBookings(result.bookings); })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setBusy(false));
  }, [refresh]);

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
    <div className="metric-row"><Metric icon={ClipboardList} label="My bookings" value={bookings.length} foot="Incoming customer requests" /><Metric icon={Clock3} label="Needs a reply" value={pending} foot="Waiting for your response" /><Metric icon={BadgeCheck} label="Jobs complete" value={completed} foot="Completed work" /><Metric icon={CircleDollarSign} label="Profile status" value={worker?.approvalStatus || "—"} foot={worker?.available ? "Accepting new bookings" : "Not taking bookings"} /></div>
    <section className="dash-panel" id="requests"><div className="panel-heading"><div><p className="eyebrow">MY WORKSPACE</p><h2>Booking requests</h2></div><button className="button button-outline" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button></div>{busy ? <LoadingLine /> : bookings.length ? <div className="request-list">{bookings.map((booking) => <article className="request-item" key={booking._id}><div className="request-top"><div><strong>{booking.customer?.name || booking.customerName}</strong><span>{formatDate(booking.scheduledAt)} · {booking.durationHours || 1} hr · ₹{formatPrice(booking.totalAmount || 0)}</span></div><StatusPill status={booking.status} /></div><p><MapPin size={13} /> {booking.address}</p><small>{booking.notes || "No extra details"} · {booking.customer?.phone || booking.phone}</small><div className="request-actions">{booking.status === "pending" && <><button className="button button-dark" onClick={() => void changeStatus(booking._id, "confirmed")}><Check size={14} /> Accept job</button><button className="button button-outline danger-button" onClick={() => void changeStatus(booking._id, "cancelled")}>Decline</button></>}{booking.status === "confirmed" && <><button className="button button-dark" onClick={() => void changeStatus(booking._id, "completed")}><BadgeCheck size={14} /> Mark complete</button><button className="button button-outline danger-button" onClick={() => void changeStatus(booking._id, "cancelled")}>Cancel</button></>}</div></article>)}</div> : <EmptyState title="No requests yet." text="Once your profile is approved, new service requests will appear here." />}</section>
    {worker && <section className="dash-panel" id="profile"><div className="panel-heading"><div><p className="eyebrow">YOUR LISTING, YOUR STORY</p><h2>Professional profile</h2></div><StatusPill status={worker.available ? "available" : "paused"} /></div><form className="profile-form" onSubmit={saveProfile}><div className="form-grid-two"><label>Your profession<input name="profession" defaultValue={worker.profession} required maxLength={80} /></label><label>Service category<select name="category" defaultValue={worker.category} required>{categories.map(({ name, label }) => <option key={name} value={name}>{label}</option>)}</select></label></div><div className="form-grid-two"><div className="location-field"><label>City<input name="city" value={workerCity} onChange={(event) => setWorkerCity(event.target.value)} required maxLength={80} /></label><DetectCityButton compact onCity={setWorkerCity} /></div><label>Experience (years)<input name="experience" defaultValue={worker.experience} type="number" min={0} max={60} required /></label></div><div className="form-grid-two"><label>Hourly rate (₹)<input name="price" defaultValue={worker.price} type="number" min={1} required /></label><label className="availability-check"><input name="available" type="checkbox" defaultChecked={worker.available} /> Accept new bookings</label></div><label>About your service<textarea name="description" defaultValue={worker.description || ""} rows={3} minLength={10} maxLength={300} required /></label><button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save profile"} <ArrowRight size={15} /></button></form><div className="document-upload-panel"><div className="panel-heading"><div><p className="eyebrow">IDENTITY & SKILL CHECK</p><h3>Verification documents</h3></div><span className="result-count">{worker.verificationDocuments?.length || 0}/10 uploaded</span></div><p>Upload an ID, address proof, or service certificate. PDF, JPG, or PNG, up to 5 MB each. Documents are private and reviewed by admin.</p><form className="document-upload-form" onSubmit={uploadDocument}><label>Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value as VerificationDocument["type"])}><option value="identity">Identity proof</option><option value="address">Address proof</option><option value="certificate">Service certificate</option><option value="other">Other</option></select></label><label>Choose document<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} required /></label><button className="button button-dark" disabled={uploadingDocument}>{uploadingDocument ? "Uploading…" : "Upload document"}</button></form>{worker.verificationDocuments?.length ? <div className="document-status-list">{worker.verificationDocuments.map((document) => <div className="document-status-item" key={document._id}><span>{document.type} · {document.originalName}</span><StatusPill status={document.status} /></div>)}</div> : <p>No verification documents uploaded yet.</p>}</div></section>}
  </>;
}

function AdminDashboard({ refresh, onRefresh, notify }: { refresh: number; onRefresh: () => void; notify: (message: string) => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workersLoadedKey, setWorkersLoadedKey] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userRole, setUserRole] = useState<"all" | "customer" | "worker">("all");
  const [tab, setTab] = useState<"overview" | "pending" | "approved" | "rejected" | "categories" | "users" | "bookings">("overview");
  const [showCreateProfessional, setShowCreateProfessional] = useState(false);
  const [busy, setBusy] = useState(true);
  const [usersLoadedKey, setUsersLoadedKey] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingProfessional, setSavingProfessional] = useState(false);
  const [deletingProfessionalId, setDeletingProfessionalId] = useState<string | null>(null);
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
      if (["overview", "pending", "approved", "rejected", "categories", "users", "bookings"].includes(selectedTab)) {
        setTab(selectedTab as "overview" | "pending" | "approved" | "rejected" | "categories" | "users" | "bookings");
      }
    }
    window.addEventListener("kaamghar-admin-tab", selectAdminTab);
    return () => window.removeEventListener("kaamghar-admin-tab", selectAdminTab);
  }, []);

  useEffect(() => {
    Promise.all([api<AdminOverview>("admin/overview"), api<{ bookings: Booking[] }>("bookings")])
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
    api<{ categories: ServiceCategory[] }>("admin/categories")
      .then(({ categories: result }) => setCategories(result))
      .catch((reason: Error) => setError(reason.message));
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
      price: Number(form.get("price")),
    };
    try {
      await api("admin/professionals", {
        method: "POST",
        body: JSON.stringify(professional),
      });
      formElement.reset();
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

  const tabs = [{ id: "overview", label: "Overview" }, { id: "pending", label: `Pending${overview?.stats.pendingApprovals ? ` · ${overview.stats.pendingApprovals}` : ""}` }, { id: "approved", label: "Approved" }, { id: "rejected", label: "Rejected" }, { id: "categories", label: "Categories" }, { id: "users", label: "Users" }, { id: "bookings", label: "All bookings" }] as const;
  return <>
    {error && <p className="inline-error">{error}</p>}
    <div className="admin-tabs">{tabs.map((item) => <button className={tab === item.id ? "admin-tab selected" : "admin-tab"} key={item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}<button className="button button-outline tab-refresh" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button></div>
    {tab === "overview" && <>
      <section className="admin-welcome"><div><p className="eyebrow">A GOOD DAY TO GET THINGS DONE</p><h2>The whole picture.</h2><span>Here’s what’s happening across your neighbourhood.</span></div><div className="admin-welcome-art"><SparkleIcon /></div></section>
      <div className="metric-row admin-metrics"><Metric icon={Users} label="Customers" value={overview?.stats.customers ?? "—"} foot="Registered households" /><Metric icon={BriefcaseBusiness} label="Live professionals" value={overview?.stats.professionals ?? "—"} foot="Approved service pros" /><Metric icon={ShieldCheck} label="Needs your review" value={overview?.stats.pendingApprovals ?? "—"} foot={`${overview?.stats.pendingDocuments ?? 0} documents pending`} /><Metric icon={ClipboardList} label="Total bookings" value={overview?.stats.bookings ?? "—"} foot="Marketplace requests" /></div>
      <section className="dash-panel"><div className="panel-heading"><div><p className="eyebrow">THE NEIGHBOURHOOD PULSE</p><h2>Latest bookings</h2></div><button className="text-link" onClick={() => setTab("bookings")}>See all <ArrowRight size={15} /></button></div>{busy ? <LoadingLine /> : overview?.recentBookings.length ? <div className="booking-list">{overview.recentBookings.map((booking) => <article className="booking-item" key={booking._id}><span className="booking-item-icon"><WrenchIcon /></span><div className="booking-item-main"><div className="booking-item-title"><strong>{booking.customer?.name || booking.customerName}</strong><StatusPill status={booking.status} /></div><span>{booking.worker?.name || "Pro"} · {formatDate(booking.scheduledAt)}</span><small><MapPin size={12} /> {booking.address}</small></div><strong className="booking-item-price">₹{formatPrice(booking.totalAmount || 0)}</strong></article>)}</div> : <EmptyState title="No bookings yet." text="Marketplace activity will show up here." />}</section>
      <div className="revenue-card"><span><CircleDollarSign size={20} /></span><div><small>COMPLETED SERVICE VALUE</small><strong>₹{formatPrice(overview?.stats.completedRevenue || 0)}</strong></div><span className="revenue-note"><Check size={14} /> Completed bookings</span></div>
    </>}
    {showProfessionalApplications && <section className="dash-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">QUALITY & TRUST</p><h2>{professionalTabStatus === "pending" ? "Pending applications" : `${professionalTabStatus[0].toUpperCase()}${professionalTabStatus.slice(1)} professionals`}</h2></div>
        <span className="result-count">{professionalTabStatus === "pending" ? "Awaiting review" : `${professionalTabStatus[0].toUpperCase()}${professionalTabStatus.slice(1)} applications`}</span>
      </div>
      {workersLoading ? <LoadingLine /> : workers.length ? <div className="admin-pro-list">{workers.map((worker) => {
        const documents = worker.verificationDocuments || [];
        const canApprove = documents.length > 0 && documents.every((document) => document.status === "verified");
        return <article className="admin-pro-item" key={worker._id}>
          <span className="mini-avatar">{worker.name[0]}</span>
          <div className="admin-pro-info">
            <strong>{worker.name}</strong>
            <span>{worker.profession} · {worker.category}</span>
            <small>{worker.user?.email} · {worker.user?.phone}</small>
            <small>{worker.experience} years · {worker.city} · ₹{formatPrice(worker.price)} / hour</small>
            <p>{worker.description}</p>
            <div className="verification-documents">
              <strong>Verification documents ({documents.length})</strong>
              {documents.length
                ? documents.map((document) => <div className="verification-document" key={document._id}>
                    <a href={`/api/admin/professionals/${worker._id}/documents/${document._id}/file`} target="_blank" rel="noreferrer">{document.type}: {document.originalName}</a>
                    <StatusPill status={document.status} />
                    {document.status === "pending" && <><button className="button button-outline" onClick={() => void reviewDocument(worker._id, document._id, "verified")}>Verify</button><button className="button button-outline danger-button" onClick={() => void reviewDocument(worker._id, document._id, "rejected")}>Reject</button></>}
                  </div>)
                : <small>No documents uploaded yet.</small>}
              {professionalTabStatus === "pending" && !canApprove && <small className="inline-error">Upload at least one verification document and verify every document before approval.</small>}
            </div>
          </div>
          <div className="admin-pro-actions">
            <StatusPill status={worker.approvalStatus} />
            {professionalTabStatus === "pending"
              ? <><button className="button button-dark" disabled={!canApprove} title={canApprove ? "Approve verified professional" : "Upload and verify all documents first"} onClick={() => void moderate(worker._id, "approved")}><Check size={14} /> Approve</button><button className="button button-outline danger-button" onClick={() => void moderate(worker._id, "rejected")}>Reject</button></>
              : professionalTabStatus === "approved"
                ? <button className="button button-outline danger-button" onClick={() => void moderate(worker._id, "rejected")}>Reject</button>
                : <button className="button button-dark" disabled={!canApprove} title={canApprove ? "Approve verified professional" : "Upload and verify all documents first"} onClick={() => void moderate(worker._id, "approved")}>Approve profile</button>}
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
        {categories.length ? <div className="admin-pro-list">{categories.map((category) => <article className="admin-pro-item" key={category.name}><span className="mini-avatar">{category.name[0]}</span><div className="admin-pro-info"><strong>{category.name}</strong><span>Signup label: {category.label}</span></div></article>)}</div> : <EmptyState title="No categories yet." text="Add a service category to make it available to professionals." />}
      </section>
    </>}
    {tab === "users" && <section className="dash-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">ACCOUNT MANAGEMENT</p><h2>Customers & professionals</h2></div>
        <div className="panel-actions">
          <label className="select-filter">Role<select value={userRole} onChange={(event) => setUserRole(event.target.value as "all" | "customer" | "worker")}><option value="all">Everyone</option><option value="customer">Customers</option><option value="worker">Professionals</option></select><ChevronDown size={14} /></label>
          <button className="button button-dark" onClick={() => setShowCreateProfessional(!showCreateProfessional)}>{showCreateProfessional ? "Close form" : "Create user"}</button>
        </div>
      </div>
      {showCreateProfessional && <div className="user-create-form">
        <p className="eyebrow">PROFESSIONAL ONBOARDING</p>
        <h3>Create a provider account</h3>
        <p>This creates the provider login and a pending professional listing. The provider can sign in after creation; the listing appears on the marketplace after approval.</p>
        <form className="profile-form" onSubmit={addProfessional}>
          <div className="form-grid-two">
            <label>Provider name<input name="name" required minLength={2} maxLength={80} /></label>
            <label>Location / city<input name="city" required minLength={2} maxLength={80} /></label>
          </div>
          <div className="form-grid-two">
            <label>Service provided<input name="profession" required minLength={2} maxLength={80} placeholder="e.g. AC repair technician" /></label>
            <label>Service category<select name="category" required defaultValue="" disabled={categories.length === 0}><option value="" disabled>{categories.length ? "Choose a category" : "Loading categories…"}</option>{categories.map(({ name, label }) => <option key={name} value={name}>{label}</option>)}</select></label>
          </div>
          <div className="form-grid-two">
            <label>Email for login<input name="email" type="email" required maxLength={254} /></label>
            <label>Phone<input name="phone" type="tel" required minLength={8} maxLength={20} /></label>
          </div>
          <div className="form-grid-two">
            <label>Hourly rate (₹)<input name="price" type="number" required min={1} max={1000000} /></label>
            <label>Temporary password<input name="password" type="password" required minLength={8} maxLength={72} /></label>
          </div>
          <button className="button button-dark" disabled={savingProfessional}>{savingProfessional ? "Creating…" : "Create provider account"}</button>
        </form>
      </div>}
      {usersLoading ? <LoadingLine /> : users.length ? <div className="admin-pro-list">{users.map((account) => <article className="admin-pro-item" key={account._id}>
        <span className="mini-avatar">{account.name[0]}</span>
        <div className="admin-pro-info">
          <strong>{account.name}</strong>
          <span>{account.role === "worker" ? `${account.worker?.profession || "Professional"} · ${account.worker?.category || "No category"}` : "Customer account"}</span>
          <small>{account.email} · {account.phone}</small>
          <small>Joined {formatDate(account.createdAt)} · {account.worker?.approvalStatus || (account.active ? "active" : "inactive")}</small>
        </div>
        <div className="admin-pro-actions">
          <StatusPill status={account.active ? "active" : "inactive"} />
          <button className={account.active ? "button button-outline danger-button" : "button button-dark"} onClick={() => void setUserActive(account._id, !account.active)}>{account.active ? "Deactivate" : "Reactivate"}</button>
          {account.role === "worker" && account.worker?._id && <button className="button button-outline danger-button" disabled={deletingProfessionalId === account.worker?._id} onClick={() => {
            const workerId = account.worker?._id;
            if (workerId) void deleteProfessional(workerId, account.name);
          }}>
            {deletingProfessionalId === account.worker?._id ? "Deleting…" : "Delete"}
          </button>}
        </div>
      </article>)}</div> : <EmptyState title="No accounts found." text="Registered customer and professional accounts will appear here." />}
    </section>}
    {tab === "bookings" && <section className="dash-panel"><div className="panel-heading"><div><p className="eyebrow">MARKETPLACE OPERATIONS</p><h2>All bookings</h2></div><span className="result-count">{bookings.length} total</span></div>{bookings.length ? <div className="admin-booking-list">{bookings.map((booking) => <article className="admin-booking-item" key={booking._id}><div><strong>{booking.customer?.name || booking.customerName}</strong><span>Customer</span></div><ArrowRight size={15} /><div><strong>{booking.worker?.name || "Professional"}</strong><span>{booking.worker?.profession}</span></div><div><strong>{formatDate(booking.scheduledAt)}</strong><span>{booking.address}</span></div><strong>₹{formatPrice(booking.totalAmount || 0)}</strong><StatusPill status={booking.status} /></article>)}</div> : <EmptyState title="No bookings yet." text="When customers book a pro, you’ll see it here." />}</section>}
  </>;
}

function BookingModal({ worker, onClose, onSuccess }: { worker: Worker; onClose: () => void; onSuccess: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [minimumDateTime, setMinimumDateTime] = useState("");

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
    const durationHours = Number(form.get("durationHours"));
    try {
      await api("bookings", { method: "POST", body: JSON.stringify({ workerId: worker._id, address: form.get("address"), scheduledAt, durationHours, notes: form.get("notes") }) });
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create booking.");
      setSaving(false);
    }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="booking-modal"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button><p className="eyebrow">LET&apos;S GET IT SORTED</p><h2>Book {worker.name.split(" ")[0]}.</h2><p className="modal-intro">{worker.profession} · ₹{formatPrice(worker.price)} per hour</p><form className="modal-form" onSubmit={submit}><label>Service address<textarea name="address" required minLength={8} maxLength={300} rows={3} placeholder="House number, street, area, city" /></label><label>Preferred date & time<input name="scheduledAt" required type="datetime-local" min={minimumDateTime} onFocus={() => { if (!minimumDateTime) setMinimumDateTime(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)); }} /></label><label>How many hours?<select name="durationHours" defaultValue="1"><option value="1">1 hour · ₹{formatPrice(worker.price)}</option><option value="2">2 hours · ₹{formatPrice(worker.price * 2)}</option><option value="3">3 hours · ₹{formatPrice(worker.price * 3)}</option><option value="4">4 hours · ₹{formatPrice(worker.price * 4)}</option><option value="6">6 hours · ₹{formatPrice(worker.price * 6)}</option><option value="8">8 hours · ₹{formatPrice(worker.price * 8)}</option><option value="12">12 hours · ₹{formatPrice(worker.price * 12)}</option></select></label><label>Anything else? <span className="optional-text">Optional</span><textarea name="notes" rows={2} maxLength={500} placeholder="A little more about the job" /></label>{error && <p className="inline-error">{error}</p>}<button disabled={saving} className="button button-dark modal-submit">{saving ? "Sending request…" : "Request this booking"} <ArrowRight size={16} /></button><small>Booking is saved to your history. Your pro will confirm the visit.</small></form></section></div>;
}

function Metric({ icon: Icon, label, value, foot }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; value: string | number; foot: string }) {
  return <article className="metric-card"><span className="metric-icon"><Icon size={18} strokeWidth={1.8} /></span><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-foot">{foot}</span></article>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-state-icon"><CalendarDays size={20} /></span><strong>{title}</strong><p>{text}</p>{action}</div>;
}

function LoadingLine() {
  return <div className="table-loading"><span className="loading-dot" /> Loading your latest…</div>;
}

function WrenchIcon() {
  return <BriefcaseBusiness size={18} />;
}

function SparkleIcon() {
  return <span className="sparkle-drawing">✳</span>;
}
