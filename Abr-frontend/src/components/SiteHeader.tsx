"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="KaamGhar home">
        <span className="brand-symbol">k</span><span>kaam<span className="brand-green">ghar</span></span>
      </Link>
      <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav className={open ? "site-nav nav-open" : "site-nav"}>
        <Link href="/#services" onClick={() => setOpen(false)}>Services</Link>
        <Link href="/#professionals" onClick={() => setOpen(false)}>Our professionals</Link>
        <Link href="/provider" onClick={() => setOpen(false)}>Provider portal</Link>
        <Link href="/login?mode=register&role=worker" onClick={() => setOpen(false)}>Join as a pro</Link>
      </nav>
      <Link className="header-account" href="/login">Sign in <ArrowUpRight size={15} /></Link>
    </header>
  );
}
