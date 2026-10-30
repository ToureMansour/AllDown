import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AllDown — Vos médias. Un lien. Un téléchargement.",
    template: "%s · AllDown",
  },
  description:
    "Collez le lien de votre contenu et récupérez le fichier lorsque la source le permet. Simple, rapide et sans inscription.",
  applicationName: "AllDown",
  keywords: [
    "télécharger une vidéo",
    "téléchargeur vidéo",
    "YouTube",
    "TikTok",
    "Instagram",
    "Facebook",
    "LinkedIn",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "AllDown",
    title: "AllDown — Vos médias. Un lien. Un téléchargement.",
    description:
      "Collez le lien de votre contenu et récupérez le fichier lorsque la source le permet. Sans inscription.",
  },
  twitter: {
    card: "summary",
    title: "AllDown — Vos médias. Un lien. Un téléchargement.",
    description:
      "Collez le lien de votre contenu et récupérez le fichier lorsque la source le permet. Sans inscription.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#171717",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#contenu"
          className="sr-only z-[100] rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Aller au contenu
        </a>
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
