import type { Metadata } from "next";
import ProviderPortal from "@/modules/provider/ProviderPortal";
import styles from "@/modules/provider/provider.module.css";

export const metadata: Metadata = { title: "Provider Portal | KaamGhar" };

export default async function ProviderPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <div className={styles.portal}><ProviderPortal initialSignup={mode === "register"} /></div>;
}
