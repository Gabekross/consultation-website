import "./globals.scss";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking Platform",
  description: "Multi-tenant booking funnels for MCs and event professionals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
