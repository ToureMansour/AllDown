import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createDownload: vi.fn(),
  };
});

import { ApiError, createDownload } from "@/lib/api";
import { MediaResult } from "@/components/media-result";
import { analysis } from "./fixtures";

const createDownloadMock = vi.mocked(createDownload);
const sourceUrl = "https://www.youtube.com/watch?v=abc123";

describe("MediaResult", () => {
  beforeEach(() => {
    createDownloadMock.mockReset();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("renders metadata and the three download choices", () => {
    render(<MediaResult result={analysis} sourceUrl={sourceUrl} />);

    expect(
      screen.getByRole("heading", { name: "Big Buck Bunny" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Blender Foundation")).toBeInTheDocument();
    expect(screen.getByText("9:56")).toBeInTheDocument();
    expect(screen.getByText("Fichier d'origine")).toBeInTheDocument();
    expect(screen.getByText("Meilleure qualité")).toBeInTheDocument();
    expect(screen.getByText("Audio seul")).toBeInTheDocument();
    expect(screen.queryByText(/filigrane|Limite :/i)).not.toBeInTheDocument();
  });

  it("downloads the exact source file by default", async () => {
    const user = userEvent.setup();
    createDownloadMock.mockResolvedValueOnce({
      downloadUrl: "/api/v1/media/file/token",
      fileName: "Big Buck Bunny.mp4",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      expiresInSeconds: 300,
      format: analysis.formats[1]!,
    });

    render(<MediaResult result={analysis} sourceUrl={sourceUrl} />);

    await user.click(
      screen.getByRole("button", {
        name: /Télécharger Fichier d'origine/,
      }),
    );

    expect(createDownloadMock).toHaveBeenCalledWith(sourceUrl, "18");
    expect(
      await screen.findByText(/Le téléchargement de « 360p » a été lancé/),
    ).toBeInTheDocument();
  });

  it("downloads the highest quality when requested", async () => {
    const user = userEvent.setup();
    createDownloadMock.mockResolvedValueOnce({
      downloadUrl: "/api/v1/media/file/token",
      fileName: "Big Buck Bunny.mp4",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      expiresInSeconds: 300,
      format: analysis.formats[0]!,
    });

    render(<MediaResult result={analysis} sourceUrl={sourceUrl} />);

    await user.click(
      screen.getByRole("button", {
        name: /Télécharger Meilleure qualité/,
      }),
    );

    expect(createDownloadMock).toHaveBeenCalledWith(sourceUrl, "137+140");
    expect(
      await screen.findByText(/Le téléchargement de « 1080p » a été lancé/),
    ).toBeInTheDocument();
  });

  it("shows an error when the download cannot be started", async () => {
    const user = userEvent.setup();
    createDownloadMock.mockRejectedValueOnce(
      new ApiError(
        "DOWNLOAD_BUSY",
        "Trop de téléchargements sont en cours.",
        503,
      ),
    );

    render(<MediaResult result={analysis} sourceUrl={sourceUrl} />);

    await user.click(
      screen.getByRole("button", {
        name: /Télécharger Meilleure qualité/,
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Trop de téléchargements/,
    );
  });
});
