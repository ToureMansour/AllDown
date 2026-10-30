import { z } from "zod";

export const analyzeSchema = z
  .object({
    url: z
      .string({ error: "Le lien est obligatoire." })
      .trim()
      .min(1, "Le lien est obligatoire.")
      .max(2048, "Le lien est trop long."),
  })
  .strict();

export const downloadSchema = z
  .object({
    url: z
      .string({ error: "Le lien est obligatoire." })
      .trim()
      .min(1, "Le lien est obligatoire.")
      .max(2048, "Le lien est trop long."),
    formatId: z
      .string({ error: "Le format est obligatoire." })
      .trim()
      .min(1, "Le format est obligatoire.")
      .max(120, "L'identifiant de format est trop long.")
      .regex(
        /^[A-Za-z0-9_.+-]+$/,
        "L'identifiant de format contient des caractères interdits.",
      ),
  })
  .strict();

export type AnalyzeInput = z.infer<typeof analyzeSchema>;
export type DownloadInput = z.infer<typeof downloadSchema>;
