import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { ChevronDown } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { lawyerManagementChangedEvent, lawyersApi, type LawyerServicesSummary } from "../../api/lawyersApi";
import { CoverageOverview } from "../../components/lawyers/CoverageOverview";
import { AdminLayout } from "../../components/layout/AdminLayout";

const sections = [
  { label: "Lawyers", path: "lawyers" },
  { label: "Practice Areas", path: "specializations" },
  { label: "Legal Services", path: "legal-services" },
  { label: "AI Recommendation", path: "recommendations" },
];

export function OperationalSummary({ summary, loading, error, coverageOpen, onToggle, onRetry }: {
  summary: LawyerServicesSummary | null;
  loading: boolean;
  error: string | null;
  coverageOpen: boolean;
  onToggle: () => void;
  onRetry: () => void;
}) {
  return <div className="mb-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-sm" aria-live="polite">
    {summary && <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-slate-700">
      <span>{summary.activeLawyers} Active Lawyers</span><span aria-hidden="true" className="text-slate-300">·</span>
      <span>{summary.practiceAreas} Practice Areas</span><span aria-hidden="true" className="text-slate-300">·</span>
      <span>{summary.legalServices} Legal Services</span>
      <span className="font-normal text-slate-500">({summary.totalLawyers} total lawyer records)</span>
    </p>}
    {loading && !summary && <p role="status" className="text-slate-500">Loading summary...</p>}
    {error && <p role="alert" className="text-amber-800">{error} <button type="button" onClick={onRetry} className="font-semibold underline focus-visible:outline-2 focus-visible:outline-amber-600">Retry</button></p>}
    {summary && <button type="button" aria-expanded={coverageOpen} aria-controls="lawyer-coverage-overview"
      onClick={onToggle}
      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
      Coverage Overview <ChevronDown size={15} aria-hidden="true" className={coverageOpen ? "rotate-180" : ""} />
    </button>}
  </div>;
}

export function LawyerLegalServicesLayout() {
  const requestVersion = useRef(0);
  const [summary, setSummary] = useState<LawyerServicesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);

  const refreshSummary = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      setError(null);
      const result = await lawyersApi.getLawyerServicesSummary();
      if (version === requestVersion.current) setSummary(result);
    } catch (cause) {
      if (version === requestVersion.current) setError(axios.isAxiosError(cause) && cause.response?.status === 404
        ? "Operational summary requires the updated backend. Restart the API, then Retry."
        : "Operational summary unavailable.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onChanged = () => { void refreshSummary(); };
    void Promise.resolve().then(refreshSummary);
    window.addEventListener(lawyerManagementChangedEvent, onChanged);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener(lawyerManagementChangedEvent, onChanged);
    };
  }, [refreshSummary]);

  return (
    <AdminLayout
      title="Lawyer & Legal Service Management"
      subtitle="Manage practitioners, legal categories, services and AI recommendations"
      showStats={false}
    >
      <OperationalSummary summary={summary} loading={loading} error={error} coverageOpen={coverageOpen}
        onToggle={() => setCoverageOpen(open => !open)} onRetry={() => void refreshSummary()} />
      <nav aria-label="Lawyer and legal service sections" className="mb-6 overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max gap-5 sm:gap-8">
          {sections.map(({ label, path }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `-mb-px whitespace-nowrap border-b-2 px-1 pb-3 pt-1 text-xs font-bold uppercase text-slate-500 transition-colors focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                  isActive
                    ? "border-amber-500 text-slate-900"
                    : "border-transparent hover:border-slate-300 hover:text-slate-800"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <div id="lawyer-coverage-overview" hidden={!coverageOpen}>
        {summary && <CoverageOverview rows={summary.coverage} />}
      </div>
      <Outlet context={summary} />
    </AdminLayout>
  );
}
