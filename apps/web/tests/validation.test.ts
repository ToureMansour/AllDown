import { describe, expect, it } from "vitest";

import { validateMediaUrl } from "@/lib/validation";

describe("validateMediaUrl", () => {
  it("rejects an empty value", () => {
    expect(validateMediaUrl("   ")).toMatch(/Collez le lien/);
  });

  it("rejects values that are too long", () => {
    expect(validateMediaUrl(`https://youtube.com/${"a".repeat(2048)}`)).toMatch(
      /trop long/,
    );
  });

  it("rejects values containing whitespace", () => {
    expect(
      validateMediaUrl("https://youtube.com/watch?v=abc 123"),
    ).toMatch(/espace/);
  });

  it("rejects malformed URLs", () => {
    expect(validateMediaUrl("youtube.com/watch")).toMatch(/pas valide/);
  });

  it("rejects non-HTTP protocols", () => {
    expect(validateMediaUrl("file:///etc/passwd")).toMatch(/HTTP et HTTPS/);
    expect(validateMediaUrl("javascript:alert(1)")).toMatch(/HTTP et HTTPS/);
  });

  it("rejects embedded credentials", () => {
    expect(
      validateMediaUrl("https://user:pass@youtube.com/watch?v=abc"),
    ).toMatch(/identifiants/);
  });

  it("accepts public HTTP and HTTPS URLs", () => {
    expect(validateMediaUrl("https://www.youtube.com/watch?v=abc")).toBeNull();
    expect(validateMediaUrl("http://example.org/video.mp4")).toBeNull();
  });
});
