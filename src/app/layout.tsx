import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";
import "./labgold-dark.css";
import "./labgold-whatsapp.css";

// Fonte do modelo do designer (versão limpa): Inter.
const jakarta = localFont({
  src: "./fonts/Inter-Variable-latin.woff2",
  display: "swap",
  variable: "--font-ui",
  weight: "100 900",
});

const mono = localFont({
  src: "./fonts/JetBrainsMono-Variable.ttf",
  display: "swap",
  variable: "--font-ui-mono",
  weight: "400 500",
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
