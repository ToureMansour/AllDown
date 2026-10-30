export function validateMediaUrl(rawValue: string): string | null {
  const value = rawValue.trim();

  if (!value) {
    return "Collez le lien d'un média pour commencer.";
  }

  if (value.length > 2048) {
    return "Ce lien est trop long pour être analysé.";
  }

  if (/\s/.test(value)) {
    return "Le lien ne doit pas contenir d'espace.";
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "Ce lien n'est pas valide. Utilisez une URL complète commençant par https://.";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Seuls les liens HTTP et HTTPS sont acceptés.";
  }

  if (!parsed.hostname) {
    return "Ce lien ne contient pas de domaine valide.";
  }

  if (parsed.username || parsed.password) {
    return "Les liens contenant des identifiants intégrés ne sont pas acceptés.";
  }

  return null;
}
