import { z } from "zod";
export const lawyerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.email().max(254),
  phoneNumber: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .regex(/^(?=.*\d)[+\d() .-]+$/, "Enter a valid phone number"),
  qualification: z.string().trim().min(1).max(500),
  experience: z.number().int().min(0).max(100),
  licenseNumber: z.string().trim().min(1).max(100),
  profileDescription: z.string().max(5000),
  status: z.enum(["Active", "Inactive", "Suspended"]),
  specializationIds: z.array(z.number().int().positive()).max(100),
  legalServiceIds: z.array(z.number().int().positive()).max(100),
  userId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || undefined),
});
export type LawyerFormValues = z.output<typeof lawyerSchema>;
function timeValue(value: string): number {
  const [hours, minutes, seconds = "0"] = value.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}
export const availabilitySchema = z
  .object({
    date: z.iso.date(),
    startTime: z
      .string()
      .regex(
        /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,7})?)?$/,
        "Enter a valid time",
      ),
    endTime: z
      .string()
      .regex(
        /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,7})?)?$/,
        "Enter a valid time",
      ),
  })
  .refine((v) => timeValue(v.startTime) < timeValue(v.endTime), {
    message: "End time must be after start time",
    path: ["endTime"],
  });
export type AvailabilityFormValues = z.infer<typeof availabilitySchema>;
export const catalogSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000),
  category: z.string().max(200),
});
export type CatalogFormValues = z.infer<typeof catalogSchema>;
