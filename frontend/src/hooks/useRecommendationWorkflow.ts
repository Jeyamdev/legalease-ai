import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { recommendationsApi, type AppointmentSummary, type RecommendationCustomer, type RecommendationResult, type RecommendationSlot } from "../api/recommendationsApi";

function requestError(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (error.response?.status === 503) return "AI recommendation unavailable. We couldn't interpret this legal requirement right now. No lawyer recommendation was generated. Please try again.";
  if (error.response?.status === 422) return "Catalog validation failed. Revise the requirement and retry the analysis.";
  if (error.response?.status === 404) return "Recommendation workflow not found or unavailable to this Admin.";
  const message = error.response?.data?.message || error.response?.data?.title;
  return typeof message === "string" && message.length <= 300 && !/stack|traceback|exception\s+at/i.test(message) ? message : fallback;
}

export type RecommendationView = "matches" | "review" | "appointment";
function savedReview(result: RecommendationResult): { lawyerId: string; view: RecommendationView } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(`recommendation-review:${result.workflowId}`) || "null");
    if (result.status === "AWAITING_APPROVAL" && result.recommendations.some(item => item.lawyerId === saved?.lawyerId) &&
        (saved.view === "review" || saved.view === "appointment")) return saved;
  } catch { /* Storage can be unavailable; the persisted server workflow still restores. */ }
  return { lawyerId: result.approvedLawyerId || "", view: "matches" };
}

