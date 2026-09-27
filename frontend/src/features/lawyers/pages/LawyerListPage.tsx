import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { catalogApi, lawyersApi } from "../api/lawyers";
import { useResource } from "../hooks/useResource";
import { buttonClass, Feedback, Field, inputClass } from "../components/Shared";
export default function LawyerListPage() {
  const [params, setParams] = useSearchParams();
  const key = params.toString();
  const resource = useResource(
    useCallback(
      (signal: AbortSignal) =>
        lawyersApi.search(new URLSearchParams(key), signal),
      [key],
    ),
  );
  const catalogs = useResource(
    useCallback(
      async (signal: AbortSignal) => ({
        specs: await catalogApi.list("specializations", signal),
        services: await catalogApi.list("legal-services", signal),
      }),
      [],
    ),
  );
  const change = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== "page") next.set("page", "1");
    setParams(next);
  };
  const data = resource.data;
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Lawyer management</h1>
        <Link to="new" className={buttonClass}>
          Add lawyer
        </Link>
      </div>
      <NameSearch
        key={params.get("search") || ""}
        value={params.get("search") || ""}
        onSearch={(value) => change("search", value)}
      />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Specialization">
          <select
            className={inputClass}
            value={params.get("specializationId") || ""}
            onChange={(e) => change("specializationId", e.target.value)}
          >
            <option value="">All</option>
            {catalogs.data?.specs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Legal service">
          <select
            className={inputClass}
            value={params.get("legalServiceId") || ""}
            onChange={(e) => change("legalServiceId", e.target.value)}
          >
            <option value="">All</option>
            {catalogs.data?.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Minimum experience">
          <input
            type="number"
            min="0"
            max="100"
            className={inputClass}
            value={params.get("minExperience") || ""}
            onChange={(e) => change("minExperience", e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className={inputClass}
            value={params.get("status") || ""}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="">All</option>
            {["Active", "Inactive", "Suspended"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Available date">
          <input
            type="date"
            className={inputClass}
            value={params.get("date") || ""}
            onChange={(e) => change("date", e.target.value)}
          />
        </Field>
        <Field label="Sort">
          <select
            className={inputClass}
            value={params.get("sort") || "name"}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="name">Name</option>
            <option value="experience_desc">Most experienced</option>
            <option value="experience">Least experienced</option>
          </select>
        </Field>
      </div>
      <Feedback {...catalogs} retry={catalogs.reload} />
      <Feedback {...resource} retry={resource.reload} />
      {data && (
        <>
          <p>{data.totalCount} lawyers found</p>
          {!data.items.length ? (
            <p className="rounded bg-white p-8">
              No lawyers match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-white">
              <table className="w-full text-left">
                <thead className="bg-navy-50">
                  <tr>
                    {[
                      "Lawyer",
                      "Experience",
                      "Status",
                      "Specializations",
                      "Services",
                      "Actions",
                    ].map((h) => (
                      <th className="p-4" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((l) => (
                    <tr key={l.lawyerId} className="border-t border-navy-50">
                      <td className="p-4 font-semibold">{l.name}</td>
                      <td className="p-4">{l.experience} years</td>
                      <td className="p-4">
                        <span
                          className={
                            l.status === "Active"
                              ? "text-green-800"
                              : "text-slate-600"
                          }
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {l.specializations.map((s) => s.name).join(", ") ||
                          "None"}
                      </td>
                      <td className="p-4">
                        {l.legalServices.map((s) => s.name).join(", ") ||
                          "None"}
                      </td>
                      <td className="p-4">
                        <Link className="underline" to={l.lawyerId}>
                          View / manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav aria-label="Pagination" className="flex items-center gap-4">
            <button
              className={buttonClass}
              disabled={data.page === 1}
              onClick={() => change("page", String(data.page - 1))}
            >
              Previous
            </button>
            <span>
              Page {data.page} of{" "}
              {Math.max(1, Math.ceil(data.totalCount / data.pageSize))}
            </span>
            <button
              className={buttonClass}
              disabled={data.page * data.pageSize >= data.totalCount}
              onClick={() => change("page", String(data.page + 1))}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </>
  );
}

function NameSearch({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (value: string) => void;
}) {
  const [search, setSearch] = useState(value);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(search);
      }}
      className="flex items-end gap-3"
    >
      <Field label="Search by name">
        <input
          className={inputClass}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Field>
      <button className={buttonClass}>Search</button>
    </form>
  );
}
