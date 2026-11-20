"use client";

import { LanguageChooser, useTranslation } from "@/components/LanguageProvider";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, formatDate, formatPrice } from "@/lib/api";
import type { Booking, BookingStatus, User, Worker } from "@/lib/types";
import { ProviderSignup, ProviderDocuments, documentLabels } from "./ProviderOnboarding";

const bookingFilters = [
  { value: "all", tab: "All", label: "Total bookings", detail: "Assigned to you" },
  { value: "pending", tab: "Pending", label: "Needs a reply", detail: "Waiting for your response" },
  { value: "confirmed", tab: "Confirmed", label: "Confirmed", detail: "Upcoming jobs" },
  { value: "completed", tab: "Completed", label: "Completed", detail: "Finished jobs" },
] as const;

type BookingFilter = (typeof bookingFilters)[number]["value"];

export default function ProviderPage() {
  const { t, language, locale } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [failedSignupUploads, setFailedSignupUploads] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [busyBooking, setBusyBooking] = useState<string | null>(null);
  const bookingsHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    api<{ user: User }>("auth/me")
      .then(({ user: current }) => {
        if (current.role === "worker") setUser(current);
      })
      .catch((reason: unknown) => {
        setUser(null);
        if (!(reason instanceof ApiError) || (reason.status !== 401 && reason.status !== 403)) {
          setLoginError(reason instanceof Error ? reason.message : "Could not check your provider account.");
        }
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    setDataError("");
    try {
      const [profile, result] = await Promise.all([
        api<{ worker: Worker }>("workers/me"),
        api<{ bookings: Booking[] }>("bookings"),
      ]);
      setWorker(profile.worker);
      setBookings(result.bookings);
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : "Could not load your provider workspace.");
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const counts = useMemo(() => ({
    all: bookings.length,
    pending: bookings.filter((booking) => booking.status === "pending").length,
    confirmed: bookings.filter((booking) => booking.status === "confirmed").length,
    completed: bookings.filter((booking) => booking.status === "completed").length,
  }), [bookings]);

  const visibleBookings = bookings.filter((booking) => filter === "all" || booking.status === filter);

  function openBookings(nextFilter: BookingFilter) {
    setFilter(nextFilter);
    bookingsHeading.current?.focus({ preventScroll: true });
    bookingsHeading.current?.scrollIntoView({ block: "start" });
  }

  function statusLabel(status: string) {
    return language === "en" ? status : t(status.charAt(0).toUpperCase() + status.slice(1));
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setSubmitting(true);
    try {
      const result = await api<{ user: User }>("auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (result.user.role !== "worker") {
        await api("auth/logout", { method: "POST" });
        throw new Error("Yeh portal sirf service providers ke liye hai.");
      }
      setUser(result.user);
    } catch (reason) {
      setLoginError(reason instanceof Error ? reason.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    try {
      await api("auth/logout", { method: "POST" });
      setUser(null);
      setWorker(null);
      setBookings([]);
      setFailedSignupUploads({});
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : "Could not sign out.");
    }
  }

  async function updateBooking(id: string, status: BookingStatus) {
    setBusyBooking(id);
    setDataError("");
    try {
      await api(`bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadWorkspace();
    } catch (reason) {
      setDataError(reason instanceof Error ? reason.message : "Could not update this booking.");
    } finally {
      setBusyBooking(null);
    }
  }

  if (checkingSession) {
    return <main className="loading-screen"><span className="spinner" />{" "}{t("Checking provider account…")}</main>;
  }

  if (!user) {
    if (showSignup) {
      return <ProviderSignup onRegistered={(account, failedUploads) => {
        setShowSignup(false);
        setFailedSignupUploads(failedUploads);
        setUser(account);
      }} onBack={() => setShowSignup(false)} />;
    }
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-heading">
            <a className="brand" href="/">kaam<span>ghar</span></a>
            <LanguageChooser />
          </div>
          <p className="eyebrow">{t("SERVICE PROVIDER PORTAL")}</p>
          <h1>{t("Welcome back.")}</h1>
          <p className="intro">{t("Sign in to see bookings assigned to your professional profile.")}</p>
          <form onSubmit={signIn}>
            <label>{t("Email address")}<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>{t("Password")}<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <Link href="/api/auth/password-reset?portal=provider" prefetch={false}>{t("Forgot password?")}</Link>
            {loginError && <p className="error-message" role="alert">{t(loginError)}</p>}
            <button className="primary-button" disabled={submitting}>{submitting ? t("Signing in…") : t("Sign in to provider portal")} <span aria-hidden="true">→</span></button>
          </form>
          <button className="back-link auth-switch" type="button" onClick={() => setShowSignup(true)}>{t("Create a provider account")}</button>
          <a className="back-link" href="http://localhost:3001/">{t("← Back to KaamGhar")}</a>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="/">kaam<span>ghar</span></a>
        <LanguageChooser />
        <div className="account">
          <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.name}</strong><small>{t("Service provider")}</small></div>
          <button className="signout-button" onClick={() => void signOut()}>{t("Sign out")}</button>
        </div>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">{t("YOUR PROVIDER WORKSPACE")}</p>
          <h1>{t("Good to see you, {name}.", { name: user.name.split(" ")[0] })}</h1>
          <p>{t("Review your service requests and keep your work moving.")}</p>
        </div>
        <button className="refresh-button" onClick={() => void loadWorkspace()} disabled={loadingData}>{t("↻ Refresh bookings")}</button>
      </section>

      {worker && worker.approvalStatus !== "approved" && (
        <div className="review-notice">
          <strong>{t(worker.approvalStatus === "pending" ? "Profile under review" : "Profile not approved")}</strong>
          <span>{worker.approvalStatus === "pending" ? t("Your listing will be available to customers after admin approval.") : t("Contact support if you need help with your profile.")}</span>
        </div>
      )}
      {dataError && <p className="error-message workspace-error" role="alert">{t(dataError)}</p>}
      {worker && worker.approvalStatus !== "approved" && Object.keys(failedSignupUploads).length > 0 && <p className="error-message workspace-error" role="alert">
        {t("Account created. Upload these documents again below: {documents}", {
          documents: Object.entries(failedSignupUploads)
            .map(([type, reason]) => `${t(documentLabels[type] ?? type)} (${t(reason)})`).join(", "),
        })}
      </p>}

      {worker && worker.approvalStatus !== "approved" && <ProviderDocuments
        documents={worker.verificationDocuments ?? []} onUploaded={(document) => {
        setFailedSignupUploads((current) => Object.fromEntries(Object.entries(current).filter(([type]) => type !== document.type)));
        setWorker((profile) => profile
          ? { ...profile, verificationDocuments: [...(profile.verificationDocuments ?? []), document] }
          : profile);
      }} />}

      <section className="metrics" aria-label={t("Booking summary")}>
        {bookingFilters.map(({ value, label, detail }) => (
          <button key={value} type="button" aria-pressed={filter === value} aria-controls="provider-bookings" onClick={() => openBookings(value)}>
            <span>{t(label)}</span><strong>{counts[value]}</strong><small>{t(detail)}</small>
          </button>
        ))}
      </section>

      <section className="booking-panel" id="provider-bookings" aria-labelledby="provider-bookings-heading">
        <div className="panel-heading">
          <div><p className="eyebrow">{t("YOUR BOOKINGS")}</p><h2 id="provider-bookings-heading" ref={bookingsHeading} tabIndex={-1}>{t("Service requests")}</h2></div>
          {worker && <span className={`profile-status ${worker.approvalStatus}`}>{statusLabel(worker.approvalStatus)}</span>}
        </div>
        <div className="filters" aria-label={t("Filter bookings")}>
          {bookingFilters.map(({ value, tab }) => (
            <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>
              {t(tab)}
            </button>
          ))}
        </div>
        {loadingData ? <div className="empty-state"><span className="spinner" />{" "}{t("Loading bookings…")}</div> : visibleBookings.length ? (
          <div className="booking-list">
            {visibleBookings.map((booking) => (
              <article className="booking-card" key={booking._id}>
                <div className="booking-main">
                  <div className="booking-heading">
                    <div><p className="eyebrow">{t("CUSTOMER")}</p><h3>{booking.customer?.name || booking.customerName}</h3></div>
                    <span className={`status ${booking.status}`}>{statusLabel(booking.status)}</span>
                  </div>
                  <div className="booking-details">
                    <p><strong>{t("When")}</strong>{t(formatDate(booking.scheduledAt, locale))} · {t("{count} hr", { count: booking.durationHours || 1 })}</p>
                    <p><strong>{t("Address")}</strong>{booking.address}</p>
                    <p><strong>{t("Contact")}</strong>{booking.customer?.phone || booking.phone}</p>
                    <p><strong>{t("Notes")}</strong>{booking.notes || t("No extra details")}</p>
                  </div>
                  <div className="booking-footer">
                    <strong className="amount">₹{formatPrice(booking.totalAmount || 0)}</strong>
                    <div className="booking-actions">
                      {booking.status === "pending" && <>
                        <button className="primary-button small" disabled={busyBooking === booking._id} onClick={() => void updateBooking(booking._id, "confirmed")}>{t("Accept job")}</button>
                        <button className="secondary-button danger" disabled={busyBooking === booking._id} onClick={() => void updateBooking(booking._id, "cancelled")}>{t("Decline")}</button>
                      </>}
                      {booking.status === "confirmed" && <>
                        <button className="primary-button small" disabled={busyBooking === booking._id} onClick={() => void updateBooking(booking._id, "completed")}>{t("Mark complete")}</button>
                        <button className="secondary-button danger" disabled={busyBooking === booking._id} onClick={() => void updateBooking(booking._id, "cancelled")}>{t("Cancel")}</button>
                      </>}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><strong>{t("No bookings in this view.")}</strong><span>{t("New requests assigned to your profile will appear here.")}</span></div>
        )}
      </section>
      <footer className="footer-note">{t("Your bookings are private to your provider account.")}</footer>
    </main>
  );
}
