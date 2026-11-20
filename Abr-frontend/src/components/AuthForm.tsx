"use client";

import { LanguageChooser, useTranslation } from "@/components/LanguageProvider";
import { ThemeChooser } from "@/components/ThemeProvider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Eye, EyeOff, Home, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import DetectCityButton from "@/components/DetectCityButton";
import type { ServiceCategory } from "@/lib/types";

type Mode = "login" | "register";
type AccountRole = "customer" | "worker";

export default function AuthForm({ initialMode, initialRole, adminOnly = false, providerOnly = false, showThemeChooser = false }: { initialMode: Mode; initialRole: AccountRole; adminOnly?: boolean; providerOnly?: boolean; showThemeChooser?: boolean }) {
  const { t, language } = useTranslation();
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
        throw new Error(t("This sign-in page is only for administrators."));
      }
      if (providerOnly && result.user.role !== "worker") {
        await api("auth/logout", { method: "POST" });
        throw new Error(t("This sign-in page is only for service providers."));
      }
      setMessage(result.message);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(providerOnly ? "/provider" : result.user.role === "admin" ? "/admin" : next?.startsWith("/") && !next.startsWith("//") ? next : result.user.role === "worker" ? "/provider" : "/customer");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : t("Something went wrong. Please try again."));
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
          <div className="auth-art-card"><span><ShieldCheck size={19} /></span><div><strong>{t("Good hands.")}</strong><small>{t("Right at your doorstep.")}</small></div></div>
        </div>
        <div className="auth-left-copy"><p className="eyebrow">{t("A LITTLE HELP GOES A LONG WAY")}</p><h1>{language === "en" ? <>Make room<br />for <span>the good stuff.</span></> : t("Make room for the good stuff.")}</h1><p>{t("Your home, your people, and one less thing to worry about.")}</p></div>
        <div className="auth-left-foot"><span><BadgeCheck size={15} />{" "}{t("Trusted local professionals")}</span><span><LockKeyhole size={15} />{" "}{t("Your details stay private")}</span></div>
      </div>
      <section className="auth-right">
        <div className="auth-language"><LanguageChooser />{showThemeChooser && <ThemeChooser />}</div>
        <Link className="mobile-auth-brand brand" href="/"><span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span></Link>
        <div className="auth-form-wrap">
          <Link className="back-home-link" href="/"><ArrowLeft size={15} />{" "}{t("Back to home")}</Link>
          <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "COME ON IN"}</p>
          <h2>{providerOnly ? t("Provider sign in.") : adminOnly ? t("Admin sign in.") : mode === "login" ? t("Good to see you.") : t("Let's get you started.")}</h2>
          <p className="auth-intro">{providerOnly ? t("Sign in to manage your service requests and professional profile.") : adminOnly ? t("Sign in to the private operations console.") : mode === "login" ? t("Sign in and pick up right where you left off.") : t("Create an account. There’s a good person for that.")}</p>
          {!adminOnly && !providerOnly && <div className="auth-mode-tabs"><button type="button" className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setMessage(""); }}>{t("Sign in")}</button><button type="button" className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setMessage(""); }}>{t("Create account")}</button></div>}
          <form onSubmit={submit} className="auth-form">
            {mode === "register" && <>
              <label>{t("Full name")}<input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder={t("How should we call you?")} /></label>
              <label>{t("Phone number")}<input name="phone" required type="tel" maxLength={20} autoComplete="tel" placeholder="+91 98765 43210" /></label>
              <fieldset className="role-picker"><legend>{t("I’m here to…")}</legend><label className={role === "customer" ? "role-option role-active" : "role-option"}><input type="radio" name="roleChoice" value="customer" checked={role === "customer"} onChange={() => setRole("customer")} />{t("Book a service")}</label><label className={role === "worker" ? "role-option role-active" : "role-option"}><input type="radio" name="roleChoice" value="worker" checked={role === "worker"} onChange={() => setRole("worker")} />{t("Offer my services")}</label></fieldset>
              {role === "worker" && <div className="worker-register-fields">
                <div className="form-grid-two"><label>{t("Your profession")}<input name="profession" required minLength={2} maxLength={80} placeholder={t("e.g. Expert plumber")} /></label><label>{t("Service category")}<select name="category" required defaultValue="" disabled={categories.length === 0}><option value="" disabled>{categories.length ? t("Choose a service category") : t("Loading categories…")}</option>{categories.map(({ name, label }) => <option key={name} value={name}>{t(label)}</option>)}</select>{categoryError && <small className="inline-error">Categories load nahi ho payi: {categoryError}</small>}</label></div>
                <div className="form-grid-two"><div className="location-field"><label>{t("Your city")}<input name="city" required minLength={2} maxLength={80} value={workerCity} onChange={(event) => setWorkerCity(event.target.value)} placeholder={t("e.g. Delhi")} /></label><DetectCityButton compact onCity={setWorkerCity} /></div><label>{t("Experience")}<input name="experience" required type="number" min={0} max={60} placeholder={t("Years")} /></label></div>
                <div className="form-grid-two"><label>{t("Hourly rate")}<input name="price" required type="number" min={1} placeholder={t("₹ per hour")} /></label><label className="wide-field">{t("About your service")}<input name="description" required minLength={10} maxLength={300} placeholder={t("What kind of work do you do?")} /></label></div>
                <p className="form-note">{t("Your listing will go live after admin verification.")}</p>
              </div>}
            </>}
            <label>{t("Email address")}<input name="email" required type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
            <label>{t("Password")}<div className="password-field"><input name="password" required type={showPassword ? "text" : "password"} minLength={8} maxLength={72} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={t("At least 8 characters")} /><button type="button" aria-label={showPassword ? t("Hide password") : t("Show password")} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            <p className={message ? "auth-message visible" : "auth-message"} aria-live="polite">{message}</p>
            {!adminOnly && mode === "login" && <Link href="/api/auth/password-reset" prefetch={false}>{t("Forgot password?")}</Link>}
            <button type="submit" className="primary-button auth-submit" disabled={loading}>{loading ? t("One moment…") : mode === "login" ? t("Sign in") : t("Create my account")}{!loading && <ArrowRight size={17} />}</button>
          </form>
          <p className="auth-privacy"><ShieldCheck size={14} />{" "}{t("Your information is encrypted and secure.")}</p>
        </div>
        <span className="auth-copyright">© 2026 KaamGhar · Good work, good people.</span>
      </section>
    </main>
  );
}
