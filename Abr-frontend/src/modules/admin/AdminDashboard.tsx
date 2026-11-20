"use client";

import AdminSupport from "./AdminSupport";
import DashboardFrame from "@/components/DashboardFrame";
import { EmptyState, LoadingLine, Metric, StatusPill, WrenchIcon } from "@/components/DashboardParts";
import { useTranslation } from "@/components/LanguageProvider";
import { api, formatDate, formatPrice } from "@/lib/api";
import type { Booking, ServiceCategory, User, VerificationDocument, Worker } from "@/lib/types";
import { ArrowRight, BriefcaseBusiness, Check, ChevronDown, CircleDollarSign, ClipboardList, MapPin, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";

function AdminDashboard({ user, refresh, onRefresh, notify }: { user: User; refresh: number; onRefresh: () => void; notify: (message: string) => void }) {
  const { t, locale } = useTranslation();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workersLoadedKey, setWorkersLoadedKey] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userRole, setUserRole] = useState<"all" | "customer" | "worker">("all");
  const [tab, setTab] = useState<"overview" | "pending" | "approved" | "rejected" | "categories" | "users" | "bookings" | "support" | "profile">("overview");
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
    function applyHash() {
      if (window.location.hash === "#support") setTab("support");
    }

    function selectAdminTab(event: Event) {
      const selectedTab = (event as CustomEvent<string>).detail;
      if (["overview", "pending", "approved", "rejected", "categories", "users", "bookings", "support", "profile"].includes(selectedTab)) {
        setTab(selectedTab as "overview" | "pending" | "approved" | "rejected" | "categories" | "users" | "bookings" | "support" | "profile");
      }
    }
    const initialHash = window.requestAnimationFrame(applyHash);
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("kaamghar-admin-tab", selectAdminTab);
    return () => {
      window.cancelAnimationFrame(initialHash);
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("kaamghar-admin-tab", selectAdminTab);
    };
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
    { id: "overview", label: t("Overview") },
    { id: "pending", label: overview?.stats.pendingApprovals ? `Pending · ${overview.stats.pendingApprovals}` : t("Pending") },
    { id: "approved", label: t("Approved") },
    { id: "rejected", label: t("Rejected") },
    { id: "categories", label: t("Categories") },
    { id: "users", label: t("Users") },
    { id: "bookings", label: t("All bookings") },
    { id: "support", label: t("Support inbox") },
    { id: "profile", label: t("My profile") }
  ] as const;

  return <>
    {error && <p className="inline-error">{error}</p>}
    <div className="admin-tabs">{tabs.map((item) => <button className={tab === item.id ? "admin-tab selected" : "admin-tab"} key={item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}<button className="button button-dark" onClick={() => { setShowCreateProfessional(true); setTab("users"); }}>{t("Create professional")}</button><button className="button button-outline tab-refresh" onClick={onRefresh}><RefreshCw size={14} />{" "}{t("Refresh")}</button></div>
    {tab === "overview" && <>
      <section className="admin-welcome"><div><p className="eyebrow">{t("A GOOD DAY TO GET THINGS DONE")}</p><h2>{t("The whole picture.")}</h2><span>{t("Here’s what’s happening across your neighbourhood.")}</span></div><div className="admin-welcome-art"><SparkleIcon /></div></section>
      <div className="metric-row admin-metrics"><Metric icon={Users} label={t("Customers")} value={overview?.stats.customers ?? "—"} foot={t("Registered households")} onClick={() => { setUserRole("customer"); setTab("users"); }} /><Metric icon={BriefcaseBusiness} label={t("Live professionals")} value={overview?.stats.professionals ?? "—"} foot={t("Approved service pros")} onClick={() => setTab("approved")} /><Metric icon={ShieldCheck} label={t("Needs your review")} value={overview?.stats.pendingApprovals ?? "—"} foot={`${overview?.stats.pendingDocuments ?? 0} documents pending`} onClick={() => setTab("pending")} /><Metric icon={ClipboardList} label={t("Total bookings")} value={overview?.stats.bookings ?? "—"} foot={t("Marketplace requests")} onClick={() => setTab("bookings")} /><Metric icon={CircleDollarSign} label={t("Payments received")} value={`₹${formatPrice(overview?.stats.paymentsReceived ?? 0)}`} foot={`${overview?.stats.paymentsReceivedCount ?? 0} captured bookings`} onClick={() => setTab("bookings")} /></div>
      <section className="dash-panel"><div className="panel-heading"><div><p className="eyebrow">{t("THE NEIGHBOURHOOD PULSE")}</p><h2>{t("Latest bookings")}</h2></div><button className="text-link" onClick={() => setTab("bookings")}>{t("See all")}{" "}<ArrowRight size={15} /></button></div>{busy ? <LoadingLine /> : overview?.recentBookings.length ? <div className="booking-list">{overview.recentBookings.map((booking) => <article className="booking-item" key={booking._id}><span className="booking-item-icon"><WrenchIcon /></span><div className="booking-item-main"><div className="booking-item-title"><strong>{booking.customer?.name || booking.customerName}</strong><StatusPill status={booking.status} /></div><span>{booking.worker?.name || "Pro"} · {t(formatDate(booking.scheduledAt, locale))}</span><small><MapPin size={12} /> {booking.address}</small><small>{t("Razorpay Order ID:")}{" "}{booking.paymentOrderId || "—"} · {booking.paymentStatus === "paid" ? t("Payment received") : booking.paymentStatus === "refund_required" ? t("Refund required") : t("Unpaid")}</small></div><strong className="booking-item-price">₹{formatPrice(booking.totalAmount || 0)}</strong></article>)}</div> : <EmptyState title={t("No bookings yet.")} text={t("Marketplace activity will show up here.")} />}</section>
      <div className="revenue-card"><span><CircleDollarSign size={20} /></span><div><small>{t("COMPLETED SERVICE VALUE")}</small><strong>₹{formatPrice(overview?.stats.completedRevenue || 0)}</strong></div><span className="revenue-note"><Check size={14} />{" "}{t("Completed bookings")}</span></div>
      <div className="revenue-card"><span><CircleDollarSign size={20} /></span><div><small>{t("PLATFORM COMMISSION COLLECTED")}</small><strong>₹{formatPrice(overview?.stats.commissionReceived ?? 0)}</strong></div></div>
    </>}
    {tab === "profile" && <section className="dash-panel"><div className="panel-heading"><div><p className="eyebrow">{t("ADMIN ACCOUNT")}</p><h2>{t("My profile")}</h2></div></div><article className="admin-pro-item"><span className="mini-avatar">{user.name[0]?.toUpperCase() || "A"}</span><div className="admin-pro-info"><strong>{user.name}</strong><span>{t("Administrator")}</span><small>Email: {user.email}</small><small>Phone: {user.phone}</small></div></article></section>}
    {showProfessionalApplications && <section className="dash-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">{t("QUALITY & TRUST")}</p><h2>{professionalTabStatus === "pending" ? t("Pending applications") : `${professionalTabStatus[0].toUpperCase()}${professionalTabStatus.slice(1)} professionals`}</h2></div>
        <span className="result-count">{professionalTabStatus === "pending" ? t("Awaiting review") : `${professionalTabStatus[0].toUpperCase()}${professionalTabStatus.slice(1)} applications`}</span>
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
            <small>{worker.experience} years · {worker.city} · ₹{formatPrice(worker.price)}{" "}{t("/ hour")}</small>
            <small>Income: ₹{formatPrice(worker.earnings?.total || 0)} · Pending: ₹{formatPrice(worker.earnings?.pending || 0)} · Payment received: ₹{formatPrice(worker.earnings?.cleared || 0)}</small>
            <p>{worker.description}</p>
            <div className="verification-documents">
              <strong>Verification documents ({documents.length})</strong>
              {documents.length
                ? documents.map((document) => <div className="verification-document" key={document._id}>
                    <div className="verification-document-name">
                      <strong>{t(verificationDocumentLabels[document.type])}</strong>
                      <span>{document.originalName}</span>
                    </div>
                    <a className="button button-outline" href={`/api/admin/professionals/${worker._id}/documents/${document._id}/file`} target="_blank" rel="noreferrer" aria-label={`Preview ${t(verificationDocumentLabels[document.type])}: ${document.originalName} (opens in a new tab)`}>{t("Preview")}</a>
                    <StatusPill status={document.status} />
                    {document.status === "pending" && <><button className="button button-outline" onClick={() => void reviewDocument(worker._id, document._id, "verified")}>{t("Verify")}</button><button className="button button-outline danger-button" onClick={() => void reviewDocument(worker._id, document._id, "rejected")}>{t("Reject")}</button></>}
                  </div>)
                : <small>{t("No documents uploaded yet.")}</small>}
              {professionalTabStatus !== "approved" && !canApprove && <small className="inline-error">Review and verify each uploaded document before approving this application.</small>}
            </div>
          </div>
          <div className="admin-pro-actions">
            <StatusPill status={worker.approvalStatus} />
            {(worker.earnings?.pending || 0) > 0 && <button className="button button-outline" disabled={clearingPayoutId === worker._id} onClick={() => void clearPayout(worker._id, worker.name, worker.earnings?.pending || 0)}>
              {clearingPayoutId === worker._id ? t("Processing…") : `Payout ₹${formatPrice(worker.earnings?.pending || 0)}`}
            </button>}
            {professionalTabStatus === "pending"
              ? <><button className="button button-dark" disabled={!canApprove} onClick={() => void moderate(worker._id, "approved")}><Check size={14} /> {canApprove ? t("Approve") : `Verify ${unverifiedCount} first`}</button><button className="button button-outline danger-button" onClick={() => void moderate(worker._id, "rejected")}>{t("Reject")}</button></>
              : professionalTabStatus === "approved"
                ? <button className="button button-outline danger-button" onClick={() => void moderate(worker._id, "rejected")}>{t("Reject")}</button>
                : <button className="button button-dark" disabled={!canApprove} onClick={() => void moderate(worker._id, "approved")}>{canApprove ? t("Approve profile") : `Verify ${unverifiedCount} first`}</button>}
            <button className="button button-outline danger-button" disabled={deletingProfessionalId === worker._id} onClick={() => void deleteProfessional(worker._id, worker.name)}>
              {deletingProfessionalId === worker._id ? t("Deleting…") : t("Delete")}
            </button>
          </div>
        </article>;
      })}</div> : <EmptyState title={`No ${professionalTabStatus} applications.`} text={professionalTabStatus === "pending" ? "New professional applications will appear here." : `${professionalTabStatus[0].toUpperCase()}${professionalTabStatus.slice(1)} professionals will appear here.`} />}
    </section>}
    {tab === "categories" && <>
      <section className="dash-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">{t("MARKETPLACE SETUP")}</p><h2>{t("Service categories")}</h2></div>
          <span className="result-count">{t("{count} total", { count: categories.length })}</span>
        </div>
        <p>Create categories for professional registration. New options appear in the signup form right away.</p>
        <form className="profile-form" onSubmit={addCategory}>
          <div className="form-grid-two">
            <label>{t("Category name")}<input name="name" required minLength={2} maxLength={60} placeholder="e.g. Appliance repair" /></label>
            <label>{t("Display label (optional)")}<input name="label" maxLength={80} placeholder="Defaults to category name" /></label>
          </div>
          <button className="button button-dark" disabled={savingCategory}>{savingCategory ? t("Adding…") : t("Add category")}</button>
        </form>
        {categories.length ? <div className="admin-pro-list">{categories.map((category) => <article className="admin-pro-item" key={category.name}>
          <span className="mini-avatar">{category.name[0]}</span>
          <div className="admin-pro-info"><strong>{category.name}</strong><span>Signup label: {category.label}</span></div>
          <form className="category-price-form" key={`${category.price}-${category.commission?.type}-${category.commission?.value}`} onSubmit={(event) => void updateCategoryPrice(event, category.name)}>
            <label>{t("Price (₹)")}<input name="price" type="number" min={1} max={1000000} step="1" defaultValue={category.price} required /></label>
            <label>{t("Commission type")}<select name="commissionType" defaultValue={category.commission?.type ?? "percentage"}>
              <option value="percentage">{t("Percentage (%)")}</option>
              <option value="fixed">{t("Fixed (₹)")}</option>
            </select></label>
            <label>{t("Commission value")}<input name="commissionValue" type="number" min={0} step="0.01" defaultValue={category.commission?.value ?? 0} required /></label>
            <button className="button button-dark" disabled={savingCategoryPrice === category.name || deletingCategory === category.name}>{savingCategoryPrice === category.name ? t("Saving…") : t("Save")}</button>
          </form>
          <button className="button button-outline danger-button" disabled={deletingCategory === category.name || savingCategoryPrice === category.name} onClick={() => void deleteCategory(category.name)}>
            {deletingCategory === category.name ? t("Deleting…") : t("Delete")}
          </button>
        </article>)}</div> : <EmptyState title={t("No categories yet.")} text="Add a service category to make it available to professionals." />}
      </section>
    </>}
    {tab === "users" && <section className="dash-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">{t("ACCOUNT MANAGEMENT")}</p><h2>{t("Customers & professionals")}</h2></div>
        <div className="panel-actions">
          <label className="select-filter">{t("Role")}<select value={userRole} onChange={(event) => setUserRole(event.target.value as "all" | "customer" | "worker")}><option value="all">{t("Everyone")}</option><option value="customer">{t("Customers")}</option><option value="worker">{t("Professionals")}</option></select><ChevronDown size={14} /></label>
          <button className="button button-dark" onClick={() => { setProfessionalCategory(""); setShowCreateProfessional(!showCreateProfessional); }}>{showCreateProfessional ? t("Close form") : t("Create professional")}</button>
        </div>
      </div>
      {showCreateProfessional && <div className="user-create-form">
        <p className="eyebrow">{t("PROFESSIONAL ONBOARDING")}</p>
        <h3>{t("Create a professional account")}</h3>
        <p>This creates the professional login and a pending listing. The professional can sign in after creation; the listing appears on the marketplace after approval.</p>
        <form className="profile-form" onSubmit={addProfessional}>
          <div className="form-grid-two">
            <label>{t("Provider name")}<input name="name" required minLength={2} maxLength={80} /></label>
            <label>{t("Location / city")}<input name="city" required minLength={2} maxLength={80} /></label>
          </div>
          <div className="form-grid-two">
            <label>{t("Service provided")}<input name="profession" required minLength={2} maxLength={80} placeholder="e.g. AC repair technician" /></label>
            <label>{t("Service category")}<select name="category" required value={professionalRateCategory?.name ?? ""} onChange={(event) => setProfessionalCategory(event.target.value)} disabled={categoriesLoading || categories.length === 0}><option value="" disabled>{categoriesLoading ? t("Loading categories…") : categories.length ? t("Choose a category") : t("No categories available")}</option>{categories.map(({ name, label }) => <option key={name} value={name}>{t(label)}</option>)}</select></label>
          </div>
          <div className="form-grid-two">
            <label>{t("Email for login")}<input name="email" type="email" required maxLength={254} /></label>
            <label>{t("Phone")}<input name="phone" type="tel" required minLength={8} maxLength={20} /></label>
          </div>
          <div className="form-grid-two">
            <label>{t("Customer hourly rate (₹)")}<input type="text" value={professionalRateCategory ? formatPrice(customerHourlyRate) : ""} placeholder={t("Choose a category")} readOnly />
              {professionalRateCategory && <small>Category rate ₹{formatPrice(baseRate)} + commission ₹{formatPrice(commissionPaise / 100)}{hourlyCommission?.type === "percentage" ? ` (${hourlyCommission.value}%)` : ""}</small>}
            </label>
            <label>{t("Temporary password")}<input name="password" type="password" required minLength={8} maxLength={72} /></label>
          </div>
          <button className="button button-dark" disabled={savingProfessional || categoriesLoading || !professionalRateCategory}>{savingProfessional ? t("Creating…") : t("Create professional account")}</button>
        </form>
      </div>}
      {usersLoading ? <LoadingLine /> : users.length ? <div className="admin-pro-list">{users.map((account) => <article className="admin-pro-item" key={account._id}>
        <span className="mini-avatar">{account.name[0]}</span>
        <div className="admin-pro-info">
          <strong>{account.name}</strong>
          <span>{account.role === "worker" ? `${account.worker?.profession || t("Professional")} · ${account.worker?.category || t("No category")}` : t("Customer account")}</span>
          <small>{account.email} · {account.phone}</small>
          <small>{t("Joined")}{" "}{t(formatDate(account.createdAt, locale))} · {account.worker?.approvalStatus || (account.active ? "active" : "inactive")}</small>
          {account.role === "worker" && <small>Income: ₹{formatPrice(account.worker?.earnings?.total || 0)} · Pending: ₹{formatPrice(account.worker?.earnings?.pending || 0)} · Payment received: ₹{formatPrice(account.worker?.earnings?.cleared || 0)}</small>}
        </div>
        <div className="admin-pro-actions">
          <StatusPill status={account.active ? "active" : "inactive"} />
          <button className={account.active ? "button button-outline danger-button" : "button button-dark"} onClick={() => void setUserActive(account._id, !account.active)}>{account.active ? t("Deactivate") : t("Reactivate")}</button>
          {account.role === "worker" && account.worker?._id && (account.worker.earnings?.pending || 0) > 0 && <button className="button button-outline" disabled={clearingPayoutId === account.worker._id} onClick={() => {
            const workerId = account.worker?._id;
            if (workerId) void clearPayout(workerId, account.name, account.worker?.earnings?.pending || 0);
          }}>
            {clearingPayoutId === account.worker._id ? t("Processing…") : `Payout ₹${formatPrice(account.worker.earnings?.pending || 0)}`}
          </button>}
          {account.role === "worker" && account.worker?._id && <button className="button button-outline danger-button" disabled={deletingProfessionalId === account.worker?._id} onClick={() => {
            const workerId = account.worker?._id;
            if (workerId) void deleteProfessional(workerId, account.name);
          }}>
            {deletingProfessionalId === account.worker?._id ? t("Deleting…") : t("Delete")}
          </button>}
        </div>
      </article>)}</div> : <EmptyState title={t("No accounts found.")} text={t("Registered customer and professional accounts will appear here.")} />}
    </section>}
    {tab === "support" && <AdminSupport refresh={refresh} />}
    {tab === "bookings" && <AdminBookings bookings={bookings} stats={overview?.stats} />}
  </>;
}

