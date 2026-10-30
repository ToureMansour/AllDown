import { describe, expect, it, vi } from "vitest";

import { UrlSafety, hostAllowed, isPublicIp } from "../src/services/urlSafety";

const publicLookup = vi.fn(async () => [
  { address: "93.184.216.34", family: 4 },
]);

function safety(options: Partial<ConstructorParameters<typeof UrlSafety>[0]> = {}) {
  return new UrlSafety({ lookup: publicLookup, ...options });
}

describe("isPublicIp", () => {
  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34",
    "2606:4700:4700::1111",
  ])("accepts public address %s", (address) => {
    expect(isPublicIp(address)).toBe(true);
  });

  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "198.18.0.1",
    "224.0.0.1",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
    "not-an-ip",
  ])("rejects reserved address %s", (address) => {
    expect(isPublicIp(address)).toBe(false);
  });
});

describe("hostAllowed", () => {
  it("allows every host when no allowlist is configured", () => {
    expect(hostAllowed("anything.example.org", [])).toBe(true);
  });

  it("matches exact domains and subdomains", () => {
    expect(hostAllowed("youtube.com", ["youtube.com"])).toBe(true);
    expect(hostAllowed("www.youtube.com", ["youtube.com"])).toBe(true);
    expect(hostAllowed("youtube.com.evil.org", ["youtube.com"])).toBe(false);
  });

  it("supports wildcard entries", () => {
    expect(hostAllowed("cdn.example.org", ["*.example.org"])).toBe(true);
  });
});

describe("UrlSafety.validate", () => {
  it("accepts a public HTTPS URL", async () => {
    const url = await safety().validate("https://www.youtube.com/watch?v=abc");
    expect(url.hostname).toBe("www.youtube.com");
  });

  it("rejects unsupported protocols", async () => {
    await expect(
      safety().validate("ftp://youtube.com/video"),
    ).rejects.toMatchObject({ status: 400, code: "UNSUPPORTED_PROTOCOL" });
  });

  it("rejects embedded credentials", async () => {
    await expect(
      safety().validate("https://user:secret@youtube.com/watch?v=abc"),
    ).rejects.toMatchObject({ status: 400, code: "FORBIDDEN_URL" });
  });

  it("rejects raw IP addresses", async () => {
    await expect(
      safety().validate("https://127.0.0.1/video"),
    ).rejects.toMatchObject({ status: 403, code: "DOMAIN_NOT_ALLOWED" });
  });

  it("rejects local and metadata hostnames", async () => {
    await expect(
      safety().validate("http://localhost:4000/private"),
    ).rejects.toMatchObject({ status: 403, code: "DOMAIN_NOT_ALLOWED" });

    await expect(
      safety().validate("http://metadata.google.internal/computeMetadata"),
    ).rejects.toMatchObject({ status: 403, code: "DOMAIN_NOT_ALLOWED" });
  });

  it("rejects non-standard ports", async () => {
    await expect(
      safety().validate("https://youtube.com:8443/watch?v=abc"),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN_URL" });
  });

  it("rejects a hostname resolving to a private address", async () => {
    const lookup = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.8", family: 4 },
    ]);

    await expect(
      new UrlSafety({ lookup }).validate("https://youtube.com/watch?v=abc"),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN_URL" });
  });

  it("rejects unresolvable hostnames", async () => {
    const lookup = vi.fn(async () => {
      throw new Error("ENOTFOUND");
    });

    await expect(
      new UrlSafety({ lookup }).validate("https://missing.example.org/video"),
    ).rejects.toMatchObject({ status: 422, code: "UNRESOLVABLE_HOST" });
  });

  it("enforces the optional domain allowlist", async () => {
    const allowed = safety({ allowedHosts: ["youtube.com"] });

    await expect(
      allowed.validate("https://youtu.be/abc"),
    ).rejects.toMatchObject({ status: 403, code: "DOMAIN_NOT_ALLOWED" });

    await expect(
      allowed.validate("https://www.youtube.com/watch?v=abc"),
    ).resolves.toBeInstanceOf(URL);
  });

  it("skips resolution for same-host redirect candidates only", async () => {
    const lookup = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 },
    ]);
    const instance = new UrlSafety({ lookup });
    const original = new URL("https://youtube.com/watch?v=abc");

    await instance.validateAdditionalUrl("https://youtube.com/other", original);
    expect(lookup).not.toHaveBeenCalled();

    await instance.validateAdditionalUrl("https://cdn.example.org/file", original);
    expect(lookup).toHaveBeenCalledWith("cdn.example.org");
  });
});
