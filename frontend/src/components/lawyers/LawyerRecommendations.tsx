import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { recommendationsApi, type AppointmentSummary, type RecommendationCustomer, type RecommendationResult, type RecommendationSlot } from "../../api/recommendationsApi";
import { workflowStages } from "./recommendationWorkflow";

function requestError(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (error.response?.status === 503) return "AI classification is temporarily unavailable. No recommendation was created. Please try again.";
  if (error.response?.status === 422) return "No supported Practice Area could be validated. Revise the requirement.";
  if (error.response?.status === 404) return "Recommendation workflow not found or unavailable to this Admin.";
  return error.response?.data?.message || error.response?.data?.title || fallback;
}

export function RecommendationWorkflow({ result }: { result: RecommendationResult }) {
  return <ol className="mt-3 border-l border-slate-200 pl-5">
    {workflowStages(result).map((stage, index) => <li key={stage.label} className="relative pb-3 last:pb-0">
      <span aria-hidden="true" className={`absolute -left-[1.82rem] flex h-5 w-5 items-center justify-center rounded-full border bg-white text-xs font-bold ${stage.state === "failed" ? "border-red-500 text-red-700" : stage.state === "completed" ? "border-emerald-600 text-emerald-700" : stage.state === "waiting" ? "border-amber-500 text-amber-700" : "border-slate-300 text-slate-400"}`}>
        {stage.state === "completed" ? "✓" : stage.state === "failed" ? "!" : stage.state === "waiting" ? "•" : "○"}
      </span>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-slate-900">{index + 1}. {stage.label}</span>
        <span className="text-[11px] font-bold text-slate-500">{stage.actor}</span>
        <span className="text-xs text-slate-500">{stage.state === "waiting" ? "Awaiting Admin" : stage.state === "failed" ? "Stopped" : stage.state === "completed" ? "Completed" : "Pending"}</span>
      </div>
      {stage.detail && <p className="mt-0.5 text-xs text-slate-600">{stage.detail}</p>}
    </li>)}
  </ol>;
}

