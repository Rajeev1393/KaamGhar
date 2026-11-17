import { redirect } from "next/navigation";

export default function ProviderPortalRedirect() {
  redirect(process.env.PROVIDER_PORTAL_URL || "http://localhost:3002/provider");
}
