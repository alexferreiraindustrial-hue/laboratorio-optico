import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
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
  themeColor: "#8c6239",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const dark = (await cookies()).get("lab_theme")?.value === "dark";
  return (
    <html data-theme={dark ? "dark" : "light"} lang="pt-BR" className={`${manrope.variable} ${plexMono.variable} h-full`}>
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
