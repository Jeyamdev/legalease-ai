import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { buttonClass, Field, inputClass } from "../lawyers/components/Shared";
import { authError, registerCustomer } from "./api";
import { registerSchema, type RegisterValues } from "./schemas";

export default function SignupPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  return (
    <main className="mx-auto mt-20 max-w-md space-y-5 rounded-xl bg-white p-8 shadow">
      <Link to="/" className="font-display text-2xl">
        LegalEase
      </Link>
      <h1 className="font-display text-3xl">Create an account</h1>
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit(async (values) => {
          setError("");
          try {
            await registerCustomer(values);
            navigate("/member1/login", { replace: true, state: { registered: true } });
          } catch (e) {
            setError(authError(e));
          }
        })}
      >
        <Field label="Full name" error={errors.fullName?.message}>
          <input
            autoComplete="name"
            className={inputClass}
            aria-invalid={!!errors.fullName}
            {...register("fullName")}
          />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </Field>
        <p className="text-sm">Use 12–72 characters for your password.</p>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
        </Field>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <button disabled={isSubmitting} className={buttonClass}>
          {isSubmitting ? "Creating account…" : "Sign Up"}
        </button>
      </form>
      <Link to="/member1/login" className="underline">
        Already have an account? Sign in
      </Link>
    </main>
  );
}
