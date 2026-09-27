import { z } from "zod";

export const recommendationSchema = z.object({
  requirement: z
    .string()
    .trim()
    .min(3, "Describe your requirement in at least 3 characters.")
    .max(4000, "Use no more than 4,000 characters."),
  date: z.union([z.literal(""), z.iso.date()]),
  limit: z.enum(["3", "5", "10"]),
});
export type RecommendationValues = z.infer<typeof recommendationSchema>;
