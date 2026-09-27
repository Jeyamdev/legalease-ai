import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { availabilitySchema } from "../schemas";
import type { AvailabilityFormValues } from "../schemas";
import type { Availability } from "../types";
import { lawyersApi } from "../api/lawyers";
import { errorMessage } from "../api/client";
import { useResource } from "../hooks/useResource";
import {
  buttonClass,
  ConfirmDialog,
  Feedback,
  Field,
  inputClass,
} from "./Shared";
export default function AvailabilityManager({ id }: { id: string }) {
  const resource = useResource(
    useCallback(
      (signal: AbortSignal) => lawyersApi.availability(id, signal),
      [id],
    ),
  );
  const [editing, setEditing] = useState<string>();
  const [deleting, setDeleting] = useState<Availability>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: { date: "", startTime: "", endTime: "" },
  });
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl">Availability</h2>
      <p className="text-sm text-slate-600">
        Times use the platform local timezone (Asia/Colombo). These are working
        periods; appointment slots are managed separately.
      </p>
      <Feedback {...resource} retry={resource.reload} />
      {resource.data?.length === 0 && <p>No availability recorded.</p>}
      <ul className="space-y-2">
        {resource.data?.map((a) => (
          <li
            key={a.availabilityId}
            className="flex flex-wrap items-center gap-4 rounded bg-white p-4"
          >
            <span>
              {a.date} · {a.startTime.slice(0, 5)}–{a.endTime.slice(0, 5)}
            </span>
            {a.hasSlots ? (
              <span>Managed booking slots exist</span>
            ) : (
              <>
                <button
                  className="underline"
                  onClick={() => {
                    setEditing(a.availabilityId);
                    reset({
                      date: a.date,
                      startTime: a.startTime,
                      endTime: a.endTime,
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  className="text-red-700 underline"
                  onClick={() => setDeleting(a)}
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="space-y-4 rounded bg-white p-5"
        onSubmit={handleSubmit(async (v) => {
          setError("");
          try {
            await lawyersApi.saveAvailability(id, v, editing);
            setEditing(undefined);
            reset({ date: "", startTime: "", endTime: "" });
            resource.reload();
          } catch (e) {
            setError(errorMessage(e));
          }
        })}
      >
        <h3 className="font-semibold">
          {editing ? "Edit period" : "Add period"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["date", "startTime", "endTime"] as const).map((n) => (
            <Field
              key={n}
              label={
                n === "date"
                  ? "Date"
                  : n === "startTime"
                    ? "Start time"
                    : "End time"
              }
              error={errors[n]?.message}
            >
              <input
                type={n === "date" ? "date" : "time"}
                step={n === "date" ? undefined : "any"}
                className={inputClass}
                {...register(n)}
              />
            </Field>
          ))}
        </div>
        <button disabled={isSubmitting} className={buttonClass}>
          Save availability
        </button>
        {editing && (
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => {
              setEditing(undefined);
              reset({ date: "", startTime: "", endTime: "" });
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this availability period?"
          busy={busy}
          onCancel={() => setDeleting(undefined)}
          onConfirm={async () => {
            setBusy(true);
            setError("");
            try {
              await lawyersApi.deleteAvailability(id, deleting.availabilityId);
              setDeleting(undefined);
              resource.reload();
            } catch (e) {
              setError(errorMessage(e));
              setDeleting(undefined);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </section>
  );
}
