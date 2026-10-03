import type { LawyerServicesSummary } from "../../api/lawyersApi";
import { coverageWarnings } from "./coverageWarnings";

type CoverageRow = LawyerServicesSummary["coverage"][number];

export function CoverageOverview({ rows }: { rows: CoverageRow[] }) {
  return <section aria-label="Coverage Overview" className="mb-6 overflow-hidden rounded-md border border-slate-200 bg-white">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3">Practice Area</th>
            <th scope="col" className="px-4 py-3">Active Lawyers</th>
            <th scope="col" className="px-4 py-3">Legal Services</th>
            <th scope="col" className="px-4 py-3">Future Slots</th>
            <th scope="col" className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(row => {
            const warnings = coverageWarnings(row);
            return <tr key={row.practiceAreaId}>
              <th scope="row" className="px-4 py-3 font-semibold text-slate-900">{row.practiceAreaName}</th>
              <td className="px-4 py-3 text-slate-700">{row.activeLawyers}</td>
              <td className="px-4 py-3 text-slate-700">{row.legalServices}</td>
              <td className="px-4 py-3 text-slate-700">{row.futureAvailabilityCount}</td>
              <td className={`px-4 py-3 text-xs font-semibold ${warnings.length ? "text-amber-800" : "text-emerald-700"}`}>
                {warnings.length ? warnings.join(" · ") : "Ready"}
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    {rows.length === 0 && <p className="px-4 py-5 text-sm text-slate-500">No Practice Areas configured.</p>}
  </section>;
}
