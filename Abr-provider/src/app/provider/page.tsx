"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, formatDate, formatPrice } from "@/lib/api";
import type { Booking, BookingStatus, User, Worker } from "@/lib/types";

type BookingFilter = "all" | "pending" | "confirmed" | "completed";

export default function ProviderPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [busyBooking, setBusyBooking] = useState<string | null>(null);

  useEffect(() => {
    api<{ user: User }>("auth/me")
      .then(({ user: current }) => {
        if (current.role === "worker") setUser(current);
      })
      .catch(() => setUser(null))
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
    total: bookings.length,
    pending: bookings.filter((booking) => booking.status === "pending").length,
    confirmed: bookings.filter((booking) => booking.status === "confirmed").length,
    completed: bookings.filter((booking) => booking.status === "completed").length,
  }), [bookings]);

  const visibleBookings = bookings.filter((booking) => filter === "all" || booking.status === filter);

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
    return <main className="loading-screen"><span className="spinner" /> Checking provider account…</main>;
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <a className="brand" href="/">kaam<span>ghar</span></a>
          <p className="eyebrow">SERVICE PROVIDER PORTAL</p>
          <h1>Welcome back.</h1>
          <p className="intro">Sign in to see bookings assigned to your professional profile.</p>
          <form onSubmit={signIn}>
            <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {loginError && <p className="error-message" role="alert">{loginError}</p>}
            <button className="primary-button" disabled={submitting}>{submitting ? "Signing in…" : "Sign in to provider portal"} <span aria-hidden="true">→</span></button>
          </form>
          <a className="back-link" href="http://localhost:3001/">← Back to KaamGhar</a>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="/">kaam<span>ghar</span></a>
        <div className="account">
          <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.name}</strong><small>Service provider</small></div>
          <button className="signout-button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">YOUR PROVIDER WORKSPACE</p>
          <h1>Good to see you, {user.name.split(" ")[0]}.</h1>
          <p>Review your service requests and keep your work moving.</p>
        </div>
        <button className="refresh-button" onClick={() => void loadWorkspace()} disabled={loadingData}>↻ Refresh bookings</button>
      </section>

      {worker && worker.approvalStatus !== "approved" && (
        <div className="review-notice">
          <strong>Profile {worker.approvalStatus === "pending" ? "under review" : "not approved"}</strong>
          <span>{worker.approvalStatus === "pending" ? "Your listing will be available to customers after admin approval." : "Contact support if you need help with your profile."}</span>
        </div>
      )}
      {dataError && <p className="error-message workspace-error" role="alert">{dataError}</p>}

      <section className="metrics" aria-label="Booking summary">
        <article><span>Total bookings</span><strong>{counts.total}</strong><small>Assigned to you</small></article>
        <article><span>Needs a reply</span><strong>{counts.pending}</strong><small>Waiting for your response</small></article>
        <article><span>Confirmed</span><strong>{counts.confirmed}</strong><small>Upcoming jobs</small></article>
        <article><span>Completed</span><strong>{counts.completed}</strong><small>Finished jobs</small></article>
      </section>

      <section className="booking-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">YOUR BOOKINGS</p><h2>Service requests</h2></div>
          {worker && <span className={`profile-status ${worker.approvalStatus}`}>{worker.approvalStatus}</span>}
        </div>
        <div className="filters" aria-label="Filter bookings">
          {(["all", "pending", "confirmed", "completed"] as BookingFilter[]).map((value) => (
            <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>
              {value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        {loadingData ? <div className="empty-state"><span className="spinner" /> Loading bookings…</div> : visibleBookings.length ? (
          <div className="booking-list">
            {visibleBookings.map((booking) => (
              <article className="booking-card" key={booking._id}>
                <div className="booking-main">
                  <div className="booking-heading">
                    <div><p className="eyebrow">CUSTOMER</p><h3>{booking.customer?.name || booking.customerName}</h3></div>
                    <span className={`status ${booking.status}`}>{booking.status}</span>
                  </div>
                  <div className="booking-details">
                    <p><strong>When</strong>{formatDate(booking.scheduledAt)} · {booking.durationHours || 1} hr</p>
                    <p><strong>Address</strong>{booking.address}</p>
                    <p><strong>Contact</strong>{booking.customer?.phone || booking.phone}</p>
                    <p><strong>Notes</strong>{booking.notes || "No extra details"}</p>
                  </div>
                  <div className="booking-footer">
                    <strong className="amount">₹{formatPrice(booking.totalAmount || 0)}</strong>
                    <div className="booking-actions">
                      {booking.status === "pending" && <>
                        <button className="primary-button small" disabled={busyBooking === booking._id} onClick={() => void updateBooking(booking._id, "confirmed")}>Accept job</button>
                        <button className="secondary-button danger" disabled={busyBooking === booking._id} onClick={() => void updateBooking(booking._id, "cancelled")}>Decline</button>
                      </>}
                      {booking.status === "confirmed" && <>
                        <button className="primary-button small" disabled={busyBooking === booking._id} onClick={() => void updateBooking(booking._id, "completed")}>Mark complete</button>
                        <button className="secondary-button danger" disabled={busyBooking === booking._id} onClick={() => void updateBooking(booking._id, "cancelled")}>Cancel</button>
                      </>}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><strong>No bookings in this view.</strong><span>New requests assigned to your profile will appear here.</span></div>
        )}
      </section>
      <footer className="footer-note">Your bookings are private to your provider account.</footer>
    </main>
  );
}
