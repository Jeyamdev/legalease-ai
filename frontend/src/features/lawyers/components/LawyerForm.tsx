import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { lawyerSchema } from "../schemas";
import type { LawyerFormValues } from "../schemas";
import type { Catalog, Lawyer } from "../types";
import { errorMessage } from "../api/client";
import { buttonClass, Field, inputClass } from "./Shared";
export default function LawyerForm({
  lawyer,
  specs,
  services,
  onSave,
}: {
  lawyer?: Lawyer;
  specs: Catalog[];
  services: Catalog[];
  onSave: (v: LawyerFormValues) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof lawyerSchema>, unknown, LawyerFormValues>({
    resolver: zodResolver(lawyerSchema),
    defaultValues: lawyer
      ? {
          ...lawyer,
          status: lawyer.status as LawyerFormValues["status"],
          specializationIds: lawyer.specializations.map((s) => s.id),
          legalServiceIds: lawyer.legalServices.map((s) => s.id),
        }
      : {
          name: "",
          email: "",
          phoneNumber: "",
          qualification: "",
          experience: 0,
          licenseNumber: "",
          profileDescription: "",
          status: "Active",
          specializationIds: [],
          legalServiceIds: [],
        },
  });
  return (
    <form
      className="space-y-5 rounded-xl bg-white p-6"
      onSubmit={handleSubmit(async (values) => {
        setError("");
        try {
          await onSave(values);
        } catch (e) {
          setError(errorMessage(e));
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            "name",
            "email",
            "phoneNumber",
            "qualification",
            "experience",
            "licenseNumber",
          ] as const
        ).map((name) => (
          <Field
            key={name}
            label={
              {
                name: "Full name",
                email: "Email",
                phoneNumber: "Phone number",
                qualification: "Qualification",
                experience: "Years of experience",
                licenseNumber: "License number",
              }[name]
            }
            error={errors[name]?.message}
          >
            <input
              className={inputClass}
              type={
                name === "experience"
                  ? "number"
                  : name === "email"
                    ? "email"
                    : "text"
              }
              {...register(
                name,
                name === "experience" ? { valueAsNumber: true } : {},
              )}
            />
          </Field>
        ))}
      </div>
      {!lawyer && (
        <Field
          label="Existing user ID (optional)"
          error={errors.userId?.message}
        >
          <input className={inputClass} {...register("userId")} />
          <span className="text-sm text-slate-600">
            Leave blank to create a profile-only account. No login password is
            created.
          </span>
        </Field>
      )}
      <Field
        label="Profile description"
        error={errors.profileDescription?.message}
      >
        <textarea
          rows={4}
          className={inputClass}
          {...register("profileDescription")}
        />
      </Field>
      <Field label="Status" error={errors.status?.message}>
        <select className={inputClass} {...register("status")}>
          {["Active", "Inactive", "Suspended"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field
        label="Specializations (select multiple)"
        error={errors.specializationIds?.message}
      >
        <Controller
          name="specializationIds"
          control={control}
          render={({ field }) => (
            <select
              multiple
              className={inputClass}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value.map(String)}
              onChange={(e) =>
                field.onChange(
                  Array.from(e.target.selectedOptions, (option) =>
                    Number(option.value),
                  ),
                )
              }
            >
              {specs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        />
      </Field>
      <Field
        label="Legal services (select multiple)"
        error={errors.legalServiceIds?.message}
      >
        <Controller
          name="legalServiceIds"
          control={control}
          render={({ field }) => (
            <select
              multiple
              className={inputClass}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value.map(String)}
              onChange={(e) =>
                field.onChange(
                  Array.from(e.target.selectedOptions, (option) =>
                    Number(option.value),
                  ),
                )
              }
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        />
      </Field>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <button className={buttonClass} disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save lawyer"}
      </button>
    </form>
  );
}