export function useRecommendationWorkflow() {
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowId = searchParams.get("workflow");
  const [requirement, setRequirement] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(!!workflowId);
  const [view, setView] = useState<RecommendationView>("matches");
  const [analysisSeconds, setAnalysisSeconds] = useState<number>();
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecommendationResult>();
  const [selectedLawyer, setSelectedLawyer] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<RecommendationCustomer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [slotReason, setSlotReason] = useState<string | null>(null);
  const [slots, setSlots] = useState<RecommendationSlot[]>([]);
  const [slotId, setSlotId] = useState("");
  const [approving, setApproving] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentSummary>();
  const pending = useRef<AbortController | null>(null);
  const approvalPending = useRef(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [customersVersion, setCustomersVersion] = useState(0);
  const [appointmentVersion, setAppointmentVersion] = useState(0);
  const loadedWorkflow = useRef<string | null>(null);

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;
      if (!workflowId) {
        if (loadedWorkflow.current) {
          loadedWorkflow.current = null;
          setResult(undefined); setSelectedLawyer(""); setAppointment(undefined);
        }
        return;
      }
      if (loadedWorkflow.current === workflowId) return;
      setRestoring(true);
      setResult(undefined); setSelectedLawyer(""); setCustomerId(""); setSlots([]); setSlotId("");
      setAppointment(undefined); setError("");
      try {
        const data = await recommendationsApi.get(workflowId);
        if (!active) return;
        loadedWorkflow.current = workflowId;
        setResult(data);
        setRequirement(data.userRequirement || data.parsedRequirement?.requirement || "");
        setDate(data.date || ""); setBookingDate(data.date || "");
        const saved = savedReview(data);
        setSelectedLawyer(saved.lawyerId); setView(saved.view); setAnalysisSeconds(undefined);
      } catch (cause) { if (active) setError(requestError(cause, "Workflow not found or unavailable.")); }
      finally { if (active) setRestoring(false); }
    });
    return () => { active = false; };
  }, [workflowId, restoreVersion]);

  useEffect(() => {
    if (!selectedLawyer || result?.status !== "AWAITING_APPROVAL") return;
    let active = true;
    const timer = window.setTimeout(() => {
      setCustomersLoading(true);
      recommendationsApi.customers(customerSearch).then(data => { if (active) setCustomers(data); })
        .catch(() => { if (active) setError("Could not load customer accounts."); })
        .finally(() => { if (active) setCustomersLoading(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedLawyer, customerSearch, result?.status, customersVersion]);

  useEffect(() => {
    if (!selectedLawyer || !bookingDate || result?.status !== "AWAITING_APPROVAL") return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return undefined;
      setSlotsLoading(true); setSlotReason(null);
      return recommendationsApi.slots(selectedLawyer, bookingDate);
    }).then(data => {
      if (active && data) { setSlotReason(data.reason ?? null); setSlots(data.availableSlots.map(slot => ({ slotId: slot.slotId, date: data.date, startTime: slot.start, endTime: slot.end, isBooked: false }))); }
    }).catch(() => { if (active) setError("Could not load available slots for this lawyer and date."); })
      .finally(() => { if (active) setSlotsLoading(false); });
    return () => { active = false; };
  }, [selectedLawyer, bookingDate, result?.status, slotsVersion]);

  useEffect(() => {
    if (result?.status !== "ACTION_COMPLETED" || !result.appointmentId) return;
    let active = true;
    recommendationsApi.appointment(result.appointmentId).then(data => { if (active) setAppointment(data); })
      .catch(() => { if (active) setError("Appointment was created, but its details could not be loaded."); });
    return () => { active = false; };
  }, [result?.status, result?.appointmentId, appointmentVersion]);

  const clearWorkflow = (keepInput = false) => {
    if (pending.current || approvalPending.current) return;
    if (workflowId) { try { sessionStorage.removeItem(`recommendation-review:${workflowId}`); } catch { /* Optional UX storage. */ } }
    loadedWorkflow.current = null;
    setSearchParams({}, { replace: true });
    setResult(undefined); setSelectedLawyer(""); setSlots([]); setSlotId("");
    setCustomers([]); setCustomerId(""); setAppointment(undefined); setError("");
    setView("matches"); setAnalysisSeconds(undefined);
    if (!keepInput) { setRequirement(""); setDate(""); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || approvalPending.current || result) return;
    if (requirement.trim().length < 3) { setError("Describe your legal requirement using at least three characters."); return; }
    const controller = new AbortController(); pending.current = controller;
    const started = performance.now();
    setAnalysisSeconds(undefined); setView("matches");
    setBusy(true); setError(""); setResult(undefined); setSelectedLawyer("");
    setCustomers([]); setCustomerId(""); setSlots([]); setSlotId(""); setAppointment(undefined);
    try {
      const data = await recommendationsApi.recommend(requirement.trim(), date, controller.signal);
      if (controller.signal.aborted) return;
      loadedWorkflow.current = data.workflowId;
      setAnalysisSeconds((performance.now() - started) / 1000);
      setResult(data); setBookingDate(data.date || "");
      setSearchParams({ workflow: data.workflowId }, { replace: true });
    } catch (error) {
      if (!controller.signal.aborted) setError(requestError(error, "Unable to prepare recommendations."));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const selected = result?.recommendations.find(item => item.lawyerId === selectedLawyer);
  const changeView = (next: RecommendationView, lawyerId = selectedLawyer) => {
    if (approvalPending.current) return;
    setView(next);
    if (result) { try { sessionStorage.setItem(`recommendation-review:${result.workflowId}`, JSON.stringify({ lawyerId, view: next })); } catch { /* Optional UX storage. */ } }
  };
  const selectLawyer = (id: string) => {
    if (approvalPending.current || result?.status !== "AWAITING_APPROVAL" || !result.recommendations.some(item => item.lawyerId === id)) return;
    changeView("review", id);
    if (id === selectedLawyer) return;
    setCustomersLoading(true);
    if (bookingDate) setSlotsLoading(true);
    setSelectedLawyer(id); setCustomerId(""); setCustomers([]); setSlots([]); setSlotId(""); setError("");
  };
  const changeBookingDate = (value: string) => {
    if (result?.date || approvalPending.current || value === bookingDate) return;
    setBookingDate(value); setSlotReason(null); setSlots([]); setSlotId("");
  };
  const retrySlots = () => { setSlotReason(null); setSlotsLoading(true); setSlotId(""); setSlots([]); setSlotsVersion(value => value + 1); };
  const retryRestore = () => { loadedWorkflow.current = null; setRestoreVersion(value => value + 1); };
  const retryCustomers = () => { setError(""); setCustomerId(""); setCustomersLoading(true); setCustomersVersion(value => value + 1); };
  const retryAppointment = () => { setError(""); setAppointmentVersion(value => value + 1); };
  const changeSelection = () => { changeView("matches", ""); setSelectedLawyer(""); setSlotId(""); setCustomerId(""); setError(""); };
  const approve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!result || result.status !== "AWAITING_APPROVAL" || approvalPending.current ||
        !customerId || !slotId || customersLoading || slotsLoading) return;
    approvalPending.current = true;
    setApproving(true); setError("");
    try {
      setResult(await recommendationsApi.approve(result.workflowId, selectedLawyer, customerId, slotId));
    } catch (cause) {
      setError(requestError(cause, "Booking validation failed. Check the customer and slot, then retry."));
      if (axios.isAxiosError(cause) && cause.response?.status === 409) {
        retrySlots();
        // A concurrent approval may already have completed this workflow. Restore its persisted status.
        try {
          const restored = await recommendationsApi.get(result.workflowId);
          setResult(restored);
          if (restored.status === "ACTION_COMPLETED") setError("");
        } catch { /* Keep the actionable approval error. */ }
      }
    } finally { approvalPending.current = false; setApproving(false); }
  };
  return { workflowId, requirement, setRequirement, date, setDate, busy, restoring, error, result,
    selectedLawyer, selectLawyer, bookingDate, changeBookingDate, customerSearch, setCustomerSearch,
    customers, customerId, setCustomerId, slotReason, slots, slotId, setSlotId, approving, appointment,
    customersLoading, slotsLoading, clearWorkflow, submit, selected, approve, retryRestore, retrySlots,
    view, analysisSeconds, changeSelection, retryCustomers, retryAppointment,
    continueToAppointment: () => changeView("appointment"), backToReview: () => changeView("review") };
}
