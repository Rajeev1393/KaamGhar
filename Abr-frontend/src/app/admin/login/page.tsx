import AuthForm from "@/components/AuthForm";

export default function AdminLoginPage() {
  return <AuthForm initialMode="login" initialRole="customer" adminOnly />;
}
