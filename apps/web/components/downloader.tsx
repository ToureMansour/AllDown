"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ClipboardPaste,
  Info,
  Link2,
  ShieldCheck,
  X,
} from "lucide-react";

import { analyzeMedia, ApiError, type AnalyzeResponse } from "@/lib/api";
import { validateMediaUrl } from "@/lib/validation";
import { MediaResult } from "./media-result";

type AnalysisStatus = "idle" | "analyzing" | "success";

const ANALYSIS_TIMEOUT_MS = 60_000;

export function Downloader() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyzing = status === "analyzing";
  const hasError = Boolean(error);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!result) return;

    const frame = window.requestAnimationFrame(() => {
      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      resultRef.current?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "center",
      });
      resultRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [result]);

  const resetResult = () => {
    if (result) {
      setResult(null);
      setStatus("idle");
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setError(null);
    setPasteMessage(null);
    resetResult();
  };

  const analyzeUrl = async (rawUrl: string) => {
    if (analyzing) return;

    const targetUrl = rawUrl.trim();
    setUrl(targetUrl);

    const validationError = validateMediaUrl(targetUrl);
    if (validationError) {
      setError(validationError);
      setStatus("idle");
      inputRef.current?.focus();
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;

    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ANALYSIS_TIMEOUT_MS);

    setStatus("analyzing");
    setError(null);
    setPasteMessage(null);
    setResult(null);

    try {
      const data = await analyzeMedia(targetUrl, controller.signal);
      setResult(data);
      setAnalyzedUrl(targetUrl);
      setStatus("success");
    } catch (analysisError) {
      if (
        analysisError instanceof DOMException &&
        analysisError.name === "AbortError"
      ) {
        if (timedOut) {
          setError(
            "L'extraction a dépassé le délai autorisé. Réessayez avec un autre lien.",
          );
        }
        setStatus("idle");
        return;
      }

      setError(
        analysisError instanceof ApiError
          ? analysisError.message
          : "L'extraction a échoué. Vérifiez le lien et réessayez.",
      );
      setStatus("idle");
    } finally {
      window.clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void analyzeUrl(url);
  };

  const handleInputPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const value = event.clipboardData.getData("text").trim();
    if (!value || analyzing) return;

    event.preventDefault();
    void analyzeUrl(value);
  };

  const handlePasteButton = async () => {
    if (analyzing) return;

    if (!navigator.clipboard?.readText) {
      setPasteMessage(
        "Le presse-papiers n'est pas accessible dans ce navigateur. Collez le lien avec Ctrl+V.",
      );
      inputRef.current?.focus();
      return;
    }

    try {
      const value = (await navigator.clipboard.readText()).trim();

      if (!value) {
        setPasteMessage("Le presse-papiers est vide.");
        inputRef.current?.focus();
        return;
      }

      await analyzeUrl(value);
    } catch {
      setPasteMessage(
        "L'accès au presse-papiers a été refusé. Collez le lien avec Ctrl+V.",
      );
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    if (analyzing) return;
    setUrl("");
    setError(null);
    setPasteMessage(null);
    setResult(null);
    setStatus("idle");
    inputRef.current?.focus();
  };

  return (
    <div>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        aria-busy={analyzing}
        className="rounded-2xl border border-line bg-surface p-2 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]"
      >
        <div className="relative">
          <label htmlFor="media-url" className="sr-only">
            Lien de la vidéo ou de la photo
          </label>
          <Link2
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            id="media-url"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Collez le lien de la vidéo ou de la photo…"
            value={url}
            onChange={(event) => handleUrlChange(event.target.value)}
            onPaste={handleInputPaste}
            disabled={analyzing}
            aria-invalid={hasError}
            aria-describedby="url-hint"
            className="h-14 w-full rounded-xl border border-transparent bg-field pl-12 pr-24 text-base text-cream outline-none transition-colors placeholder:text-muted/70 focus:border-brand/60 focus:bg-field disabled:cursor-not-allowed disabled:opacity-70 sm:pr-28"
          />
          <div className="absolute right-2 top-2 flex items-center gap-1">
            {url ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={analyzing}
                className="inline-flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Effacer le lien"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handlePasteButton}
              disabled={analyzing}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardPaste className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Coller</span>
              <span className="sr-only sm:hidden">Coller</span>
            </button>
          </div>
        </div>

        <p
          id="url-hint"
          className="mt-2 flex items-center gap-1.5 px-2 pb-1 text-xs leading-5 text-muted"
        >
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          Liens publics uniquement. Le collage lance l’extraction automatiquement.
        </p>

        {analyzing ? (
          <div
            role="status"
            aria-live="polite"
            className="mx-2 mb-2 mt-1 rounded-xl border border-line bg-field p-3"
          >
            <div className="h-1 overflow-hidden rounded-full bg-line">
              <div className="h-full w-1/3 animate-progress rounded-full bg-brand" />
            </div>
            <p className="mt-2.5 text-xs leading-5 text-muted">
              Extraction de la vidéo ou de la photo…
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mx-2 mb-2 mt-1 flex flex-col gap-3 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm leading-6 text-danger sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex items-start gap-2">
              <AlertCircle
                className="mt-1 size-4 shrink-0"
                aria-hidden="true"
              />
              {error}
            </span>
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              className="shrink-0 self-start rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/15 sm:self-auto"
            >
              Réessayer
            </button>
          </div>
        ) : null}

        {pasteMessage ? (
          <p
            role="status"
            aria-live="polite"
            className="mx-2 mb-2 mt-1 flex items-start gap-2 rounded-xl border border-line bg-field p-3 text-xs leading-5 text-muted"
          >
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {pasteMessage}
          </p>
        ) : null}
      </form>

      {result ? (
        <div
          ref={resultRef}
          tabIndex={-1}
          className="scroll-mt-24 text-left focus:outline-none"
        >
          <MediaResult result={result} sourceUrl={analyzedUrl} />
        </div>
      ) : null}
    </div>
  );
}
