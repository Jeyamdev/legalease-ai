import type { RecommendationValues } from "./schema";
import { api } from "../api/client";
import { lawyersApi } from "../api/lawyers";
import type { Lawyer } from "../types";

export type Recommendation = {
  lawyerId: string;
  score: number;
  reason: string;
};
export type RecommendationResponse = {
  recommendations: Recommendation[];
  warnings: string[];
  trace: unknown[];
};
export type RecommendationCardData = Recommendation & { lawyer: Lawyer };

export async function recommendLawyers(
  values: RecommendationValues,
  signal: AbortSignal,
) {
  const { data } = await api.post<RecommendationResponse>(
    "/lawyer-recommendations",
    {
      requirement: values.requirement,
      ...(values.date ? { date: values.date } : {}),
      limit: Number(values.limit),
    },
    { signal, timeout: 60000 },
  );
  // The existing recommendation contract returns IDs only; there is no batch detail endpoint.
  const cards = await Promise.all(
    data.recommendations.map(async (recommendation) => ({
      ...recommendation,
      lawyer: await lawyersApi.get(recommendation.lawyerId, signal),
    })),
  );
  const active = cards.filter((card) => card.lawyer.status === "Active");
  return {
    cards: active,
    warnings: [
      ...data.warnings,
      ...(active.length !== cards.length
        ? [
            "Some lawyer profiles changed status. Run the search again for fresh recommendations.",
          ]
        : []),
    ],
  };
}
