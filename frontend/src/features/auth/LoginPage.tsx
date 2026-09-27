import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../lawyers/hooks/session";
import { buttonClass, Field, inputClass } from "../lawyers/components/Shared";
import { authError, login } from "./api";
import { loginSchema, type LoginValues } from "./schemas";

export default function LoginPage({
  adminOnly = false,
}: {
  adminOnly?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useSession((s) => s.signIn);
  return (
    <main className="mx-auto mt-20 max-w-md space-y-5 rounded-xl bg-white p-8 shadow">
      <Link to="/" className="font-display text-2xl">
        LegalEase
      </Link>
      <h1 className="font-display text-3xl">
        {adminOnly ? "Administrator sign in" : "Sign in"}
      </h1>
      {location.state?.registered && (
        <p role="status">Account created. Sign in to continue.</p>
      )}
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit(async (values) => {
          setError("");
          try {
            const data = await login(values);
            if (adminOnly && !data.roles.includes("Admin")) {
              setError("This account does not have administrator access.");
              return;
            }
            signIn(data.token, data.roles);
            navigate(data.roles.includes("Admin") ? "/admin/lawyer-management" : "/", {
              replace: true,
            });
          } catch (e) {
            setError(authError(e));
          }
        })}
      >
        <Field label="Email" error={errors.email?.message}>
          <input
            autoComplete="username"
            type="email"
            className={inputClass}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input
            autoComplete="current-password"
            type="password"
            className={inputClass}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </Field>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <button disabled={isSubmitting} className={buttonClass}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-sm">
        For your security, refreshing this page signs you out.
      </p>
      <Link to={adminOnly ? "/member1/login" : "/signup"} className="underline">
        {adminOnly ? "Customer sign in" : "Create an account"}
      </Link>
    </main>
  );
}
