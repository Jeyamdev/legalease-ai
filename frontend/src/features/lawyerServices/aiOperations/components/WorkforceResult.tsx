import { Link } from "react-router-dom";
import type { WorkforceArea, WorkforceReport } from "../services/workforceApi";
import { WorkforceStatus } from "./WorkforceAnalysisList";
import { reasonText } from "../workforceLabels";
export function WorkforceResult({ report, selected, onSelect, onPrepare, busy }: {
  report: WorkforceReport; selected?: number; onSelect: (id: number) => void; onPrepare: (id: number) => void; busy: boolean;
}) {
  const concerns = report.practiceAreas.filter(area => area.status !== "HEALTHY");
  const area = concerns.find(item => item.practiceAreaId === selected) ?? concerns[0];
  const recruiting = report.practiceAreas.filter(item => item.openCareerOpeningCount > 0);
  const healthy = report.practiceAreas.length > 0 && concerns.length === 0;
  return <section aria-label="Workforce analysis result" className="space-y-5 py-2">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">System assessment</p><h3 data-workflow-focus tabIndex={-1} className="mt-2 text-xl font-bold text-slate-900">{healthy ? recruiting.length ? 'Workforce Coverage Stable' : 'Workforce Coverage Healthy' : area ? `${concerns.length} ${concerns.length === 1 ? 'area requires' : 'areas require'} review` : 'No Practice Areas'}</h3>
      <p className="mt-2 text-sm text-slate-600">{healthy ? recruiting.length ? `No new staffing concerns were detected. Existing recruitment is active for ${recruiting.map(item => item.practiceAreaName).join(', ')}.` : 'No staffing concerns were detected under the current workforce rules.' : area ? 'Review the coverage findings before deciding whether to prepare a hiring proposal.' : 'Configure a Practice Area before analysing workforce capacity.'}</p>
    </div>
    {healthy && <dl className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 min-[360px]:grid-cols-3">{[['Practice Areas Analysed', report.practiceAreas.length], ['Active Lawyers', report.practiceAreas.reduce((sum, item) => sum + item.activeLawyerCount, 0)], ['Upcoming Slots', report.practiceAreas.reduce((sum, item) => sum + item.futureAvailableSlotCount, 0)]].map(([label, count]) => <div key={label}><dd className="text-3xl font-semibold tabular-nums text-slate-900">{count}</dd><dt className="mt-1 text-xs text-slate-500">{label}</dt></div>)}</dl>}
    {healthy && recruiting.length > 0 && <CurrentRecruitment areas={recruiting} />}
    {concerns.length > 1 && <div className="flex flex-wrap gap-2" role="group" aria-label="Areas requiring review">{concerns.map(item => <button type="button" key={item.practiceAreaId} aria-pressed={item.practiceAreaId === area?.practiceAreaId} onClick={() => onSelect(item.practiceAreaId)} className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-amber-600 ${item.practiceAreaId === area?.practiceAreaId ? 'border-amber-500 bg-amber-50 text-slate-900' : 'border-slate-300 text-slate-600'}`}>{item.practiceAreaName}</button>)}</div>}
    {area && <ConcernDetail area={area} busy={busy} onPrepare={onPrepare} />}

  </section>;
}
export function ConcernDetail({ area, busy, onPrepare }: { area: WorkforceArea; busy: boolean; onPrepare: (id: number) => void }) {
  return <div className="space-y-4 border-l-2 border-amber-500 pl-4">
    <div className="flex flex-wrap items-center gap-3"><h4 className="text-lg font-bold text-slate-900">{area.practiceAreaName}</h4><WorkforceStatus status={area.status} /></div>
    <dl className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-3">{[['Recent Demand', Math.max(area.recentDemandCount, area.recentAppointmentCount)], ['Upcoming Slots', area.futureAvailableSlotCount], ['Active Lawyers', area.activeLawyerCount]].map(([label, count]) => <div key={label}><dd className="text-2xl font-semibold text-slate-900">{count}</dd><dt className="mt-1 text-xs text-slate-500">{label}</dt></div>)}</dl>
    <p className="text-sm leading-relaxed text-slate-600">{area.reasons.filter(code => code !== 'RECRUITMENT_ALREADY_ACTIVE').map(code => reasonText[code] ?? 'Review recorded coverage.').join(' ')}</p>
    {area.openCareerOpeningCount > 0 ? <CurrentRecruitment areas={[area]} />
    : area.status !== 'HEALTHY' && <button type="button" disabled={busy} onClick={() => onPrepare(area.practiceAreaId)} className="min-h-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50">Prepare Hiring Proposal</button>}
  </div>;
}

function CurrentRecruitment({ areas }: { areas: WorkforceArea[] }) {
  return <section aria-label="Current recruitment" className="border-t border-slate-200 pt-4"><h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current Recruitment</h4>{areas.map(area => <div key={area.practiceAreaId} className="mt-3"><p className="text-sm font-semibold text-slate-900">{area.practiceAreaName}</p>{area.openings.map(opening => <p key={opening.careerId} className="mt-1 text-sm text-slate-600">{opening.jobTitle} · Opening #{opening.careerId}</p>)}<p className="mt-1 text-xs text-slate-500">Recruitment is already in progress for this Practice Area.</p></div>)}<Link to="/admin/careers" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 underline focus-visible:outline-2 focus-visible:outline-amber-600">View Career Opening →</Link></section>;
}
