import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KaamGhar — Home services, sorted",
  description: "Book trusted home-service professionals in your neighbourhood.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
