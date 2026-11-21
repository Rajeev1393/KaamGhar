import AuthForm from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; role?: string; referral?: string }>;
}) {
  const query = await searchParams;
  return <div className="customer-theme"><AuthForm showThemeChooser initialReferralCode={typeof query.referral === "string" ? query.referral.slice(0, 32) : undefined} initialMode={query.mode === "register" || query.role || query.referral ? "register" : "login"} initialRole={query.role === "worker" ? "worker" : "customer"} /></div>;
}
