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
  title: "OticaHub Lab",
  description: "Gestão de ordens, montagem, qualidade e estoque de lentes oftálmicas.",
  applicationName: "OticaHub Lab",
  appleWebApp: {
    capable: true,
    title: "OticaHub Lab",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#087e83",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full antialiased">
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "var(--font-ui)",
              background: "#ffffff",
              border: "1px solid #dce5e7",
              color: "#172e32",
            },
          }}
        />
      </body>
    </html>
  );
}
