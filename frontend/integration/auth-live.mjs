// Opt-in live development-server check. No HTTP mocks; creates a labelled Customer.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chromium, expect } from "@playwright/test";
const adminEmail = process.env.MEMBER1_ADMIN_EMAIL;
const adminPassword = process.env.MEMBER1_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword)
  throw new Error(
    "Supply private demo Admin credentials through the environment.",
  );
const browser = await chromium.launch();
const page = await browser.newPage();
const origin = process.env.MEMBER1_WEB_URL || "http://127.0.0.1:5173";
const email = `auth-browser-${Date.now()}@local.example`;
const password = randomBytes(24).toString("base64url");
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const submit = async (path, button) => {
  const pending = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/auth/${path}`) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: button, exact: true }).click();
  return pending;
};
const fillLogin = async (emailValue, passwordValue) => {
  await page.getByLabel("Email", { exact: true }).fill(emailValue);
  await page.getByLabel("Password", { exact: true }).fill(passwordValue);
};
const navigateInApp = async (path) =>
  page.evaluate((path) => {
    history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
try {
  await page.goto(origin);
  await page
    .getByRole("link", { name: "Sign Up", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Create an account" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign Up", exact: true }).click();
  await expect(page.getByText("Full name is required.")).toBeVisible();
  await page.getByLabel(/^Full name/).fill("Auth browser integration fixture");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel(/^Confirm password/).fill(password);
  const registration = await submit("register", "Sign Up");
  assert.equal(registration.status(), 200);
  const registered = await registration.json();
  assert.equal(registered.role, "Customer");
  assert.deepEqual(Object.keys(registration.request().postDataJSON()).sort(), [
    "email",
    "fullName",
    "password",
    "role",
  ]);
  await expect(page).toHaveURL(origin + "/member1/login");
  await expect(page.getByRole("status")).toContainText("Account created");
  await fillLogin(email, "invalid-password");
  assert.equal((await submit("login", "Sign in")).status(), 401);
  await expect(page.getByRole("alert")).toHaveText(
    "Invalid email or password.",
  );
  await fillLogin(email, password);
  const login = await submit("login", "Sign in");
  assert.equal(login.status(), 200);
  assert.ok((await login.json()).token);
  await expect(page).toHaveURL(origin + "/");
  await expect(
    page.getByText("Signed in", { exact: true }).first(),
  ).toBeVisible();
  await navigateInApp("/admin/lawyer-management");
  await expect(page).toHaveURL(origin + "/admin/login");
  await fillLogin(email, password);
  assert.equal((await submit("login", "Sign in")).status(), 200);
  await expect(page.getByRole("alert")).toContainText(
    "does not have administrator access",
  );
  await navigateInApp("/");
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(origin + "/member1/login");
  await page.goto(origin + "/signup");
  await page.getByLabel("Full name").fill("Auth browser integration fixture");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  assert.equal((await submit("register", "Sign Up")).status(), 400);
  await expect(page.getByRole("alert")).toContainText("already exists");
  await page.goto(origin + "/member1/login");
  await fillLogin(adminEmail, adminPassword);
  const search = page.waitForRequest((r) =>
    r.url().includes("/api/lawyer-management/search"),
  );
  assert.equal((await submit("login", "Sign in")).status(), 200);
  assert.match((await search).headers().authorization || "", /^Bearer .+/);
  await expect(page).toHaveURL(origin + "/admin/lawyer-management");
  await expect(
    page.getByRole("heading", { name: "Lawyer management" }),
  ).toBeVisible();
  await navigateInApp("/admin");
  await expect(page).toHaveURL(origin + "/admin/lawyer-management");
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  await page.reload();
  await expect(page).toHaveURL(origin + "/admin/login");
  await fillLogin(adminEmail, adminPassword);
  assert.equal((await submit("login", "Sign in")).status(), 200);
  await expect(
    page.getByRole("heading", { name: "Lawyer management" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(origin + "/admin/login");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: live Customer signup/login, duplicate/invalid handling, logout, Customer/Admin guards, Admin login via both routes, Bearer attachment, refresh policy; no browser errors.",
  );
  console.log("Registered Customer fixture ID:", registered.userId);
} finally {
  await browser.close();
}
