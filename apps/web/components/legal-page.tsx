import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function LegalPage({
  title,
  description,
  updatedAt = "30 octobre 2026",
  children,
}: {
  title: string;
  description: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page max-w-3xl py-12 sm:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-muted transition-colors hover:text-cream"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour à l&apos;accueil
      </Link>

      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
        Informations légales
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-cream sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-sm leading-7 text-muted">{description}</p>
      <p className="mt-2 text-xs text-muted/80">
        Dernière mise à jour : {updatedAt}
      </p>

      <div className="mt-10 space-y-8 border-t border-line pt-8 text-sm leading-7 text-muted [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-cream [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-cream [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
