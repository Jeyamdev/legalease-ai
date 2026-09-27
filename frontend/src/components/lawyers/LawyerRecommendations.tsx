import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { apiClient } from "../../api/apiClient";
import type { Lawyer } from "../../api/lawyersApi";

type Result = { workflowId: string; status: string; date?: string | null; appointmentId?: string | null;
  parsedRequirement?: { categoryName?: string | null; location?: string | null };
  recommendations: { lawyerId: string; score: number; reason: string }[]; warnings: string[] };
type Slot = { slotId: string; date: string; startTime: string; endTime: string; isBooked: boolean };
export function LawyerRecommendations({ lawyers }: { lawyers: Lawyer[] }) {
  const [requirement, setRequirement] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result>();
  const [selectedLawyer, setSelectedLawyer] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [approving, setApproving] = useState(false);
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
        setBusy(true); setError(""); setResult(undefined); setSelectedLawyer(""); setSlots([]);
        try {
          const response = await apiClient.post<Result>("/api/lawyer-recommendations", { requirement: requirement.trim(), date: date || null, limit: 5 }, { signal: controller.signal, timeout: 60000 });
          if (!controller.signal.aborted) { setResult(response.data); setBookingDate(response.data.date || date); }
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
        {result && <p className="text-sm text-slate-600">Workflow: {result.workflowId} · {result.status.replaceAll("_", " ")}
          {result.parsedRequirement?.categoryName && ` · ${result.parsedRequirement.categoryName}`}</p>}
        {result?.recommendations.map(item => {
          const lawyer = lawyers.find(l => l.lawyerId === item.lawyerId);
          return <article key={item.lawyerId} className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">{lawyer?.name || "Lawyer profile updated — refresh the directory"}</h3>
            <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
            <p className="mt-2 text-xs text-slate-500">Match score: {item.score} (ranking points, not a probability)</p>
            {lawyer && <p className="mt-2 text-sm">{lawyer.email} · {lawyer.phoneNumber}</p>}
            {result?.status === "AWAITING_APPROVAL" && <button type="button" className="mt-3 rounded-lg border border-amber-400 px-3 py-2 text-sm font-bold text-slate-900"
              onClick={() => { setSelectedLawyer(item.lawyerId); setSlots([]); setSlotId(""); setError(""); }}>Select for approval</button>}
          </article>;
        })}
        {result?.status === "AWAITING_APPROVAL" && selectedLawyer && <form className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4" onSubmit={async e => {
          e.preventDefault(); if (!result.workflowId || !slotId || !customerId) return;
          setApproving(true); setError("");
          try {
            const response = await apiClient.post<Result>(`/api/lawyer-recommendations/${result.workflowId}/approve`, { lawyerId: selectedLawyer, customerId, slotId });
            setResult(response.data);
          } catch (e) {
            setError(axios.isAxiosError(e) ? e.response?.data?.title || e.response?.data?.message || "Approval failed." : "Approval failed.");
          } finally { setApproving(false); }
        }}>
          <h3 className="font-bold text-slate-900">Approve the selected lawyer and create a booking</h3>
          <p className="text-sm text-slate-600">A human must select a real customer and an unbooked slot. The booking is created only after approval.</p>
          <label className="block text-sm">Booking date
            <input required type="date" value={bookingDate} min={result.date || undefined} onChange={e => { setBookingDate(e.target.value); setSlots([]); setSlotId(""); }} className="ml-2 rounded border p-2" /></label>
          <button type="button" disabled={!bookingDate} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm" onClick={async () => {
            try { const response = await apiClient.get<Slot[]>("/api/appointments/available-slots", { params: { lawyerId: selectedLawyer, date: bookingDate } });
              setSlots(response.data.filter(s => !s.isBooked)); setSlotId(""); setError(""); }
            catch { setError("Could not load available slots for this lawyer and date."); }
          }}>Load available slots</button>
          <label className="block text-sm">Available slot
            <select required value={slotId} onChange={e => setSlotId(e.target.value)} className="ml-2 rounded border bg-white p-2">
              <option value="">Choose a slot</option>{slots.map(s => <option key={s.slotId} value={s.slotId}>{s.startTime}–{s.endTime}</option>)}
            </select></label>
          <label className="block text-sm">Customer UUID (from appointment system)
            <input required value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="Customer UUID" className="ml-2 rounded border p-2" /></label>
          <button disabled={approving || !slotId} className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {approving ? "Creating booking…" : "Approve and book"}</button>
        </form>}
        {result?.status === "ACTION_COMPLETED" && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900">Booking created: {result.appointmentId}</p>}
        {error && result && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    </section>
  );
}
