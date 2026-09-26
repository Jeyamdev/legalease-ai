import { test, expect } from "@playwright/test";
import { loginSchema, registerSchema } from "../src/features/auth/schemas";

test("registration validation matches backend and confirms password", () => {
  const valid = {
    fullName: "Customer",
    email: "user@example.com",
    password: "valid-password",
    confirmPassword: "valid-password",
  };
  expect(registerSchema.safeParse(valid).success).toBe(true);
  for (const update of [
    { fullName: " " },
    { email: "bad" },
    { password: "short", confirmPassword: "short" },
    { confirmPassword: "different" },
    { password: "x".repeat(73) },
  ])
    expect(registerSchema.safeParse({ ...valid, ...update }).success).toBe(
      false,
    );
  expect(
    loginSchema.safeParse({ email: valid.email, password: "older-short" })
      .success,
  ).toBe(true);
});

test("sign up validates before requests and displays backend duplicate errors", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/member1/auth/register", async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({
      fullName: "Customer",
      email: "user@example.com",
      password: "valid-password",
      role: "Customer",
    });
    await route.fulfill({
      status: 400,
      contentType: "text/plain",
      body: "Email already exists",
    });
  });
  await page.goto("/signup");
  await page.getByRole("button", { name: "Sign Up", exact: true }).click();
  await expect(page.getByText("Full name is required.")).toBeVisible();
  expect(calls).toBe(0);
  await page.getByLabel(/^Full name/).fill("Customer");
  await page.getByLabel(/^Email/).fill("user@example.com");
  await page.getByLabel(/^Password/).fill("valid-password");
  await page.getByLabel(/^Confirm password/).fill("valid-password");
  await page.getByRole("button", { name: "Sign Up", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "An account with this email already exists. Please sign in.",
  );
  expect(calls).toBe(1);
});

test("login reports invalid credentials and network failures cleanly", async ({
  page,
}) => {
  await page.route("**/api/member1/auth/login", (route) =>
    route.fulfill({ status: 401 }),
  );
  await page.goto("/member1/login");
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Invalid email or password.",
  );
  await page.route("**/api/member1/auth/login", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Unable to connect to the server. Please try again.",
  );
});
