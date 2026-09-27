import { test, expect } from "@playwright/test";
import {
  availabilitySchema,
  lawyerSchema,
} from "../src/features/lawyers/schemas";

test("availability rejects invalid clock values and equivalent start/end times", () => {
  for (const [startTime, endTime] of [
    ["25:00", "26:00"],
    ["09:70", "10:00"],
    ["09:00", "09:00:00"],
    ["09:00:60", "10:00"],
  ]) {
    expect(
      availabilitySchema.safeParse({ date: "2030-01-01", startTime, endTime })
        .success,
    ).toBe(false);
  }
  expect(
    availabilitySchema.safeParse({
      date: "2030-01-01",
      startTime: "09:00:30",
      endTime: "10:00:45",
    }).success,
  ).toBe(true);
});

test("lawyer form enforces the API association limit", () => {
  const values = {
    name: "Test",
    email: "test@example.com",
    phoneNumber: "+94771234567",
    qualification: "LLB",
    experience: 1,
    licenseNumber: "TEST",
    profileDescription: "",
    status: "Active",
    specializationIds: Array.from({ length: 101 }, (_, i) => i + 1),
    legalServiceIds: [],
  };
  expect(lawyerSchema.safeParse(values).success).toBe(false);
});

test("phone validation rejects punctuation without digits", () => {
  expect(lawyerSchema.shape.phoneNumber.safeParse("-----").success).toBe(false);
  expect(lawyerSchema.shape.phoneNumber.safeParse("+94771234567").success).toBe(
    true,
  );
});
