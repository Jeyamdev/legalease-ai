import { useState } from "react";
import type { HiringDraft } from "../services/workforceApi";
import { hiringDraftSchema } from "../schemas/hiringSuggestionSchema";
const input = "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500";
export function HiringSuggestionDraft({ draft, busy, canEdit, canRegenerate = true, onSave, onContinue, onRegenerate }: {
  draft: HiringDraft; busy: boolean; canEdit: boolean; canRegenerate?: boolean; onSave: (draft: HiringDraft) => Promise<boolean>;
  onContinue: () => void; onRegenerate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(draft);
  const [error, setError] = useState("");
  const save = async () => {
    const result = hiringDraftSchema.safeParse(values);
    if (!result.success) { setError(result.error.issues[0].message); return; }
    setError(""); if (await onSave(result.data)) setEditing(false);
  };
  return <section aria-labelledby="hiring-draft-heading" className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
    <div><h3 data-workflow-focus tabIndex={-1} id="hiring-draft-heading" className="font-bold text-slate-900">AI Hiring Proposal</h3><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-800">AI Generated · Review Required</p></div>
    {editing ? <div className="space-y-3">
      {([['suggestedTitle', 'Suggested Role'], ['operationalReason', 'Operational Reason'], ['summary', 'Summary']] as const).map(([field, label]) => <label key={field} className="block text-xs font-semibold text-slate-700">{label}<textarea aria-label={label} disabled={busy} rows={field === 'suggestedTitle' ? 1 : 3} value={values[field]} onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))} className={input} /></label>)}
      {([['responsibilities', 'Responsibilities'], ['focusAreas', 'Focus Areas']] as const).map(([field, label]) => <label key={field} className="block text-xs font-semibold text-slate-700">{label}<span className="ml-1 font-normal text-slate-500">(one per line)</span><textarea aria-label={label} disabled={busy} rows={3} value={values[field].join('\n')} onChange={e => setValues(v => ({ ...v, [field]: e.target.value.split('\n') }))} className={input} /></label>)}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" disabled={busy} onClick={save} className="min-h-11 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Save Changes</button>
      <button type="button" disabled={busy} onClick={() => setEditing(false)} className="ml-2 min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm">Cancel</button>
    </div> : <>
      <div className="border-b border-slate-200 pb-5"><h4 className="text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">{draft.suggestedTitle}</h4></div>
      <dl className="space-y-5 text-sm">{[['Hiring Rationale', draft.operationalReason], ['Role Summary', draft.summary]].map(([label, value]) => <div key={label}><dt className="font-bold text-slate-900">{label}</dt><dd className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-600">{value}</dd></div>)}</dl>
      <div className="grid gap-5 sm:grid-cols-2">{[['Key Responsibilities', draft.responsibilities], ['Practice Focus', draft.focusAreas]].map(([label, list]) => <div key={label as string}><h4 className="text-sm font-bold text-slate-900">{label}</h4><ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600">{(list as string[]).map((text, i) => <li key={i}>{text}</li>)}</ul></div>)}</div>
      {canEdit && <div className="flex flex-wrap gap-2 pt-2">{[...(canRegenerate ? [['Regenerate', onRegenerate]] : []), ['Edit Draft', () => { setValues(draft); setEditing(true); }], ['Continue to Approval', onContinue]].map(([label, action]) => <button key={label as string} type="button" disabled={busy} onClick={action as () => void} className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:opacity-50">{label as string}</button>)}</div>}
    </>}
  </section>;
}
