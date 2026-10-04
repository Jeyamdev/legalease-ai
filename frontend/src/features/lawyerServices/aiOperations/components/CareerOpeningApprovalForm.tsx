import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { HiringDraft } from "../services/workforceApi";
import { careerApprovalSchema } from "../schemas/hiringSuggestionSchema";
export function CareerOpeningApprovalForm({ draft, busy, blocked = false, unmapped, practiceArea, onBack, onApprove }: {
  draft: HiringDraft; busy: boolean; blocked?: boolean; unmapped: number; practiceArea: string; onBack: () => void; onApprove: (title: string, description: string, reviewed: boolean) => void;
}) {
  const [title, setTitle] = useState(draft.suggestedTitle);
  const [description, setDescription] = useState(`${draft.summary}\n\nResponsibilities\n${draft.responsibilities.map(x => `• ${x}`).join('\n')}\n\nFocus Areas\n${draft.focusAreas.join('\n')}`);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = careerApprovalSchema.safeParse({ jobTitle: title, description });
    if (!result.success) { setError(result.error.issues[0].message); return; }
    if (unmapped > 0 && !reviewed) { setError("Review existing unlinked Careers openings before approval."); return; }
    setError(""); onApprove(result.data.jobTitle, result.data.description, reviewed);
  };
  return <form noValidate onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
    <h3 data-workflow-focus tabIndex={-1} className="font-bold text-slate-900">Final Review · Career Opening</h3>
    <p className="text-xs leading-relaxed text-slate-600">Confirm the final title and description required by the existing Careers module. Employment conditions are owned by the Admin; Gemini was not given salary, location or qualification requirements.</p>
    <dl className="grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">Practice Area</dt><dd className="mt-1 font-semibold text-slate-900">{practiceArea}</dd></div><div><dt className="text-slate-500">Source</dt><dd className="mt-1 font-semibold text-slate-900">AI Workforce Recommendation</dd></div></dl>
    <label className="block text-xs font-semibold text-slate-700">Career Title<input required maxLength={200} disabled={busy} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-amber-500" /></label>
    <label className="block text-xs font-semibold text-slate-700">Career Description<textarea required maxLength={12000} rows={7} disabled={busy} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-amber-500" /></label>
    {unmapped > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p>{unmapped} existing opening(s) have no Practice Area link. <Link to="/admin/careers" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Review Careers</Link></p><label className="mt-2 flex items-start gap-2"><input type="checkbox" disabled={busy} checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I reviewed existing Careers openings, including unlinked postings.</label></div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={busy || blocked} className="min-h-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50">{busy ? "Creating Career Opening..." : "Approve & Create Career Opening"}</button>
    <button type="button" disabled={busy} onClick={onBack} className="min-h-11 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:opacity-50">Back to Proposal</button>
  </form>;
}
