import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import "./labgold-dark.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  variable: "--font-ui-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Lab Gold",
  description: "Gestão de ordens, montagem, qualidade e estoque de lentes oftálmicas.",
  applicationName: "Lab Gold",
  appleWebApp: {
    capable: true,
    title: "Lab Gold",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07070a",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const dark = (await cookies()).get("lab_theme")?.value !== "light";
  return (
    <html data-theme={dark ? "dark" : "light"} lang="pt-BR" className={`${jakarta.variable} ${mono.variable} h-full`}>
      <body className="min-h-full antialiased">
        {children}
        <ThemeToggle initialDark={dark} />
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "var(--font-ui)",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
            },
          }}
        />
      </body>
    </html>
  );
}
