import { api } from "./client";
import type {
  Availability,
  Catalog,
  Lawyer,
  LawyerSummary,
  Page,
} from "../types";
import type {
  LawyerFormValues,
  AvailabilityFormValues,
  CatalogFormValues,
} from "../schemas";
export const lawyersApi = {
  search: async (params: URLSearchParams, signal?: AbortSignal) =>
    (await api.get<Page<LawyerSummary>>("/lawyer-management/search", { params, signal }))
      .data,
  get: async (id: string, signal?: AbortSignal) =>
    (await api.get<Lawyer>(`/lawyer-management/${id}`, { signal })).data,
  save: async (value: LawyerFormValues, id?: string) =>
    (id
      ? await api.put<Lawyer>(`/lawyer-management/${id}`, value)
      : await api.post<Lawyer>("/lawyer-management", value)
    ).data,
  deactivate: async (id: string) => {
    await api.delete(`/lawyer-management/${id}`);
  },
  availability: async (id: string, signal?: AbortSignal) =>
    (await api.get<Availability[]>(`/lawyer-management/${id}/availability`, { signal }))
      .data,
  saveAvailability: async (
    id: string,
    value: AvailabilityFormValues,
    availabilityId?: string,
  ) => {
    const body = {
      ...value,
      startTime:
        value.startTime.length === 5
          ? `${value.startTime}:00`
          : value.startTime,
      endTime:
        value.endTime.length === 5 ? `${value.endTime}:00` : value.endTime,
    };
    return availabilityId
      ? api.put(`/lawyer-management/${id}/availability/${availabilityId}`, body)
      : api.post(`/lawyer-management/${id}/availability`, body);
  },
  deleteAvailability: async (id: string, availabilityId: string) => {
    await api.delete(`/lawyer-management/${id}/availability/${availabilityId}`);
  },
};
export type CatalogKind = "specializations" | "legal-services";
export const catalogApi = {
  list: async (kind: CatalogKind, signal?: AbortSignal) =>
    (await api.get<Catalog[]>(`/${kind}`, { signal })).data,
  save: async (kind: CatalogKind, value: CatalogFormValues, id?: number) =>
    id ? api.put(`/${kind}/${id}`, value) : api.post(`/${kind}`, value),
  remove: async (kind: CatalogKind, id: number) => {
    await api.delete(`/${kind}/${id}`);
  },
};
