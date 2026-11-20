"use client";

import { useTranslation } from "@/components/LanguageProvider";
import type { Booking } from "@/lib/types";
import { BriefcaseBusiness, CalendarDays } from "lucide-react";

export function StatusPill({ status }: { status: string }) {
  const { t, language } = useTranslation();
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`status-pill status-${status}`}>{language === "en" ? status : t(label)}</span>;
}

export function hasActivePayment(booking: Booking) {
  return booking.paymentStatus !== "paid" &&
    booking.paymentStatus !== "refund_required" &&
    Boolean(booking.paymentOrderId || (booking.paymentOrderExpiresAt && Date.parse(booking.paymentOrderExpiresAt) > Date.now()));
}

export function Metric({ icon: Icon, label, value, foot, onClick }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; value: string | number; foot: string; onClick?: () => void }) {
  const content = <><span className="metric-icon"><Icon size={18} strokeWidth={1.8} /></span><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-foot">{foot}</span></>;
  return onClick
    ? <button type="button" className="metric-card metric-card-clickable" onClick={onClick} aria-label={`View ${label.toLowerCase()}: ${value}`}>{content}</button>
    : <article className="metric-card">{content}</article>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-state-icon"><CalendarDays size={20} /></span><strong>{title}</strong><p>{text}</p>{action}</div>;
}

export function LoadingLine() {
  const { t } = useTranslation();
  return <div className="table-loading"><span className="loading-dot" />{" "}{t("Loading your latest…")}</div>;
}

export function WrenchIcon() {
  return <BriefcaseBusiness size={18} />;
}
