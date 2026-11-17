"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Eye, EyeOff, Home, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import DetectCityButton from "@/components/DetectCityButton";
import type { ServiceCategory } from "@/lib/types";

type Mode = "login" | "register";
type AccountRole = "customer" | "worker";

export default function AuthForm({ initialMode, initialRole, adminOnly = false, providerOnly = false }: { initialMode: Mode; initialRole: AccountRole; adminOnly?: boolean; providerOnly?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<AccountRole>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [workerCity, setWorkerCity] = useState("");
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [categoryError, setCategoryError] = useState("");

  useEffect(() => {
    if (mode !== "register" || role !== "worker") return;
    api<{ categories: ServiceCategory[] }>("workers/categories")
      .then(({ categories: availableCategories }) => {
        setCategories(availableCategories);
        setCategoryError("");
      })
      .catch((reason: Error) => setCategoryError(reason.message));
  }, [mode, role]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const payload = mode === "register" ? { ...values, role } : { email: values.email, password: values.password };
    try {
      const authPath = adminOnly ? "admin/auth/login" : `auth/${mode === "register" ? "register" : "login"}`;
      const result = await api<{ message: string; user: { role: string } }>(authPath, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (adminOnly && result.user.role !== "admin") {
        await api("admin/auth/logout", { method: "POST" });
        throw new Error("This sign-in page is only for administrators.");
      }
      if (providerOnly && result.user.role !== "worker") {
        await api("auth/logout", { method: "POST" });
        throw new Error("This sign-in page is only for service providers.");
      }
      setMessage(result.message);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(providerOnly ? "/provider" : result.user.role === "admin" ? "/admin" : next?.startsWith("/") && !next.startsWith("//") ? next : result.user.role === "worker" ? "/provider" : "/customer");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-left">
        <Link className="brand auth-brand" href="/"><span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span></Link>
        <div className="auth-art">
          <div className="auth-sun" />
          <div className="auth-home"><Home size={47} strokeWidth={1.2} /><Sparkles className="auth-art-spark" size={23} /></div>
          <div className="auth-art-card"><span><ShieldCheck size={19} /></span><div><strong>Good hands.</strong><small>Right at your doorstep.</small></div></div>
        </div>
        <div className="auth-left-copy"><p className="eyebrow">A LITTLE HELP GOES A LONG WAY</p><h1>Make room<br />for <span>the good stuff.</span></h1><p>Your home, your people, and one less thing to worry about.</p></div>
        <div className="auth-left-foot"><span><BadgeCheck size={15} /> Trusted local professionals</span><span><LockKeyhole size={15} /> Your details stay private</span></div>
      </div>
      <section className="auth-right">
        <Link className="mobile-auth-brand brand" href="/"><span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span></Link>
        <div className="auth-form-wrap">
          <Link className="back-home-link" href="/"><ArrowLeft size={15} /> Back to home</Link>
          <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "COME ON IN"}</p>
          <h2>{providerOnly ? "Provider sign in." : adminOnly ? "Admin sign in." : mode === "login" ? "Good to see you." : "Let's get you started."}</h2>
          <p className="auth-intro">{providerOnly ? "Sign in to manage your service requests and professional profile." : adminOnly ? "Sign in to the private operations console." : mode === "login" ? "Sign in and pick up right where you left off." : "Create an account. There’s a good person for that."}</p>
          {!adminOnly && !providerOnly && <div className="auth-mode-tabs"><button type="button" className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Sign in</button><button type="button" className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setMessage(""); }}>Create account</button></div>}
          <form onSubmit={submit} className="auth-form">
            {mode === "register" && <>
              <label>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="How should we call you?" /></label>
              <label>Phone number<input name="phone" required type="tel" maxLength={20} autoComplete="tel" placeholder="+91 98765 43210" /></label>
              <fieldset className="role-picker"><legend>I’m here to…</legend><label className={role === "customer" ? "role-option role-active" : "role-option"}><input type="radio" name="roleChoice" value="customer" checked={role === "customer"} onChange={() => setRole("customer")} />Book a service</label><label className={role === "worker" ? "role-option role-active" : "role-option"}><input type="radio" name="roleChoice" value="worker" checked={role === "worker"} onChange={() => setRole("worker")} />Offer my services</label></fieldset>
              {role === "worker" && <div className="worker-register-fields">
                <div className="form-grid-two"><label>Your profession<input name="profession" required minLength={2} maxLength={80} placeholder="e.g. Expert plumber" /></label><label>Service category<select name="category" required defaultValue="" disabled={categories.length === 0}><option value="" disabled>{categories.length ? "Choose a service category" : "Loading categories…"}</option>{categories.map(({ name, label }) => <option key={name} value={name}>{label}</option>)}</select>{categoryError && <small className="inline-error">Categories load nahi ho payi: {categoryError}</small>}</label></div>
                <div className="form-grid-two"><div className="location-field"><label>Your city<input name="city" required minLength={2} maxLength={80} value={workerCity} onChange={(event) => setWorkerCity(event.target.value)} placeholder="e.g. Delhi" /></label><DetectCityButton compact onCity={setWorkerCity} /></div><label>Experience<input name="experience" required type="number" min={0} max={60} placeholder="Years" /></label></div>
                <div className="form-grid-two"><label>Hourly rate<input name="price" required type="number" min={1} placeholder="₹ per hour" /></label><label className="wide-field">About your service<input name="description" required minLength={10} maxLength={300} placeholder="What kind of work do you do?" /></label></div>
                <p className="form-note">Your listing will go live after admin verification.</p>
              </div>}
            </>}
            <label>Email address<input name="email" required type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
            <label>Password<div className="password-field"><input name="password" required type={showPassword ? "text" : "password"} minLength={8} maxLength={72} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            <p className={message ? "auth-message visible" : "auth-message"} aria-live="polite">{message}</p>
            <button type="submit" className="primary-button auth-submit" disabled={loading}>{loading ? "One moment…" : mode === "login" ? "Sign in" : "Create my account"}{!loading && <ArrowRight size={17} />}</button>
          </form>
          <p className="auth-privacy"><ShieldCheck size={14} /> Your information is encrypted and secure.</p>
        </div>
        <span className="auth-copyright">© 2026 KaamGhar · Good work, good people.</span>
      </section>
    </main>
  );
}
