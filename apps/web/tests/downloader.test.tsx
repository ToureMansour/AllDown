import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    analyzeMedia: vi.fn(),
    createDownload: vi.fn(),
  };
});

import { analyzeMedia, ApiError } from "@/lib/api";
import { Downloader } from "@/components/downloader";
import { analysis } from "./fixtures";

const analyzeMock = vi.mocked(analyzeMedia);
const validUrl = "https://www.youtube.com/watch?v=abc123";

describe("Downloader", () => {
  beforeEach(() => {
    analyzeMock.mockReset();
  });

  it("validates the URL on Enter", async () => {
    const user = userEvent.setup();
    render(<Downloader />);

    await user.type(screen.getByLabelText(/Lien de la vidéo/), "{Enter}");

    expect(
      screen.getByText(/Collez le lien d'un média pour commencer/),
    ).toBeInTheDocument();
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it("starts extraction as soon as a URL is pasted", async () => {
    const user = userEvent.setup();
    analyzeMock.mockResolvedValueOnce(analysis);

    render(<Downloader />);

    const input = screen.getByLabelText(/Lien de la vidéo/);
    await user.click(input);
    await user.paste(validUrl);

    expect(
      await screen.findByRole("heading", { name: "Big Buck Bunny" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1080p/)).toBeInTheDocument();
    expect(analyzeMock).toHaveBeenCalledWith(
      validUrl,
      expect.any(AbortSignal),
    );
  });

  it("analyzes a typed URL on Enter", async () => {
    const user = userEvent.setup();
    analyzeMock.mockResolvedValueOnce(analysis);

    render(<Downloader />);

    await user.type(
      screen.getByLabelText(/Lien de la vidéo/),
      `${validUrl}{Enter}`,
    );

    expect(
      await screen.findByRole("heading", { name: "Big Buck Bunny" }),
    ).toBeInTheDocument();
  });

  it("shows the API error and allows a retry", async () => {
    const user = userEvent.setup();
    analyzeMock.mockRejectedValueOnce(
      new ApiError(
        "MEDIA_RESTRICTED",
        "Ce média est privé ou nécessite une connexion.",
        403,
      ),
    );

    render(<Downloader />);

    await user.type(
      screen.getByLabelText(/Lien de la vidéo/),
      `${validUrl}{Enter}`,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Ce média est privé/);
    expect(
      screen.getByRole("button", { name: /Réessayer/ }),
    ).toBeInTheDocument();
  });

  it("disables the input while extracting", async () => {
    const user = userEvent.setup();
    let resolveAnalysis: (value: typeof analysis) => void = () => undefined;
    analyzeMock.mockReturnValueOnce(
      new Promise<typeof analysis>((resolve) => {
        resolveAnalysis = resolve;
      }),
    );

    render(<Downloader />);
    const input = screen.getByLabelText(/Lien de la vidéo/);
    await user.type(input, `${validUrl}{Enter}`);

    expect(screen.getByText(/Extraction de la vidéo/)).toBeInTheDocument();
    expect(input).toBeDisabled();

    await act(async () => {
      resolveAnalysis(analysis);
    });

    expect(
      await screen.findByRole("heading", { name: "Big Buck Bunny" }),
    ).toBeInTheDocument();
  });
});
