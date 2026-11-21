"use client";

import { useEffect, useState } from "react";
import { api, formatDate } from "@/lib/api";

type Benefits = {
  referralsEnabled: boolean;
  referralCode: string | null;
  referredCustomers: number;
  membership: { name: string; benefits: string; expiresAt: string } | null;
};

export default function CustomerBenefits({ refresh }: { refresh: number }) {
  const [benefits, setBenefits] = useState<Benefits>();
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api<Benefits>("auth/benefits", { signal: controller.signal })
      .then(setBenefits)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load benefits.");
      });
    return () => controller.abort();
  }, [refresh]);

  async function generateCode() {
    setGenerating(true);
    setError("");
    try {
      const { referralCode } = await api<{ referralCode: string }>("auth/referral-code", { method: "POST" });
      setBenefits((current) => current && { ...current, referralCode });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a referral code.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink(code: string) {
    const url = new URL("/login", window.location.origin);
    url.searchParams.set("mode", "register");
    url.searchParams.set("referral", code);
    try {
      await navigator.clipboard.writeText(url.href);
      setCopyStatus("Referral link copied.");
    } catch {
      setCopyStatus("Copy the referral code shown below and share it with a friend.");
    }
  }

  if (!benefits?.referralsEnabled && !benefits?.membership && !error) return null;
  const code = benefits?.referralCode;
  return <section className="dash-panel" aria-labelledby="customer-benefits">
    <div className="panel-heading"><h2 id="customer-benefits">Referrals & membership</h2></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {benefits?.referralsEnabled && <div>
      <h3>Refer a friend</h3>
      {code ? <>
        <p>Referral code <strong>{code}</strong></p>
        <button className="button button-outline" onClick={() => void copyLink(code)}>Copy referral link</button>
        <p role="status">{copyStatus}</p>
      </> : <button className="button button-outline" disabled={generating} onClick={() => void generateCode()}>Generate referral code</button>}
      <p>{benefits.referredCustomers} referred signups</p>
    </div>}
    {benefits?.membership && <div>
      <h3>{benefits.membership.name}</h3>
      <p>{benefits.membership.benefits}</p>
      <p>Expires {formatDate(benefits.membership.expiresAt)}</p>
    </div>}
  </section>;
}