type AdminStats = { customers: number; professionals: number; pendingApprovals: number; pendingDocuments: number; bookings: number; completedRevenue: number; paymentsReceived: number; paymentsReceivedCount: number; commissionReceived: number; providerAmountReceived: number };

type AdminOverview = { stats: AdminStats; recentBookings: Booking[] };

type AdminUser = { _id: string; name: string; email: string; phone: string; role: "customer" | "worker"; active: boolean; createdAt: string; worker?: Pick<Worker, "_id" | "profession" | "category" | "approvalStatus" | "earnings"> };

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

function AdminBookings({ bookings, stats }: { bookings: Booking[]; stats?: AdminStats }) {
  const { t, locale } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const query = search.trim().toLowerCase();
  const filtered = bookings.filter((booking) =>
    (!status || booking.status === status) &&
    (!payment || (booking.paymentStatus ?? "unpaid") === payment) &&
    (!query || [
      booking.customer?.name, booking.customerName, booking.worker?.name,
      booking.worker?.profession, booking.address, booking.paymentOrderId,
    ].some((value) => value?.toLowerCase().includes(query)))
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visibleBookings = filtered.slice(start, start + pageSize);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setPayment("");
    setPage(1);
  }

  return <section className="dash-panel">
      <div className="panel-heading"><div><p className="eyebrow">{t("MARKETPLACE OPERATIONS")}</p><h2>{t("All bookings")}</h2></div><span className="result-count">{t("{count} total", { count: bookings.length })}</span></div>
      <BookingPaymentSummary stats={stats} bookings={bookings} />
      <div className="admin-booking-controls">
        <label className="admin-booking-search">{t("Search bookings")}{"          "}<input type="search" placeholder={t("Customer, provider, address or order ID")} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </label>
        <label>{t("Booking status")}{"          "}<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">{t("All statuses")}</option>
            <option value="pending">{t("Pending")}</option>
            <option value="confirmed">{t("Confirmed")}</option>
            <option value="completed">{t("Completed")}</option>
            <option value="cancelled">{t("Cancelled")}</option>
          </select>
        </label>
        <label>{t("Payment status")}{"          "}<select value={payment} onChange={(event) => { setPayment(event.target.value); setPage(1); }}>
            <option value="">{t("All payments")}</option>
            <option value="paid">{t("Paid")}</option>
            <option value="unpaid">{t("Unpaid")}</option>
            <option value="refund_required">{t("Refund required")}</option>
          </select>
        </label>
        <button type="button" className="button button-outline" disabled={!search && !status && !payment} onClick={clearFilters}>{t("Clear filters")}</button>
      </div>
      {visibleBookings.length > 0 && <div className="admin-booking-list">{visibleBookings.map((booking) => {
        const total = booking.totalAmount ?? 0;
        const commission = booking.commissionAmount ?? 0;
        const provider = (Math.round(total * 100) - Math.round(commission * 100)) / 100;
        return <article className="admin-booking-item" key={booking._id}>
          <div><strong>{booking.customer?.name || booking.customerName}</strong><span>{t("Customer")}</span></div>
          <ArrowRight size={15} />
          <div><strong>{booking.worker?.name || t("Professional")}</strong><span>{booking.worker?.profession}</span></div>
          <div><strong>{t(formatDate(booking.scheduledAt, locale))}</strong><span>{booking.address}</span><span>{t("Razorpay Order ID:")}{" "}{booking.paymentOrderId || "\u2014"}</span><span>{booking.paymentStatus === "paid" ? t("Payment received") : booking.paymentStatus === "refund_required" ? t("Refund required") : t("Unpaid")}</span></div>
          <dl className="booking-payment-breakdown">
            <div><dt>{t("Customer total")}</dt><dd>{formatBookingAmount(total)}</dd></div>
            <div><dt>{t("Provider share")}</dt><dd>{formatBookingAmount(provider)}</dd></div>
            <div><dt>{t("Platform commission")}</dt><dd>{formatBookingAmount(commission)}</dd></div>
          </dl>
          <StatusPill status={booking.status} />
        </article>;
      })}</div>}
      {filtered.length === 0 && (bookings.length
        ? <EmptyState title={t("No matching bookings.")} text={t("Try a different search or clear the filters.")} />
        : <EmptyState title={t("No bookings yet.")} text={t("New customer bookings will appear here.")} />)}
      <div className="admin-booking-pagination">
        <span role="status">{filtered.length ? t("Showing {start}–{end} of {count} bookings", { start: start + 1, end: start + visibleBookings.length, count: filtered.length }) : t("0 bookings")}</span>
        {pageCount > 1 && <nav aria-label={t("Bookings pagination")}>
          <button type="button" className="button button-outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t("Previous")}</button>
          <span>{t("Page {page} of {count}", { page: currentPage, count: pageCount })}</span>
          <button type="button" className="button button-outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>{t("Next")}</button>
        </nav>}
      </div>
    </section>;
}

function BookingPaymentSummary({ stats, bookings }: { stats?: AdminStats; bookings: Booking[] }) {
  const { t } = useTranslation();
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

  const foot = hasServerTotals || stats?.bookings === bookings.length ? t("From paid bookings") : t("From listed paid bookings");
  const showAmount = (paise: number) => stats ? formatBookingAmount(paise / 100) : "\u2014";
  return <div className="booking-payment-summary" aria-label={t("Paid booking totals")}>
    <Metric icon={CircleDollarSign} label={t("Total paid")} value={showAmount(providerPaise + commissionPaise)} foot={foot} />
    <Metric icon={BriefcaseBusiness} label={t("Provider share")} value={showAmount(providerPaise)} foot={foot} />
    <Metric icon={CircleDollarSign} label={t("Platform commission")} value={showAmount(commissionPaise)} foot={foot} />
  </div>;
}

function SparkleIcon() {
  return <span className="sparkle-drawing">✳</span>;
}

export default function AdminDashboardPage() {
  return <DashboardFrame expectedRole="admin" Screen={AdminDashboard} />;
}
