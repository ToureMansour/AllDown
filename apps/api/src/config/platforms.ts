import type { PlatformDefinition } from "../types";

export const PLATFORMS: PlatformDefinition[] = [
  {
    id: "youtube",
    label: "YouTube",
    hosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"],
    status: "supported",
    note: "Analyse et téléchargement réellement vérifiés sur une vidéo publique.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    hosts: ["tiktok.com"],
    status: "experimental",
    note: "Dépend de l'accès public et des changements fréquents de la plateforme.",
  },
  {
    id: "instagram",
    label: "Instagram",
    hosts: ["instagram.com", "instagr.am"],
    status: "experimental",
    note: "Contenus publics uniquement. Les publications privées ou connectées sont refusées.",
  },
  {
    id: "facebook",
    label: "Facebook",
    hosts: ["facebook.com", "fb.watch"],
    status: "experimental",
    note: "Contenus publics uniquement. Les vidéos nécessitant une connexion sont refusées.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    hosts: ["linkedin.com", "lnkd.in"],
    status: "experimental",
    note: "Certaines publications exigent une authentification et ne peuvent pas être traitées.",
  },
  {
    id: "generic",
    label: "Autres sites compatibles",
    hosts: [],
    status: "supported",
    note: "Médias publics reconnus par l'extracteur générique de yt-dlp.",
  },
];

export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

export function hostMatches(hostname: string, domain: string): boolean {
  const host = normalizeHostname(hostname);
  const base = normalizeHostname(domain).replace(/^\*\./, "");
  return host === base || host.endsWith(`.${base}`);
}

export function detectPlatform(hostname: string): PlatformDefinition {
  const host = normalizeHostname(hostname);

  for (const platform of PLATFORMS) {
    if (platform.hosts.some((domain) => hostMatches(host, domain))) {
      return platform;
    }
  }

  return PLATFORMS[PLATFORMS.length - 1] as PlatformDefinition;
}

export function publicPlatforms(): PlatformDefinition[] {
  return PLATFORMS.map((platform) => ({ ...platform, hosts: [...platform.hosts] }));
}
