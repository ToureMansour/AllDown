import { describe, expect, it } from "vitest";

import { DownloadTicketService } from "../src/services/downloadTicket";

const secret = "a-test-secret-that-is-at-least-32-characters";
const payload = {
  url: "https://www.youtube.com/watch?v=abc123",
  formatId: "137+140",
  fileName: "sample.mp4",
};

describe("DownloadTicketService", () => {
  it("signs and verifies a payload", () => {
    const tickets = new DownloadTicketService(secret);
    const { token, expiresAt } = tickets.sign(payload, 300);

    expect(tickets.verify(token)).toEqual({
      ...payload,
      expiresAt,
    });
  });

  it("rejects a tampered body", () => {
    const tickets = new DownloadTicketService(secret);
    const { token } = tickets.sign(payload);
    const [body, signature] = token.split(".");
    const tampered = `${body?.slice(0, -1)}${body?.endsWith("A") ? "B" : "A"}.${signature}`;

    expect(() => tickets.verify(tampered)).toThrow(
      expect.objectContaining({ status: 401, code: "INVALID_TOKEN" }),
    );
  });

  it("rejects a token signed with another secret", () => {
    const issuer = new DownloadTicketService(secret);
    const verifier = new DownloadTicketService(
      "another-secret-that-is-at-least-32-characters",
    );
    const { token } = issuer.sign(payload);

    expect(() => verifier.verify(token)).toThrow(
      expect.objectContaining({ status: 401, code: "INVALID_TOKEN" }),
    );
  });

  it("rejects expired tokens", () => {
    const tickets = new DownloadTicketService(secret);
    const { token } = tickets.sign(payload, -1);

    expect(() => tickets.verify(token)).toThrow(
      expect.objectContaining({ status: 410, code: "DOWNLOAD_EXPIRED" }),
    );
  });

  it.each(["", "invalid", "body.signature", "a.b.c"])(
    "rejects malformed token %j",
    (token) => {
      const tickets = new DownloadTicketService(secret);
      expect(() => tickets.verify(token)).toThrow(
        expect.objectContaining({ status: 401, code: "INVALID_TOKEN" }),
      );
    },
  );
});
