import { promises as dns } from "node:dns";
import net from "node:net";

import { AppError } from "../utils/errors";

export interface LookupAddress {
  address: string;
  family: number;
}

export type LookupFn = (hostname: string) => Promise<LookupAddress[]>;

export interface UrlSafetyOptions {
  allowedHosts?: string[];
  lookup?: LookupFn;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
  "metadata.azure.internal",
  "metadata.azure.com",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".intranet",
  ".lan",
  ".home.arpa",
  ".test",
  ".invalid",
  ".example",
];

function ipv4IsBlocked(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a = 0, b = 0, c = 0] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;

  return false;
}

function ipv6IsBlocked(rawAddress: string): boolean {
  const address = rawAddress.toLowerCase().split("%")[0] ?? rawAddress;

  if (address === "::" || address === "::1") return true;
  if (address.startsWith("::ffff:")) {
    const mapped = address.slice("::ffff:".length);
    if (net.isIPv4(mapped)) return ipv4IsBlocked(mapped);
    return true;
  }
  if (address.startsWith("::")) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(address)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(address)) return true;
  if (/^ff[0-9a-f]{2}:/.test(address)) return true;
  if (address.startsWith("2001:db8")) return true;
  if (address.startsWith("64:ff9b")) return true;
  if (address.startsWith("2002:")) return true;
  if (address.startsWith("2001:0:")) return true;

  return false;
}

export function isPublicIp(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return !ipv4IsBlocked(address);
  if (family === 6) return !ipv6IsBlocked(address);
  return false;
}

export function hostAllowed(hostname: string, allowedHosts: string[]): boolean {
  if (allowedHosts.length === 0) return true;

  const host = hostname.toLowerCase().replace(/\.$/, "");
  return allowedHosts.some((entry) => {
    const domain = entry.toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
    return host === domain || host.endsWith(`.${domain}`);
  });
}

function assertIpPublic(address: string, hostname: string): void {
  if (!isPublicIp(address)) {
    throw new AppError(
      403,
      "FORBIDDEN_URL",
      `L'adresse réseau de « ${hostname} » est privée, locale ou réservée.`,
    );
  }
}

export class UrlSafety {
  private readonly allowedHosts: string[];
  private readonly lookup: LookupFn;

  constructor(options: UrlSafetyOptions = {}) {
    this.allowedHosts = options.allowedHosts ?? [];
    this.lookup =
      options.lookup ??
      ((hostname) =>
        dns.lookup(hostname, { all: true, verbatim: true }) as Promise<
          LookupAddress[]
        >);
  }

  async validate(rawUrl: string): Promise<URL> {
    if (!rawUrl || rawUrl.length > 2048) {
      throw new AppError(400, "INVALID_URL", "L'URL est vide ou trop longue.");
    }

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new AppError(400, "INVALID_URL", "L'URL fournie n'est pas valide.");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new AppError(
        400,
        "UNSUPPORTED_PROTOCOL",
        "Seuls les liens HTTP et HTTPS sont acceptés.",
      );
    }

    if (url.username || url.password) {
      throw new AppError(
        400,
        "FORBIDDEN_URL",
        "Les URL contenant des identifiants intégrés ne sont pas acceptées.",
      );
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");

    if (!hostname) {
      throw new AppError(400, "INVALID_URL", "L'URL ne contient pas de domaine.");
    }

    if (net.isIP(hostname)) {
      throw new AppError(
        403,
        "DOMAIN_NOT_ALLOWED",
        "Les adresses IP brutes ne sont pas acceptées. Utilisez le lien public du site.",
      );
    }

    if (
      BLOCKED_HOSTNAMES.has(hostname) ||
      BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) {
      throw new AppError(
        403,
        "DOMAIN_NOT_ALLOWED",
        "Ce domaine local ou réservé n'est pas autorisé.",
      );
    }

    if (!hostAllowed(hostname, this.allowedHosts)) {
      throw new AppError(
        403,
        "DOMAIN_NOT_ALLOWED",
        "Ce domaine ne figure pas dans la liste des domaines autorisés.",
      );
    }

    const expectedPort = url.protocol === "https:" ? "443" : "80";
    if (url.port && url.port !== expectedPort) {
      throw new AppError(
        403,
        "FORBIDDEN_URL",
        "Les ports non standards ne sont pas autorisés.",
      );
    }

    let addresses: LookupAddress[];
    try {
      addresses = await this.lookup(hostname);
    } catch {
      throw new AppError(
        422,
        "UNRESOLVABLE_HOST",
        "Le domaine du lien est introuvable. Vérifiez l'adresse.",
      );
    }

    if (!addresses.length) {
      throw new AppError(
        422,
        "UNRESOLVABLE_HOST",
        "Le domaine du lien est introuvable. Vérifiez l'adresse.",
      );
    }

    for (const entry of addresses) {
      assertIpPublic(entry.address, hostname);
    }

    return url;
  }

  async validateAdditionalUrl(rawUrl: string, original: URL): Promise<void> {
    let candidate: URL;
    try {
      candidate = new URL(rawUrl);
    } catch {
      return;
    }

    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
      return;
    }

    if (candidate.hostname.toLowerCase() === original.hostname.toLowerCase()) {
      return;
    }

    await this.validate(candidate.href);
  }
}
