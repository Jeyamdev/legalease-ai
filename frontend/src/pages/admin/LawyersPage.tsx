import axios from "axios";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Search } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { LawyerIdentity } from "../../components/lawyers/LawyerIdentity";
import { LawyerPagination } from "../../components/lawyers/LawyerPagination";
import {
  lawyersApi,
  type Lawyer,
  type CreateLawyerPayload,
  type LawyerPageFilters,
  type PagedLawyers,
  type LawyerSpecialization,
  type LawyerServicesSummary,
} from "../../api/lawyersApi";
import { lastLawyerPage, resetLawyerPage } from "../../components/lawyers/lawyerPageUtils";

const errorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback;
  if (error.response?.status === 401) return "Your session is no longer valid. Sign in again before saving.";
  if (error.response?.status === 403) return "An administrator account is required to manage lawyers.";
  if (!error.response) return "Unable to reach the backend. Check your connection and try again.";
  return error.response.data?.message || Object.values(error.response.data?.errors ?? {}).flat().join(" ") || fallback;
};

export const LawyersPage: React.FC = () => {
  const moduleSummary = useOutletContext<LawyerServicesSummary | null>();
  const loadVersion = useRef(0);
  const [directory, setDirectory] = useState<PagedLawyers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [specializations, setSpecializations] = useState<LawyerSpecialization[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [editingLawyer, setEditingLawyer] = useState<Lawyer | null>(null);
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState<LawyerPageFilters>({ page: 1, pageSize: 10 });
  const [searchInput, setSearchInput] = useState("");

  // Add Lawyer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateLawyerPayload>({
    name: "",
    email: "",
    phoneNumber: "",
    qualification: "LL.B Attorney-at-Law",
    experience: 5,
    licenseNumber: "",
    profileDescription: "",
    category: (specializations[0]?.name ?? ""),
    password: "LawyerPassword123!",
  });

  // Delete Dialog
  const [deletingLawyer, setDeletingLawyer] = useState<Lawyer | null>(null);
  const [deleteProcessing, setDeleteProcessing] = useState(false);

  const refreshCatalog = useCallback(async () => {
    try {
      setSpecializations(await lawyersApi.getSpecializations());
      setCatalogError("");
    } catch {
      setCatalogError("Unable to load practice categories.");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const fetchLawyers = useCallback(async () => {
    const version = ++loadVersion.current;
    let movingToLastPage = false;
    try {
      setLoading(true);
      setError(null);
      const data = await lawyersApi.getPagedLawyers(filters);
      if (version !== loadVersion.current) return;
      if (filters.page > lastLawyerPage(data.totalPages)) {
        movingToLastPage = true;
        setFilters(current => ({ ...current, page: lastLawyerPage(data.totalPages) }));
        return;
      }
      setDirectory(data);
    } catch (err: unknown) {
      if (version !== loadVersion.current) return;
      setError(errorMessage(err, "Unable to load lawyers."));
    } finally {
      if (version === loadVersion.current && !movingToLastPage) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void Promise.resolve().then(fetchLawyers);
  }, [fetchLawyers]);

  useEffect(() => { void Promise.resolve().then(refreshCatalog); }, [refreshCatalog]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const search = searchInput.trim();
      setFilters(current => (current.search ?? "") === search ? current : resetLawyerPage(current, { search: search || undefined }));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const changeFilters = (changes: Partial<LawyerPageFilters>) => {
    setFilters(current => resetLawyerPage(current, { ...changes, search: searchInput.trim() || undefined }));
  };

  const openAddModal = (category = specializations[0]?.name ?? "") => {
    setFormError(null);
    setEditingLawyer(null);
    setFormData({ name: "", email: "", phoneNumber: "", qualification: "", experience: 0,
      licenseNumber: "", profileDescription: "", category, password: "" });
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError("Lawyer full name is required.");
      return;
    }
    if (!formData.email.trim()) {
      setFormError("Valid email address is required.");
      return;
    }
    if (!formData.licenseNumber.trim()) {
      setFormError("Bar admission or license number is required.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = { ...formData, experience: Number(formData.experience),
        specializationId: specializations.find(s => s.name === formData.category)?.specializationId };
      if (editingLawyer) {
        const update = { name: payload.name, email: payload.email, phoneNumber: payload.phoneNumber,
          qualification: payload.qualification, experience: payload.experience, licenseNumber: payload.licenseNumber,
          profileDescription: payload.profileDescription, category: payload.category, specializationId: payload.specializationId };
        await lawyersApi.updateLawyer(editingLawyer.lawyerId, update);
      } else await lawyersApi.createLawyer(payload);
      setSuccess(editingLawyer ? "Lawyer updated successfully." : "Lawyer created successfully.");
      setEditingLawyer(null);

      setIsAddModalOpen(false);
      setFormData({
        name: "",
        email: "",
        phoneNumber: "",
        qualification: "LL.B Attorney-at-Law",
        experience: 5,
        licenseNumber: "",
        profileDescription: "",
        category: (specializations[0]?.name ?? ""),
        password: "LawyerPassword123!",
      });

      await Promise.all([fetchLawyers(), refreshCatalog()]);
    } catch (err: unknown) {
      setFormError(errorMessage(err, "Failed to save lawyer."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingLawyer) return;
    try {
      setDeleteProcessing(true);
      await lawyersApi.deleteLawyer(deletingLawyer.lawyerId);
      setDeletingLawyer(null);
      setSuccess("Lawyer deleted successfully.");
      await Promise.all([fetchLawyers(), refreshCatalog()]);
    } catch (err: unknown) {
      alert(errorMessage(err, "Failed to delete lawyer."));
    } finally {
      setDeleteProcessing(false);
    }
  };

  return (
    <>
      {success && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-green-800">{success}</p>}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Lawyers</h2>
          <p className="mt-1 text-sm text-slate-500">Manage registered legal practitioners, profiles and availability</p>
          <p className="mt-2 text-xs font-semibold text-slate-600">
            {moduleSummary?.activeLawyers ?? "..."} Active Lawyers
            <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
            {moduleSummary?.totalLawyers ?? directory?.totalLawyers ?? "..."} Total Records
            <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
            {catalogLoading || catalogError ? "..." : specializations.length} Practice Areas
          </p>
        </div>
        <button type="button" onClick={() => openAddModal()} disabled={!specializations.length}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50">
          <Plus size={16} aria-hidden="true" />Add New Lawyer
        </button>
      </div>

      <section aria-label="Lawyer filters" className="mb-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="text-sm font-bold text-slate-800">Practice Areas</h3>
        {catalogError && <p role="alert" className="mt-2 text-xs text-red-700">{catalogError} <button type="button" onClick={() => void refreshCatalog()} className="underline">Retry</button></p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" aria-pressed={!filters.specialization} onClick={() => changeFilters({ specialization: undefined })}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${!filters.specialization ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            All Practice Areas ({error ? "..." : directory?.totalLawyers ?? "..."})
          </button>
          {specializations.map(category => (
            <button key={category.specializationId} type="button" aria-pressed={filters.specialization === String(category.specializationId)}
              onClick={() => changeFilters({ specialization: String(category.specializationId) })}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${filters.specialization === String(category.specializationId) ? "bg-amber-500 text-slate-950" : category.lawyerCount === 0 ? "bg-slate-100 text-slate-400 hover:bg-slate-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {category.name} ({category.lawyerCount ?? "..."})
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block min-w-0">
            <span className="sr-only">Search lawyers</span>
            <span className="relative block">
              <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Search lawyers by name, license number, qualifications..."
                className="w-full rounded-md border border-slate-300 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" />
            </span>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-600 md:justify-start">
            Available on
            <input type="date" value={filters.date ?? ""} onChange={e => changeFilters({ date: e.target.value || undefined })}
              className="min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none" />
          </label>
        </div>
      </section>

      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <span>{error}</span>
        <button type="button" onClick={() => void fetchLawyers()} className="rounded-md border border-red-300 px-3 py-1.5 font-semibold hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Retry</button>
      </div>}
      {loading && !directory ? (
        <div role="status" className="flex min-h-48 items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" aria-hidden="true" />Loading lawyer directory...
        </div>
      ) : error ? null : directory && directory.items.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
          {loading ? <p role="status" className="text-sm text-slate-500">Updating lawyer directory...</p> : <>
            <h3 className="text-base font-bold text-slate-800">No lawyers found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {directory.totalLawyers === 0 ? "No lawyers have been registered yet." : "Try changing the search, Practice Area or availability date."}
            </p>
            {directory.totalLawyers === 0 && specializations.length > 0 && <button type="button" onClick={() => openAddModal()} className="mt-4 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-600">Add New Lawyer</button>}
          </>}
        </div>
      ) : directory ? (
        <div aria-busy={loading} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {loading && <p role="status" className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">Updating lawyer directory...</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Counsel Details</th>
                  <th className="py-3.5 px-4">Practice Area</th>
                  <th className="py-3.5 px-4">Experience & Bar #</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {directory.items.map((lawyer) => {
                  const categoryName =
                    lawyer.specializations.length > 0
                      ? lawyer.specializations[0].name
                      : "General Counsel";

                  return (
                    <tr key={lawyer.lawyerId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-900 text-amber-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
                            {lawyer.name.trim() ? lawyer.name.trim()[0] : "L"}
                          </div>
                          <div>
                            <LawyerIdentity lawyer={lawyer} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {categoryName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-slate-800">
                          {lawyer.experience} yrs experience
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {lawyer.licenseNumber}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-slate-800 font-medium">{lawyer.email || "No email"}</div>
                        <div className="text-xs text-slate-500">{lawyer.phoneNumber || "No phone"}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button onClick={() => {
                          setEditingLawyer(lawyer); setFormError(null);
                          setFormData({ ...lawyer, category: lawyer.specializations[0]?.name ?? "", password: undefined });
                          setIsAddModalOpen(true);
                        }} className="rounded px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-amber-600">Edit</button>
                        <button
                          onClick={() => setDeletingLawyer(lawyer)}
                          className="rounded px-2.5 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <LawyerPagination page={directory.page} pageSize={directory.pageSize} totalItems={directory.totalItems}
            totalPages={directory.totalPages} loading={loading}
            onPageChange={page => setFilters(current => ({ ...current, page }))}
            onPageSizeChange={pageSize => changeFilters({ pageSize })} />
        </div>
      ) : null}

      {/* Add Lawyer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">{editingLawyer ? "Edit Legal Counsel" : "Add New Legal Counsel"}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingLawyer ? "Update profile and login email; account permissions and password stay unchanged." : "Assign practitioner to one Practice Area and create their portal credentials"}
                </p>
              </div>
              <button
                disabled={submitting}
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name & Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Advocate Nimal Fernando"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address (Login Username) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="lawyer@legalease.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+94 77 123 4567"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* LAWYER CATEGORY (STRICT SINGLE SELECTION) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Authorized Practice Area (One Area) *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-amber-300 bg-amber-50/40 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="" disabled>Select Practice Area</option>
                  {specializations.map(s => s.name).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Lawyer will be listed under this Practice Area for client searches and consultations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Qualification
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LL.B (Hons), Attorney-at-Law"
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Years Exp.
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="70"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Bar / License Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="SC/AT/2020/1234"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                {!editingLawyer && <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Initial Portal Password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={formData.password ?? ""}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Professional Profile Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of experience, trial history, corporate advisory background..."
                  value={formData.profileDescription}
                  onChange={(e) => setFormData({ ...formData, profileDescription: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={submitting}
                onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingLawyer ? "Save Changes" : "Confirm & Add Lawyer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLawyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">Remove Legal Counsel</h3>
            <p className="text-xs text-slate-600 mt-2">
              Are you sure you want to remove <strong>{deletingLawyer.name}</strong> from the system?
              Their directory profile and Practice Area assignment will be removed. Existing accounts are retained; lawyers with appointment history cannot be deleted.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingLawyer(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteProcessing}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
              >
                {deleteProcessing ? "Removing..." : "Delete Lawyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
