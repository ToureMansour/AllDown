import type { Metadata } from "next";

import { Downloader } from "@/components/downloader";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <section className="hero-ambient relative overflow-hidden">
      <div
        aria-hidden="true"
        className="hero-grid pointer-events-none absolute inset-0"
      />

      <div className="container-page relative flex min-h-[calc(100dvh-9rem)] flex-col items-center justify-center py-16 sm:py-20">
        <div className="w-full max-w-3xl text-center">
          <div className="animate-rise mb-7 flex justify-center">
            <Logo className="h-20 sm:h-24" priority />
          </div>

          <div className="animate-rise inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur">
            <span
              className="size-1.5 rounded-full bg-brand"
              aria-hidden="true"
            />
            Sans inscription · Sans ajout de filigrane
          </div>

          <h1 className="animate-rise mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-cream [animation-delay:80ms] sm:text-6xl">
            Collez un lien.
            <br />
            <span className="text-brand">Téléchargez.</span>
          </h1>

          <p className="animate-rise mx-auto mt-5 max-w-xl text-base leading-7 text-muted [animation-delay:160ms] sm:text-lg sm:leading-8">
            Vidéo ou photo, dans le format fourni par la source. L’extraction
            démarre dès que vous collez le lien.
          </p>

          <div className="animate-rise mx-auto mt-9 [animation-delay:220ms]">
            <Downloader />
          </div>
        </div>
      </div>
    </section>
  );
}
