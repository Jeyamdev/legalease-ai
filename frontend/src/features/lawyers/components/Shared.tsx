import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
import { useSession } from "../hooks/session";
export const buttonClass =
  "rounded-md bg-navy-900 px-4 py-2 text-white disabled:opacity-50";
export const inputClass =
  "w-full rounded-md border border-navy-100 bg-white p-2 text-navy-900";
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error && (
        <span role="alert" className="block text-sm text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}
export function Feedback({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error?: string;
  retry?: () => void;
}) {
  return (
    <>
      {loading && <p role="status">Loading…</p>}
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-red-800"
        >
          {error}{" "}
          {retry && (
            <button onClick={retry} className="underline">
              Try again
            </button>
          )}
        </div>
      )}
    </>
  );
}
export function ConfirmDialog({
  title,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto max-w-md rounded-xl bg-white p-6 shadow-xl backdrop:bg-navy-950/50"
    >
      <h2 id="confirm-title" className="font-display text-xl">
        {title}
      </h2>
      <div className="mt-5 flex gap-3">
        <button
          autoFocus
          disabled={busy}
          onClick={onCancel}
          className={buttonClass}
        >
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={onConfirm}
          className="rounded border border-red-700 px-4 py-2 text-red-700"
        >
          {busy ? "Saving…" : "Confirm"}
        </button>
      </div>
    </dialog>
  );
}
export function AdminLayout() {
  const session = useSession();
  if (!session.token || !session.roles.includes("Admin"))
    return <Navigate to="/admin/login" replace />;
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy-900 p-5 text-white">
        <nav
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-5"
          aria-label="Administration"
        >
          <Link className="font-display text-xl text-gold" to="/">
            LegalEase
          </Link>
          <Link to="/admin/lawyer-management">Lawyers</Link>
          <Link to="/admin/lawyer-management/specializations">Specializations</Link>
          <Link to="/admin/lawyer-management/legal-services">Legal services</Link>
          <Link to="/admin/lawyer-management/recommendation-test">AI Recommendation</Link>
          <button className="ml-auto" onClick={session.signOut}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <Outlet />
      </main>
    </div>
  );
}
