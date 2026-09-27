import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { lawyersApi } from "../api/lawyers";
import { errorMessage } from "../api/client";
import { useResource } from "../hooks/useResource";
import { buttonClass, ConfirmDialog, Feedback } from "../components/Shared";
import AvailabilityManager from "../components/AvailabilityManager";
export default function LawyerDetailPage() {
  const { id = "" } = useParams();
  const resource = useResource(
    useCallback((signal: AbortSignal) => lawyersApi.get(id, signal), [id]),
  );
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const l = resource.data;
  return (
    <>
      <Link to="/admin/lawyer-management" className="underline">
        Back to lawyers
      </Link>
      <Feedback {...resource} retry={resource.reload} />
      {l && (
        <>
          <section className="space-y-4 rounded-xl bg-white p-6">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="font-display text-3xl">{l.name}</h1>
              <span>{l.status}</span>
              <Link to="edit" className={buttonClass}>
                Edit profile
              </Link>
              <button
                disabled={l.status === "Inactive"}
                className="text-red-700 underline disabled:opacity-50"
                onClick={() => setConfirm(true)}
              >
                Deactivate
              </button>
            </div>
            <p>{l.profileDescription || "No profile description."}</p>
            <dl className="grid gap-4 sm:grid-cols-2">
              {Object.entries({
                Email: l.email,
                Phone: l.phoneNumber,
                Qualification: l.qualification,
                Experience: `${l.experience} years`,
                License: l.licenseNumber,
                Specializations:
                  l.specializations.map((s) => s.name).join(", ") || "None",
                "Legal services":
                  l.legalServices.map((s) => s.name).join(", ") || "None",
              }).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-slate-600">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <AvailabilityManager id={id} />
        </>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {confirm && (
        <ConfirmDialog
          title="Deactivate this lawyer? Existing appointments will be preserved."
          busy={busy}
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await lawyersApi.deactivate(id);
              resource.reload();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
              setConfirm(false);
            }
          }}
        />
      )}
    </>
  );
}
