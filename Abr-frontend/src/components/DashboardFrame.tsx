"use client";

import { LanguageChooser, useTranslation } from "@/components/LanguageProvider";
import { ThemeChooser } from "@/components/ThemeProvider";
import { availableTabs } from "@/modules/admin/navigation";
import { ApiError, api } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, CalendarDays, Check, ClipboardList, LayoutDashboard, LogOut, Menu, MessageCircle, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type DashboardProps = {
  expectedRole: Role;
  Screen: React.ComponentType<{ user: User; refresh: number; onRefresh: () => void; notify: (message: string) => void }>;
};

const roleTitles: Record<Role, string> = {
  customer: "My home",
  worker: "Pro workspace",
  admin: "Operations",
};

function DashboardHeader({ user, onLogout, title }: { user: User; onLogout: () => void; title: string }) {
  const { t } = useTranslation();
  return <header className="dash-topbar"><div className="dash-mobile-brand"><Link className="brand" href="/"><span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span></Link></div><div className="dash-heading"><p className="eyebrow">{t(roleTitles[user.role])} / 2026</p><h1>{title}</h1></div><div className="dash-account-actions"><LanguageChooser />{user.role === "customer" && <ThemeChooser />}<div className="dash-user"><span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{t(user.role === "worker" ? "Local service partner" : user.role === "admin" ? "Admin account" : "Customer account")}</small></div><button title={t("Sign out")} onClick={onLogout} className="logout-icon"><LogOut size={17} /></button></div></div></header>;
}

function DashboardShell({ user, onLogout, children, title }: { user: User; onLogout: () => void; children: React.ReactNode; title: string }) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const links = user.role === "admin"
    ? availableTabs(user).map(({ label, id, icon }) => ({ label: t(label), href: id === "overview" ? "/admin" : `/admin#${id}`, icon }))
    : user.role === "worker"
      ? [{ label: t("Overview"), href: "/provider", icon: LayoutDashboard }, { label: t("Service requests"), href: "/provider#provider-bookings", icon: ClipboardList }, { label: t("My profile"), href: "/provider/profile#profile", icon: BriefcaseBusiness }]
      : [{ label: t("Overview"), href: "/customer", icon: LayoutDashboard }, { label: t("My bookings"), href: "/customer#bookings", icon: CalendarDays }, { label: t("Find a pro"), href: "/#professionals", icon: SearchIcon }, { label: t("Support chat"), href: "/customer/support", icon: MessageCircle }];
  return <div className="dashboard-layout"><aside className={`dash-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}><Link className="brand dash-brand" href="/"><span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span></Link><p className="sidebar-eyebrow">{user.role === "admin" ? t("ADMIN · PRIVATE CONSOLE") : user.role === "worker" ? t("YOUR BUSINESS") : t("YOUR HOME")}</p><nav className="dash-nav">{links.map(({ label, href, icon: Icon }, index) => <Link key={href} className={(user.role === "customer" ? pathname === href : index === 0) ? "dash-nav-link active" : "dash-nav-link"} href={href} onClick={(event) => { if (user.role === "admin") { event.preventDefault(); window.dispatchEvent(new CustomEvent("kaamghar-admin-tab", { detail: href.split("#")[1] ?? "overview" })); } setSidebarOpen(false); }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{(user.role === "customer" ? pathname === href : index === 0) && <span className="nav-active-mark" />}</Link>)}</nav><div className="sidebar-help"><span className="sidebar-help-icon"><ShieldCheck size={19} /></span><strong>{t("Need a hand?")}</strong><span>{t("We’re here to help you out.")}</span>{user.role === "customer" ? <Link href="/customer/support" onClick={() => setSidebarOpen(false)}>{t("Support chat")} <MessageCircle size={13} /></Link> : <a href="mailto:hello@kaamghar.example">{t("Get in touch")}{" "}<ArrowUpRight size={13} /></a>}</div><Link href="/" className="sidebar-back"><ArrowLeft size={15} />{" "}{t("Back to marketplace")}</Link><button className="sidebar-signout" onClick={onLogout}><LogOut size={16} />{" "}{t("Sign out")}</button></aside><div className="dash-content"><button className="dash-mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={t("Toggle menu")}><Menu size={20} /></button><DashboardHeader user={user} onLogout={onLogout} title={title} />{children}</div></div>;
}

function SearchIcon({ size = 17 }: { size?: number }) {
  return <ArrowUpRight size={size} />;
}

export default function DashboardFrame({ expectedRole, Screen }: DashboardProps) {
  const { t } = useTranslation();
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
        router.replace(expectedRole === "admin" ? "/admin/login" : expectedRole === "worker" ? "/provider" : `/login?next=${encodeURIComponent(returnTo)}`);
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

  if (authLoading) return <div className="dashboard-loading" role="status"><span className="loading-dot" />{" "}{t("Checking your account…")}</div>;
  if (accountMismatch) return <main className="dashboard-loading" role="alert">
    <h1>Customer account required</h1>
    <p>This browser is signed in as a {accountMismatch === "worker" ? "service provider" : accountMismatch}. Sign in with a customer account to book services.</p>
    {error && <p className="inline-error">{error}</p>}
    <button className="button button-dark" onClick={() => void switchToCustomerAccount()}>Sign out and switch to customer</button>
    <Link className="text-link" href="/">{t("Back to marketplace")}</Link>
  </main>;
  if (!user) return <div className="dashboard-loading" role={error ? "alert" : "status"}><span className="loading-dot" /> {error || t("Sign in is required to view this dashboard.")} {error ? <button className="button button-outline" onClick={() => window.location.reload()}>{t("Retry")}</button> : <Link className="text-link" href={expectedRole === "admin" ? "/admin/login" : expectedRole === "worker" ? "/provider" : "/login"}>{t("Go to sign in")}</Link>}</div>;
  return <DashboardShell user={user} onLogout={() => void logout()} title={expectedRole === "customer" ? t("Your home, taken care of.") : expectedRole === "worker" ? t("Provider dashboard") : t("The whole picture.")}>
    {error && <div className="dashboard-alert"><span>{error}</span><button onClick={() => setError("")}><X size={15} /></button></div>}
    <Screen user={user} refresh={refresh} onRefresh={() => setRefresh((current) => current + 1)} notify={notify} />
    {toast && <div className="dash-toast"><Check size={16} />{toast}</div>}
  </DashboardShell>;
}