export function LawyerRecommendations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowId = searchParams.get("workflow");
  const [requirement, setRequirement] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecommendationResult>();
  const [workflowOpen, setWorkflowSetOpen] = useState(false);
  const [selectedLawyer, setSelectedLawyer] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<RecommendationCustomer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [slots, setSlots] = useState<RecommendationSlot[]>([]);
  const [slotId, setSlotId] = useState("");
  const [approving, setApproving] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentSummary>();
  const pending = useRef<AbortController | null>(null);
  const loadedWorkflow = useRef<string | null>(null);

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!workflowId || loadedWorkflow.current === workflowId) return;
    loadedWorkflow.current = workflowId;
    let active = true;
    setRestoring(true);
    recommendationsApi.get(workflowId).then(data => {
      if (!active) return;
      setResult(data);
      setRequirement(data.userRequirement || data.parsedRequirement?.requirement || "");
      setDate(data.date || "");
      setBookingDate(data.date || "");
      setSelectedLawyer(data.approvedLawyerId || "");
      setError("");
    }).catch(error => { if (active) setError(requestError(error, "Workflow not found or unavailable.")); })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [workflowId]);

  useEffect(() => {
    if (!selectedLawyer || result?.status !== "AWAITING_APPROVAL") return;
    let active = true;
    const timer = window.setTimeout(() => {
      recommendationsApi.customers(customerSearch).then(data => { if (active) setCustomers(data); })
        .catch(() => { if (active) setError("Could not load customer accounts."); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedLawyer, customerSearch, result?.status]);

  useEffect(() => {
    if (!selectedLawyer || !bookingDate || result?.status !== "AWAITING_APPROVAL") return;
    let active = true;
    recommendationsApi.slots(selectedLawyer, bookingDate).then(data => {
      if (active) setSlots(data.filter(slot => !slot.isBooked));
    }).catch(() => { if (active) setError("Could not load available slots for this lawyer and date."); });
    return () => { active = false; };
  }, [selectedLawyer, bookingDate, result?.status]);

  useEffect(() => {
    if (result?.status !== "ACTION_COMPLETED" || !result.appointmentId) return;
    let active = true;
    recommendationsApi.appointment(result.appointmentId).then(data => { if (active) setAppointment(data); })
      .catch(() => { if (active) setError("Appointment was created, but its details could not be loaded."); });
    return () => { active = false; };
  }, [result?.status, result?.appointmentId]);

  const clearWorkflow = (keepInput = false) => {
    loadedWorkflow.current = null;
    setSearchParams({}, { replace: true });
    setResult(undefined); setSelectedLawyer(""); setSlots([]); setSlotId("");
    setCustomers([]); setCustomerId(""); setAppointment(undefined); setError("");
    if (!keepInput) { setRequirement(""); setDate(""); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    if (requirement.trim().length < 3) { setError("Describe your legal requirement using at least three characters."); return; }
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(""); setResult(undefined); setSelectedLawyer("");
    try {
      const data = await recommendationsApi.recommend(requirement.trim(), date, controller.signal);
      if (controller.signal.aborted) return;
      loadedWorkflow.current = data.workflowId;
      setResult(data); setBookingDate(data.date || ""); setWorkflowSetOpen(false);
      setSearchParams({ workflow: data.workflowId }, { replace: true });
    } catch (error) {
      if (!controller.signal.aborted) setError(requestError(error, "Unable to prepare recommendations."));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const selected = result?.recommendations.find(item => item.lawyerId === selectedLawyer);
  return <section id="lawyer-recommendations" aria-labelledby="recommendation-title" className="space-y-6 text-slate-900">
    <header>
      <h2 id="recommendation-title" className="text-xl font-bold">AI Lawyer Recommendation</h2>
      <p className="mt-1 text-sm text-slate-500">AI-assisted matching using verified Practice Area, experience and availability data.</p>
    </header>

    <form onSubmit={submit} className="space-y-4 border-b border-slate-200 pb-6">
      <label className="block text-sm font-semibold">Legal requirement
        <textarea required minLength={3} maxLength={4000} rows={4} value={requirement} onChange={event => setRequirement(event.target.value)} placeholder="I have a dispute about ownership of my land." className="mt-2 block w-full rounded border border-slate-300 bg-white p-3 font-normal focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm font-semibold">Preferred date <span className="font-normal text-slate-500">(optional)</span>
          <input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={event => setDate(event.target.value)} className="mt-2 block rounded border border-slate-300 bg-white p-2 font-normal focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </label>
        <button disabled={busy || restoring} className="rounded bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:opacity-50">{busy ? "Preparing recommendations..." : "Find Suitable Lawyers"}</button>
        {(result || workflowId) && <button type="button" onClick={() => clearWorkflow()} className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">Start New Recommendation</button>}
      </div>
    </form>

    {(busy || restoring) && <div role="status" className="border-b border-slate-200 pb-5 text-sm text-slate-700">{restoring ? "Restoring recommendation workflow..." : "Processing recommendation. Interpreting the requirement and validating results..."}</div>}
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

    {result && <>
      <section aria-labelledby="workflow-heading" className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="workflow-heading" className="text-base font-bold">Recommendation Workflow</h3>
            <p role="status" className="text-sm text-slate-600">{result.status === "ACTION_COMPLETED" ? "Appointment created" : result.status === "AWAITING_APPROVAL" ? "Recommendation prepared. Awaiting human approval." : result.status === "UNSUPPORTED" ? "Stopped at Practice Area validation" : "No matching recommendation"}</p>
          </div>
          <button type="button" aria-expanded={workflowOpen} onClick={() => setWorkflowSetOpen(!workflowOpen)} className="rounded px-2 py-1 text-sm font-semibold text-amber-800 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500">{workflowOpen ? "Hide Workflow" : "View Workflow"}</button>
        </div>
        {workflowOpen && <RecommendationWorkflow result={result} />}
      </section>

      <section className="border-b border-slate-200 pb-5">
        <h3 className="text-sm font-bold uppercase text-slate-600">AI Interpretation</h3>
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <p><span className="text-slate-500">Practice Area</span><br /><strong>{result.parsedRequirement?.categoryName || "No supported Practice Area"}</strong></p>
          {result.date && <p><span className="text-slate-500">Requested date</span><br /><strong>{result.date}</strong></p>}
          <p><span className="text-slate-500">Recommended matches</span><br /><strong>{result.recommendations.length}</strong></p>
        </div>
        {result.warnings.map((warning, index) => <p key={index} className="mt-3 text-sm text-amber-800">{warning}</p>)}
        {result.status === "UNSUPPORTED" && <p className="mt-3 text-sm text-slate-700">No lawyer recommendation was generated. Revise the requirement or configure the relevant Practice Area.</p>}
        {result.status === "NO_MATCH" && <p className="mt-3 text-sm text-slate-700">{result.date ? "No lawyers are available on the requested date." : "No active lawyers matched this Practice Area."} <button type="button" onClick={() => clearWorkflow(true)} className="font-semibold text-amber-800 underline">{result.date ? "Change Date" : "Revise Requirement"}</button></p>}
      </section>

      {result.recommendations.length > 0 && <section className="space-y-3">
        <h3 className="text-base font-bold">Recommended Matches</h3>
        <details className="text-xs text-slate-600"><summary className="cursor-pointer font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">About Recommendation Points</summary><p className="mt-1">Points are deterministic ranking values from verified Practice Area, recorded experience and requested-date availability. They are not probabilities and do not predict legal outcomes.</p></details>
        {result.recommendations.map((item, index) => <article key={item.lawyerId} className={`rounded border bg-white p-4 ${selectedLawyer === item.lawyerId ? "border-amber-500" : "border-slate-200"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold text-amber-800">#{index + 1} {index === 0 ? "Top Recommended Match" : "Recommended Match"}</p><h4 className="mt-1 font-bold">{item.fullName || "Practitioner profile unavailable"}</h4>
              <p className="text-sm text-slate-600">{[item.qualification, item.practiceArea, item.yearsExperience != null ? `${item.yearsExperience} years experience` : null].filter(Boolean).join(" · ")}</p></div>
            <strong className="text-sm">{item.score} Recommendation Points</strong>
          </div>
          <p className="mt-3 text-sm text-slate-600">{item.reason}</p>
          {result.status === "AWAITING_APPROVAL" && <button type="button" aria-pressed={selectedLawyer === item.lawyerId} onClick={() => { setSelectedLawyer(item.lawyerId); setCustomerId(""); setSlots([]); setSlotId(""); setError(""); }} className="mt-3 rounded border border-amber-500 px-3 py-2 text-sm font-semibold hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500">{selectedLawyer === item.lawyerId ? "Selected for Human Approval" : "Select Lawyer"}</button>}
        </article>)}
      </section>}

      {result.status === "AWAITING_APPROVAL" && selected && <form className="space-y-4 border-t border-slate-200 pt-5" onSubmit={async event => {
        event.preventDefault(); if (!customerId || !slotId) return;
        setApproving(true); setError("");
        try { setResult(await recommendationsApi.approve(result.workflowId, selectedLawyer, customerId, slotId)); }
        catch (error) { setError(requestError(error, "Booking validation failed. Check the customer and slot, then retry.")); }
        finally { setApproving(false); }
      }}>
        <div><h3 className="text-base font-bold">Human Approval Required</h3><p className="mt-1 text-sm text-slate-600">No appointment has been created. Review the practitioner, customer and unbooked slot before authorizing booking.</p></div>
        <p className="text-sm"><span className="text-slate-500">Selected lawyer:</span> <strong>{selected.fullName}</strong></p>
        <label className="block text-sm font-semibold">Search customer
          <input value={customerSearch} onChange={event => { setCustomerSearch(event.target.value); setCustomerId(""); }} placeholder="Name or email" className="mt-1 block w-full max-w-md rounded border border-slate-300 p-2 font-normal focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </label>
        <label className="block text-sm font-semibold">Customer
          <select required value={customerId} onChange={event => setCustomerId(event.target.value)} className="mt-1 block w-full max-w-md rounded border border-slate-300 bg-white p-2 font-normal focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">Select a customer</option>{customers.map(customer => <option key={customer.customerId} value={customer.customerId}>{customer.name} · {customer.email}</option>)}
          </select>
        </label>
        {result.date ? <p className="text-sm"><span className="text-slate-500">Appointment date:</span> <strong>{result.date}</strong> <button type="button" onClick={() => clearWorkflow(true)} className="ml-2 text-amber-800 underline">Change Date</button></p> : <label className="block text-sm font-semibold">Appointment date
          <input required type="date" min={new Date().toISOString().slice(0, 10)} value={bookingDate} onChange={event => { setBookingDate(event.target.value); setSlots([]); setSlotId(""); }} className="mt-1 block rounded border border-slate-300 p-2 font-normal focus:outline-none focus:ring-2 focus:ring-amber-500" />
          <span className="mt-1 block text-xs font-normal text-slate-500">Availability was not filtered during ranking. Choose a future date and an available slot.</span>
        </label>}
        <label className="block text-sm font-semibold">Available slot
          <select required value={slotId} onChange={event => setSlotId(event.target.value)} disabled={!bookingDate} className="mt-1 block w-full max-w-md rounded border border-slate-300 bg-white p-2 font-normal focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">{!bookingDate ? "Choose a date first" : slots.length ? "Choose an unbooked time" : "No available times on this date"}</option>
            {slots.map(slot => <option key={slot.slotId} value={slot.slotId}>{slot.startTime}–{slot.endTime}</option>)}
          </select>
        </label>
        <button disabled={approving || !customerId || !slotId} className="rounded bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:opacity-50">{approving ? "Creating appointment..." : "Approve & Create Appointment"}</button>
      </form>}

      {result.status === "ACTION_COMPLETED" && <section role="status" className="border-t border-slate-200 pt-5 text-sm"><h3 className="text-base font-bold text-emerald-800">Appointment Created</h3>
        {appointment ? <p className="mt-2">{appointment.lawyerName} · {appointment.customerName} · {appointment.date} · {appointment.startTime}–{appointment.endTime}</p> : <p className="mt-2">Appointment ID: {result.appointmentId}</p>}
        <p className="mt-1 text-slate-600">Workflow status: Action Completed</p>
      </section>}

      <details className="border-t border-slate-200 pt-4 text-sm"><summary className="cursor-pointer font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">Workflow Details & Audit Trail</summary>
        <dl className="mt-3 grid gap-1 text-xs text-slate-600"><div><dt className="inline font-semibold">Workflow ID: </dt><dd className="inline">{result.workflowId}</dd></div><div><dt className="inline font-semibold">Status: </dt><dd className="inline">{result.status.replaceAll("_", " ")}</dd></div></dl>
        <ol className="mt-3 space-y-1 text-xs text-slate-600">{result.trace.map((event, index) => <li key={`${event.step}-${index}`}><time>{new Date(event.timestamp).toLocaleString()}</time> · {event.summary}{event.error ? `: ${event.error}` : ""}</li>)}</ol>
      </details>
    </>}
  </section>;
}
