import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Provider Portal | KaamGhar",
  description: "Manage your KaamGhar service requests and professional profile.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
