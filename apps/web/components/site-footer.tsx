import Link from "next/link";
import { Mail } from "lucide-react";

import { Logo } from "./logo";

const LEGAL_LINKS = [
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "Conditions d'utilisation", href: "/conditions" },
  { label: "Droits d'auteur", href: "/droits" },
];

export function SiteFooter() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-ink">
      <div className="container-page flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Logo className="h-11" />
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-cream"
            >
              <Mail className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{contactEmail}</span>
            </a>
          ) : null}
        </div>

        <nav aria-label="Informations légales">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-xs text-muted transition-colors hover:text-cream"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="container-page border-t border-line/70 py-4">
        <p className="text-xs leading-5 text-muted">
          © {year} AllDown. Téléchargez uniquement les contenus que vous êtes
          autorisé à utiliser.
        </p>
      </div>
    </footer>
  );
}
