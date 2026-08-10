import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/LayoutWrapper";

export const metadata: Metadata = {
  title: "PayMaster — AI Financial Assistant",
  description:
    "PayMaster is your AI financial assistant for business payments. Ask in plain language to pay invoices, reimburse expenses, or settle vendors — the math selects the route, a human approves, and the SmartWallet executes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground selection:bg-brand-500 selection:text-white">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
