import AuthForm from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; role?: string }>;
}) {
  const query = await searchParams;
  return <div className="customer-theme"><AuthForm showThemeChooser initialMode={query.mode === "register" || query.role ? "register" : "login"} initialRole={query.role === "worker" ? "worker" : "customer"} /></div>;
}
