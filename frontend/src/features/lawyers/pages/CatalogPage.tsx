import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { catalogApi } from "../api/lawyers";
import type { CatalogKind } from "../api/lawyers";
import type { Catalog } from "../types";
import { catalogSchema } from "../schemas";
import type { CatalogFormValues } from "../schemas";
import { errorMessage } from "../api/client";
import { useResource } from "../hooks/useResource";
import {
  buttonClass,
  ConfirmDialog,
  Feedback,
  Field,
  inputClass,
} from "../components/Shared";
export default function CatalogPage({ kind }: { kind: CatalogKind }) {
  const resource = useResource(
    useCallback((signal: AbortSignal) => catalogApi.list(kind, signal), [kind]),
  );
  const [editing, setEditing] = useState<number>();
  const [deleting, setDeleting] = useState<Catalog>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CatalogFormValues>({
    resolver: zodResolver(catalogSchema),
    defaultValues: { name: "", description: "", category: "" },
  });
  return (
    <>
      <h1 className="font-display text-3xl">
        {kind === "specializations" ? "Specializations" : "Legal services"}
      </h1>
      <Feedback {...resource} retry={resource.reload} />
      {resource.data?.length === 0 && (
        <p>No entries yet. Add the first below.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {resource.data?.map((s) => (
          <article key={s.id} className="space-y-2 rounded-xl bg-white p-5">
            <h2 className="font-display text-xl">{s.name}</h2>
            <p>{s.description}</p>
            {s.category && (
              <p className="text-sm text-slate-600">{s.category}</p>
            )}
            <button
              className="mr-4 underline"
              onClick={() => {
                setEditing(s.id);
                reset({
                  name: s.name,
                  description: s.description,
                  category: s.category || "",
                });
              }}
            >
              Edit
            </button>
            <button
              className="text-red-700 underline"
              onClick={() => setDeleting(s)}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
      <form
        className="space-y-4 rounded-xl bg-white p-6"
        onSubmit={handleSubmit(async (v) => {
          setError("");
          try {
            await catalogApi.save(kind, v, editing);
            setEditing(undefined);
            reset({ name: "", description: "", category: "" });
            resource.reload();
          } catch (e) {
            setError(errorMessage(e));
          }
        })}
      >
        <h2 className="font-display text-xl">
          {editing ? "Edit entry" : "Add entry"}
        </h2>
        <Field label="Name" error={errors.name?.message}>
          <input className={inputClass} {...register("name")} />
        </Field>
        <Field label="Description" error={errors.description?.message}>
          <textarea className={inputClass} {...register("description")} />
        </Field>
        {kind === "legal-services" && (
          <Field label="Category" error={errors.category?.message}>
            <input className={inputClass} {...register("category")} />
          </Field>
        )}
        <button className={buttonClass} disabled={isSubmitting}>
          Save
        </button>
        {editing && (
          <button
            type="button"
            className="ml-4 underline"
            onClick={() => {
              setEditing(undefined);
              reset({ name: "", description: "", category: "" });
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
          title={`Delete ${deleting.name}? Assigned entries cannot be deleted.`}
          busy={busy}
          onCancel={() => setDeleting(undefined)}
          onConfirm={async () => {
            setBusy(true);
            setError("");
            try {
              await catalogApi.remove(kind, deleting.id);
              resource.reload();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
              setDeleting(undefined);
            }
          }}
        />
      )}
    </>
  );
}
