import { secondaryButton, type RecommendationWorkflowModel } from "./recommendationUI";
export function RecommendationError({ workflow: w }: { workflow: RecommendationWorkflowModel }) {
  if (!w.error) return null;
  const completed = w.result?.status === "ACTION_COMPLETED";
  const customerFailure = w.error.includes("customer accounts");
  const slotFailure = /slot/i.test(w.error);
  const lawyerChanged = /lawyer/i.test(w.error) && /eligible|changed/i.test(w.error);
  const heading = completed ? "Appointment Details Unavailable" : customerFailure ? "Customer Search Unavailable" : lawyerChanged ? "Availability Changed" :
    slotFailure ? w.error.startsWith("Could not load") ? "Slot Availability Unavailable" : "Appointment Slot No Longer Available" :
    w.view === "appointment" ? "Appointment Could Not Be Created" : w.workflowId && !w.result ? "Workflow Unavailable" : w.error.startsWith("Catalog") ? "Catalog Validation Failed" : "AI Interpretation Failed";
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
    <h3 className="font-bold">{heading}</h3><p className="mt-2">{w.error}</p>
    <div className="mt-3 flex flex-wrap gap-3">
      {completed ? <button type="button" onClick={w.retryAppointment} className={secondaryButton}>Retry Appointment Details</button> :
        w.workflowId && !w.result ? <button type="button" onClick={w.retryRestore} className={secondaryButton}>Retry Workflow</button> :
        customerFailure ? <button type="button" disabled={w.customersLoading} onClick={w.retryCustomers} className={secondaryButton}>Retry Customers</button> :
        lawyerChanged ? <button type="button" disabled={w.approving} onClick={() => w.clearWorkflow(true)} className={secondaryButton}>Run New Analysis</button> :
        slotFailure ? <button type="button" disabled={w.slotsLoading || w.approving} onClick={w.retrySlots} className={secondaryButton}>Choose Another Slot</button> :
        w.view === "appointment" ? <button type="submit" form="appointment-approval" disabled={w.approving || w.customersLoading || w.slotsLoading || !w.customerId || !w.slotId} className={secondaryButton}>Retry Appointment</button> :
        <><button type="button" onClick={() => w.clearWorkflow(true)} className={secondaryButton}>Edit Requirement</button>{!w.result && !w.workflowId && <button type="submit" form="requirement-analysis" className={secondaryButton}>Retry Analysis</button>}</>}
    </div>
  </div>;
}
