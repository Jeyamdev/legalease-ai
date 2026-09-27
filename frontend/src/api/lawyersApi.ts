import { apiClient } from "./apiClient";

export interface LawyerSpecialization {
  specializationId: number;
  name: string;
  description: string;
}

export interface Lawyer {
  lawyerId: string;
  name: string;
  email: string;
  phoneNumber: string;
  qualification: string;
  experience: number;
  licenseNumber: string;
  profileDescription: string;
  status: string;
  specializations: LawyerSpecialization[];
}

export interface CreateLawyerPayload {
  name: string;
  email: string;
  phoneNumber?: string;
  qualification?: string;
  experience: number;
  licenseNumber: string;
  profileDescription?: string;
  category: string;
  specializationId?: number;
  password?: string;
}

export type UpdateLawyerPayload = Omit<CreateLawyerPayload, "password">;

export const lawyersApi = {
  getLawyers: async (specialization?: string, search?: string, date?: string): Promise<Lawyer[]> => {
    const params: Record<string, string> = {};
    if (specialization && specialization !== "All") params.specialization = specialization;
    if (search) params.search = search;
    if (date) params.date = date;
    const res = await apiClient.get<Lawyer[]>("/api/lawyers", { params });
    return res.data;
  },

  getSpecializations: async () => {
    const res = await apiClient.get<LawyerSpecialization[]>("/api/specializations");
    return res.data;
  },

  createLawyer: async (payload: CreateLawyerPayload): Promise<Lawyer> => {
    const res = await apiClient.post<Lawyer>("/api/lawyers", payload);
    return res.data;
  },

  updateLawyer: async (id: string, payload: UpdateLawyerPayload): Promise<Lawyer> => {
    const res = await apiClient.put<Lawyer>(`/api/lawyers/${id}`, payload);
    return res.data;
  },

  saveSpecialization: async (payload: { name: string; description: string }, id?: number) => {
    if (id) await apiClient.put(`/api/specializations/${id}`, payload);
    else await apiClient.post("/api/specializations", payload);
  },
  deleteSpecialization: async (id: number) => {
    await apiClient.delete(`/api/specializations/${id}`);
  },

  deleteLawyer: async (id: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/api/lawyers/${id}`);
    return res.data;
  },
};
