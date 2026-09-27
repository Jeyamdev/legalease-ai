import { Link } from "react-router-dom";
import type { RecommendationCardData } from "./api";
export default function RecommendationCard({
  card,
}: {
  card: RecommendationCardData;
}) {
  const { lawyer, score, reason } = card;
  return (
    <article className="space-y-3 rounded-xl border border-navy-100 bg-white p-6 break-words">
      <h3 className="font-display text-xl">{lawyer.name}</h3>
      <p>
        {lawyer.experience} years experience · {lawyer.status}
      </p>
      {lawyer.specializations.length > 0 && (
        <p>
          <strong>Specializations: </strong>
          {lawyer.specializations.map((s) => s.name).join(", ")}
        </p>
      )}
      {lawyer.legalServices.length > 0 && (
        <div>
          <strong>Legal services</strong>
          <ul className="list-disc pl-5">
            {lawyer.legalServices.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        </div>
      )}
      <p>
        <strong>Recommendation score: </strong>
        {score}
      </p>
      <div>
        <h4 className="font-semibold">Why this lawyer?</h4>
        <p className="whitespace-pre-wrap">{reason}</p>
      </div>
      <Link
        className="inline-block underline focus-visible:outline-2 focus-visible:outline-offset-4"
        to={`/admin/lawyer-management/${lawyer.lawyerId}`}
      >
        View Lawyer<span className="sr-only">: {lawyer.name}</span>
      </Link>
    </article>
  );
}
