import { recommendationSchema, type RecommendationValues } from "./schema";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { errorMessage } from "../api/client";
import { buttonClass, Field, inputClass } from "../components/Shared";
import { recommendLawyers } from "./api";
import RecommendationCard from "./RecommendationCard";

const examples = [
  ["Property dispute", "I need help with a property ownership dispute."],
  [
    "Divorce / family matter",
    "I need help with divorce and a family custody matter.",
  ],
  ["Criminal case", "I need a lawyer for a criminal case."],
];
export default function RecommendationPage() {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecommendationValues>({
    resolver: zodResolver(recommendationSchema),
    defaultValues: { requirement: "", date: "", limit: "5" },
  });
  const [result, setResult] =
    useState<Awaited<ReturnType<typeof recommendLawyers>>>();
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  return (
    <>
      <header className="space-y-2">
        <h1 className="font-display text-3xl">Lawyer Recommendation Agent</h1>
        <p>
          Test the Member 1 lawyer discovery workflow using real lawyer data.
        </p>
        <p className="text-sm">
          Recommendations assist lawyer discovery and do not constitute legal
          advice.
        </p>
      </header>
      <ol
        aria-label="Recommendation flow"
        className="flex flex-wrap gap-2 text-sm text-navy-700"
      >
        {[
          "Legal requirement",
          "Recommendation agent",
          "Specialization / service matching",
          "PostgreSQL lawyers",
          "Ranked recommendations",
        ].map((step, index) => (
          <li key={step} className="rounded bg-navy-50 px-3 py-2">
            {index + 1}. {step}
          </li>
        ))}
      </ol>
      <form
        noValidate
        className="space-y-5 rounded-xl bg-white p-6"
        onSubmit={(event) => {
          void handleSubmit(async (values) => {
            if (pending.current) return;
            const controller = new AbortController();
            pending.current = controller;
            setResult(undefined);
            setError("");
            try {
              const response = await recommendLawyers(
                values,
                controller.signal,
              );
              if (!controller.signal.aborted) setResult(response);
            } catch (e) {
              if (!controller.signal.aborted) setError(errorMessage(e));
            } finally {
              pending.current = null;
            }
          })(event);
        }}
      >
        <Field
          label="Describe your legal requirement"
          error={errors.requirement?.message}
        >
          <textarea
            rows={5}
            placeholder="I have a dispute regarding ownership of my land."
            className={inputClass}
            aria-invalid={!!errors.requirement}
            {...register("requirement")}
          />
        </Field>
        <div className="flex flex-wrap gap-2" aria-label="Example requirements">
          {examples.map(([label, value]) => (
            <button
              key={label}
              type="button"
              disabled={isSubmitting}
              className="rounded border border-navy-100 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={() =>
                setValue("requirement", value, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred date (optional)" error={errors.date?.message}>
            <input type="date" className={inputClass} {...register("date")} />
          </Field>
          <Field label="Maximum results" error={errors.limit?.message}>
            <select className={inputClass} {...register("limit")}>
              {[3, 5, 10].map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button disabled={isSubmitting} className={buttonClass}>
          Find Suitable Lawyers
        </button>
        {isSubmitting && <p role="status">Analyzing your legal requirement…</p>}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
      </form>
      <section
        aria-labelledby="recommendations-heading"
        aria-live="polite"
        aria-busy={isSubmitting}
        className="space-y-4"
      >
        <h2 id="recommendations-heading" className="font-display text-2xl">
          Recommended Lawyers
        </h2>
        {!result && !isSubmitting && !error && (
          <p>
            Describe your requirement or choose an example, then select Find
            Suitable Lawyers.
          </p>
        )}
        {result?.warnings.map((warning, i) => (
          <p key={i} className="rounded bg-amber-50 p-3 text-amber-900">
            {warning}
          </p>
        ))}
        {result && result.cards.length === 0 && (
          <p>No suitable active lawyers were found for this requirement.</p>
        )}
        {result && (
          <div className="grid gap-4 lg:grid-cols-2">
            {result.cards.map((card) => (
              <RecommendationCard key={card.lawyerId} card={card} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
