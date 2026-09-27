import { useState } from "react";
import axios from "axios";
import { lawyersApi, type LawyerSpecialization } from "../../api/lawyersApi";

export function SpecializationManager({ items, onChanged }: { items: LawyerSpecialization[]; onChanged: () => Promise<void> }) {
  const [id, setId] = useState<number>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(""); setSuccess("");
    try { await operation(); await onChanged(); setId(undefined); setName(""); setDescription(""); setSuccess("Specializations updated."); }
    catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.message || "Unable to save specialization." : "Unable to save specialization."); }
    finally { setBusy(false); }
  };
  return <section className="mb-6 rounded-xl border bg-white p-5">
    <h2 className="text-lg font-bold">Manage specializations</h2>
    <p className="text-sm text-slate-500">Specializations in use cannot be deleted.</p>
    <ul className="my-3 divide-y">{items.map(item => <li key={item.specializationId} className="flex justify-between gap-4 py-3">
      <div><strong>{item.name}</strong><p className="text-sm text-slate-600">{item.description || "No description recorded."}</p></div>
      <div className="flex gap-3">
        <button disabled={busy} onClick={() => { setId(item.specializationId); setName(item.name); setDescription(item.description); setError(""); }}>Edit</button>
        <button disabled={busy} className="text-red-700" onClick={() => {
          if (window.confirm(`Delete ${item.name}?`)) void run(() => lawyersApi.deleteSpecialization(item.specializationId));
        }}>Delete</button>
      </div>
    </li>)}</ul>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(() => lawyersApi.saveSpecialization({ name: name.trim(), description: description.trim() }, id)); }}>
      <label className="block">Name<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} className="ml-3 rounded border p-2" /></label>
      <label className="block">Description<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
      <button disabled={busy || !name.trim()} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{busy ? "Saving…" : id ? "Save specialization" : "Add specialization"}</button>
      {id && <button type="button" disabled={busy} className="ml-3" onClick={() => { setId(undefined); setName(""); setDescription(""); }}>Cancel edit</button>}
    </form>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    {success && <p role="status" className="mt-3 text-green-700">{success}</p>}
  </section>;
}
