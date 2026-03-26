import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Affiliate Engine — Site Network Dashboard",
  description: "Manage, monitor, and scale your affiliate site network",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body className="min-h-screen bg-base-200">{children}</body>
    </html>
  );
}
