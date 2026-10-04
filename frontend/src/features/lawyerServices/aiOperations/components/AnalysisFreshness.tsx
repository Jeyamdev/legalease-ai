import type { WorkforceReport } from "../services/workforceApi";
export function AnalysisFreshness({ report, durationMs }: { report: WorkforceReport; durationMs?: number }) {
  const generatedAt = new Date(report.generatedAt);
  return <div aria-label="Analysis freshness" className="flex flex-wrap gap-x-6 gap-y-2 text-xs leading-relaxed text-slate-500">
    {!Number.isNaN(generatedAt.getTime()) && <p>Last analysed <time dateTime={report.generatedAt} title="Asia/Colombo" className="ml-1 font-medium text-slate-700">{new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' }).format(generatedAt)}</time></p>}
    <p>Demand window <span className="ml-1 text-slate-700">Last {report.recentWindowDays} days</span></p>
    <p>Capacity window <span className="ml-1 text-slate-700">Next {report.futureWindowDays} days</span></p>
    {durationMs !== undefined && <p>Analysis request completed in <span className="font-medium text-slate-700">{durationMs < 100 ? 'under 0.1s' : `${(durationMs / 1000).toFixed(1)}s`}</span></p>}
  </div>;
}
