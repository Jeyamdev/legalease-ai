import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { apiClient } from "../../api/apiClient";
import type { Lawyer } from "../../api/lawyersApi";

type Result = { recommendations: { lawyerId: string; score: number; reason: string }[]; warnings: string[] };
export function LawyerRecommendations({ lawyers }: { lawyers: Lawyer[] }) {
  const [requirement, setRequirement] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result>();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  return (
    <section id="lawyer-recommendations" aria-labelledby="recommendation-title" className="mb-6 rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
      <h2 id="recommendation-title" className="text-lg font-bold text-slate-900">AI Lawyer Recommendation</h2>
      <p className="mt-1 text-sm text-slate-500">Describe the requirement to find matching active lawyers. Results use recorded specializations, services and experience.</p>
      <form className="mt-4 space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        if (pending.current) return;
        if (requirement.trim().length < 3) { setError("Please describe your requirement using at least three characters."); return; }
        const controller = new AbortController(); pending.current = controller;
        setBusy(true); setError(""); setResult(undefined);
        try {
          const response = await apiClient.post<Result>("/api/lawyer-recommendations", { requirement: requirement.trim(), date: date || null, limit: 5 }, { signal: controller.signal, timeout: 60000 });
          if (!controller.signal.aborted) setResult(response.data);
        } catch (e) {
          if (!controller.signal.aborted) setError(axios.isAxiosError(e) ? e.response?.data?.title || e.response?.data?.message || "Recommendations are unavailable. Please try again." : "Unable to load recommendations.");
        } finally {
          pending.current = null;
          if (!controller.signal.aborted) setBusy(false);
        }
      }}>
        <label className="block text-sm font-medium text-slate-700">Legal requirement
          <textarea required minLength={3} maxLength={4000} rows={3} value={requirement} onChange={e => setRequirement(e.target.value)} placeholder="I need help with a property ownership dispute." className="mt-1 block w-full rounded-lg border border-slate-300 p-3" />
        </label>
        <label className="block text-sm font-medium text-slate-700">Preferred date (optional)
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="ml-3 rounded-lg border border-slate-300 p-2" />
        </label>
        <button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Finding lawyers…" : "Find Suitable Lawyers"}</button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </form>
      <div aria-live="polite" aria-busy={busy} className="mt-4 space-y-3">
        {result?.warnings.map((warning, i) => <p key={i} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}
        {result && !result.recommendations.length && <p>No suitable active lawyers were found.</p>}
        {result?.recommendations.map(item => {
          const lawyer = lawyers.find(l => l.lawyerId === item.lawyerId);
          return <article key={item.lawyerId} className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">{lawyer?.name || "Lawyer profile updated — refresh the directory"}</h3>
            <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
            <p className="mt-2 text-xs text-slate-500">Match score: {item.score} (ranking points, not a probability)</p>
            {lawyer && <p className="mt-2 text-sm">{lawyer.email} · {lawyer.phoneNumber}</p>}
          </article>;
        })}
      </div>
    </section>
  );
}
