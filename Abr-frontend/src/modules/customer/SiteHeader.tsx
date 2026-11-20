"use client";

import { LanguageChooser, useTranslation } from "@/components/LanguageProvider";
import { ThemeChooser } from "@/components/ThemeProvider";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";

export default function SiteHeader() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label={t("KaamGhar home")}>
        <span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span>
      </Link>
      <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label={open ? t("Close menu") : t("Open menu")}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav className={open ? "site-nav nav-open" : "site-nav"}>
        <Link href="/#services" onClick={() => setOpen(false)}>{t("Services")}</Link>
        <Link href="/#professionals" onClick={() => setOpen(false)}>{t("Our professionals")}</Link>
        <Link href="/provider" onClick={() => setOpen(false)}>{t("Provider portal")}</Link>
        <Link href="/provider?mode=register" onClick={() => setOpen(false)}>{t("Join as a pro")}</Link>
        <Link className="mobile-sign-in" href="/login" onClick={() => setOpen(false)}>{t("Sign in")}</Link>
      </nav>
      <div className="header-language-actions">
        <LanguageChooser />
        <ThemeChooser />
        <Link className="header-account" href="/login">{t("Sign in")}{" "}<ArrowUpRight size={15} /></Link>
      </div>
    </header>
  );
}
