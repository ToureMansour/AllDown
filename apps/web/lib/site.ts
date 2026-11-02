function resolveSiteUrl(value: string | undefined): string {
  const candidate = value?.trim();
  if (candidate) {
    try {
      return new URL(candidate).origin;
    } catch {
      // Fall through to the next candidate.
    }
  }

  return "http://localhost:3000";
}

const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined;

export const SITE_URL = resolveSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ?? vercelUrl,
);

export const SITE_NAME = "AllDown";
export const SITE_TITLE =
  "AllDown — Téléchargez vos médias depuis un simple lien";
export const SITE_DESCRIPTION =
  "Collez le lien d'une vidéo ou d'une photo et récupérez le fichier fourni par la source. Simple, rapide et sans inscription.";
export const SITE_KEYWORDS = [
  "télécharger une vidéo",
  "télécharger une vidéo TikTok",
  "téléchargeur vidéo",
  "télécharger une photo",
  "YouTube",
  "TikTok",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "AllDown",
];
