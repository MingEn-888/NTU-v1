import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export const metadata: Metadata = {
  title: "PayMaster — AI Financial Assistant",
  description:
    "PayMaster is your AI financial assistant for business payments. Ask in plain language to pay invoices, reimburse expenses, or settle vendors — the math selects the route, a human approves, and the SmartWallet executes.",
};

/**
 * Sets the theme before React hydrates so there is no flash of the wrong theme.
 * Inline + async so it never blocks first paint.
 */
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    var resolved = mode === "system" ? (prefersLight ? "light" : "dark") : mode;
    var root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.classList.toggle("dark", resolved === "dark");
    root.classList.toggle("light", resolved === "light");
    root.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark theme-transition" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased bg-background text-foreground selection:bg-brand-500 selection:text-white">
        <ThemeProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
