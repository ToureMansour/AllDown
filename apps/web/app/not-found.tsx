import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] max-w-2xl flex-col items-start justify-center py-16">
      <p className="font-mono text-sm text-brand">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-cream sm:text-4xl">
        Cette page n&apos;existe pas.
      </h1>
      <p className="mt-4 text-sm leading-7 text-muted">
        Le lien est peut-être incomplet ou la page a été déplacée. Revenez à
        l&apos;accueil pour analyser un média.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-ink transition-colors hover:bg-brand-soft"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
