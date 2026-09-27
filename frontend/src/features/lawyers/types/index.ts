export type Catalog = {
  id: number;
  name: string;
  description: string;
  category?: string;
};
export type LawyerSummary = {
  lawyerId: string;
  name: string;
  experience: number;
  status: string;
  specializations: Catalog[];
  legalServices: Catalog[];
};
export type Lawyer = LawyerSummary & {
  email: string;
  phoneNumber: string;
  qualification: string;
  licenseNumber: string;
  profileDescription: string;
};
export type Availability = {
  availabilityId: string;
  date: string;
  startTime: string;
  endTime: string;
  hasSlots: boolean;
};
export type Page<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};
