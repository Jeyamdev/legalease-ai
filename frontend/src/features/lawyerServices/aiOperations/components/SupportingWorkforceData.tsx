import { useState } from "react";
import { Link } from "react-router-dom";
import type { WorkforceArea, WorkforceReport } from "../services/workforceApi";
import { WorkforceStatus } from "./WorkforceAnalysisList";
import { reasonText } from "../workforceLabels";
function AnalysisEvidenceRow({ area }: { area: WorkforceArea }) {
  const attention = area.status !== 'HEALTHY';
  const recruitment = area.openCareerOpeningCount > 0;
  const [expanded, setExpanded] = useState(attention || recruitment);
  const id = `workforce-evidence-${area.practiceAreaId}`;
  return <li className={`border-b border-slate-200 py-1 ${attention ? 'border-l-2 border-l-amber-500 pl-3' : ''}`}>
    <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)} className="flex min-h-16 w-full items-start justify-between gap-3 rounded-sm py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
      <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{area.practiceAreaName}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{area.activeLawyerCount} {area.activeLawyerCount === 1 ? 'lawyer' : 'lawyers'} · {area.recentDemandCount} {area.recentDemandCount === 1 ? 'request' : 'requests'} · {area.futureAvailableSlotCount} {area.futureAvailableSlotCount === 1 ? 'slot' : 'slots'} · {area.legalServiceCount} {area.legalServiceCount === 1 ? 'service' : 'services'}</span>{recruitment && <span className="mt-1 block text-xs font-medium text-slate-600">Recruitment in progress</span>}</span>
      <span className="flex shrink-0 flex-col items-end gap-2"><WorkforceStatus status={area.status} /><span aria-hidden="true" className="text-xs text-slate-500">{expanded ? '−' : '+'}</span></span>
    </button>
    <div id={id} hidden={!expanded} className="pb-4">
      <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 text-xs min-[375px]:grid-cols-2 sm:grid-cols-3">{[['Active Lawyers', area.activeLawyerCount], ['Recent Requests', area.recentDemandCount], ['Recent Appointments', area.recentAppointmentCount], ['Future Slots', area.futureAvailableSlotCount], ['Legal Services', area.legalServiceCount]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 text-base font-semibold text-slate-900">{value}</dd></div>)}</dl>
      <div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600"><p className="font-semibold text-slate-900">Demand and capacity</p><p className="mt-1">Assessment uses the higher of recent requests and recent appointments, compared with upcoming available slots. These demand signals are not added together.</p><p className="mt-3 font-semibold text-slate-900">Assessment · {area.status === 'HEALTHY' ? 'Healthy' : area.status === 'WATCH' ? 'Watch' : area.status === 'CAPACITY_CONCERN' ? 'Capacity Concern' : 'No Active Lawyers'}</p><p className="mt-1">{area.reasons.filter(code => code !== 'RECRUITMENT_ALREADY_ACTIVE').map(code => reasonText[code] ?? 'Review recorded coverage.').join(' ')}</p></div>
      {area.planningRules && <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Workforce Rules</p><dl className="mt-3 grid grid-cols-1 gap-3 text-xs min-[375px]:grid-cols-2 sm:grid-cols-3">{[['Minimum Lawyers', area.planningRules.minimumActiveLawyers], ['Target Lawyers', area.planningRules.targetActiveLawyers], ['Minimum Future Slots', area.planningRules.minimumFutureSlots], ['High Demand Threshold', area.planningRules.highDemandThreshold], ['Watch Capacity Ratio', `${area.planningRules.watchCapacityRatio * 100}%`], ['Configuration', area.planningRules.source === 'CUSTOM' ? 'Custom' : 'Default']].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>)}</dl></div>}
      {recruitment && <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs font-semibold text-slate-900">Current Recruitment</p>{area.openings.map(opening => <p key={opening.careerId} className="mt-1 text-xs text-slate-600">{opening.jobTitle} · Opening #{opening.careerId}</p>)}<Link to="/admin/careers" className="inline-flex min-h-11 items-center text-xs font-semibold text-slate-700 underline focus-visible:outline-2 focus-visible:outline-amber-600">View Career Opening →</Link></div>}
    </div>
  </li>;
}
export function SupportingWorkforceData({ report }: { report: WorkforceReport }) {
  const [expanded, setExpanded] = useState(false);
  return <section className="border-t border-slate-200 pt-2" aria-label="Analysis details">
    <button type="button" aria-expanded={expanded} aria-controls="workforce-analysis-details" onClick={() => setExpanded(value => !value)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm py-2 text-left text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">View Analysis Details<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
    <div id="workforce-analysis-details" hidden={!expanded}><p className="my-3 text-xs text-slate-500">Evidence behind the assessment · Last {report.recentWindowDays} days of demand · Next {report.futureWindowDays} days of capacity</p>
      <ul aria-label="Supporting workforce data">{report.practiceAreas.map(area => <AnalysisEvidenceRow key={area.practiceAreaId} area={area} />)}</ul>
    </div>
  </section>;
}
