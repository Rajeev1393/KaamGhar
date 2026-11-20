"use client";

import DashboardFrame from "@/components/DashboardFrame";
import SupportConversation from "@/components/SupportConversation";
import { useTranslation } from "@/components/LanguageProvider";

function CustomerSupport() {
  const { t } = useTranslation();
  return <section className="dash-panel">
    <div className="panel-heading"><h2>{t("Support chat")}</h2></div>
    <p className="support-description">{t("Send us a message about your booking, payment, or account. Replies will appear here.")}</p>
    <SupportConversation endpoint="support" sender="customer" />
  </section>;
}

export default function CustomerSupportPage() {
  return <DashboardFrame expectedRole="customer" Screen={CustomerSupport} />;
}
