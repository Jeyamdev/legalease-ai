import { test, expect } from "@playwright/test";

test("admin routes require sign in", async ({ page }) => {
  await page.goto("/admin/lawyer-management");

  await expect(
    page.getByRole("heading", {
      name: "Sign in to your account",
    }),
  ).toBeVisible();
});

test("create lawyer, associate catalogs, manage availability and confirm deactivation", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";

  const spec = {
    id: 2,
    name: "Family Law",
    description: "Divorce and custody",
  };

  const service = {
    id: 2,
    name: "Divorce filing",
    description: "Filing assistance",
    category: "Family Law",
  };

  let lawyer: Record<string, unknown> | undefined;
  let availability: Record<string, unknown>[] = [];
  let deactivated = false;

  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();

      let body: unknown;

      if (path === "/api/auth/login") {
        body = {
          token: "browser-test-token",
          userId: 1,
          name: "Admin User",
          email: "admin@example.com",
          role: "Admin",
        };
      } else if (path === "/api/specializations") {
        body = [spec];
      } else if (path === "/api/legal-services") {
        body = [service];
      } else if (path.endsWith("/availability") && method === "POST") {
        const values = request.postDataJSON();

        expect(values.startTime.slice(0, 5)).toBe("09:00");

        availability = [
          {
            ...values,
            startTime: "09:00:30",
            availabilityId: id,
            hasSlots: false,
          },
        ];

        body = availability[0];
      } else if (path.endsWith(`/availability/${id}`) && method === "PUT") {
        const values = request.postDataJSON();

        expect(values.startTime).toBe("09:00:30");

        availability = [
          {
            ...values,
            availabilityId: id,
            hasSlots: false,
          },
        ];

        body = availability[0];
      } else if (path.endsWith("/availability")) {
        body = availability;
      } else if (path === "/api/lawyer-management/search") {
        body = {
          items: lawyer ? [lawyer] : [],
          totalCount: lawyer ? 1 : 0,
          page: 1,
          pageSize: 20,
        };
      } else if (path === "/api/lawyer-management" && method === "POST") {
        const values = request.postDataJSON();

        expect(values.specializationIds).toEqual([2]);
        expect(values.legalServiceIds).toEqual([2]);

        lawyer = {
          ...values,
          lawyerId: id,
          specializations: [spec],
          legalServices: [service],
        };

        body = lawyer;
      } else if (path === `/api/lawyer-management/${id}` && method === "DELETE") {
        deactivated = true;

        lawyer = {
          ...lawyer,
          status: "Inactive",
        };

        await route.fulfill({
          status: 204,
        });

        return;
      } else if (path === `/api/lawyer-management/${id}`) {
        body = lawyer;
      } else {
        await route.fulfill({
          status: 404,
          json: {
            title: "Not found",
          },
        });

        return;
      }

      await route.fulfill({
        json: body,
      });
    },
  );

  await page.goto("/login");

  await page
    .getByLabel("Email Address", {
      exact: true,
    })
    .fill("admin@example.com");

  await page
    .getByLabel("Password", {
      exact: true,
    })
    .fill("test-password");

  await page
    .getByRole("button", {
      name: "Sign In",
      exact: true,
    })
    .click();

  await page.goto("/admin/lawyer-management");

  await expect(page.getByText("No lawyers match these filters.")).toBeVisible();

  await page.getByLabel("Search by name").fill("Alice");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL(/search=Alice/);

  // Wait until NameSearch has remounted using the Alice URL value.
  await expect(page.getByLabel("Search by name")).toHaveValue("Alice");

  await page.getByLabel("Search by name").fill("Bob");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL(/search=Bob/);

  // Wait for the Bob remount as well.
  await expect(page.getByLabel("Search by name")).toHaveValue("Bob");

  await page.goBack();

  await expect(page).toHaveURL(/search=Alice/);

  await page.getByRole("link", { name: "Add lawyer" }).click();
  await page.getByLabel("Full name").fill("Asha Perera");
  await page.getByLabel("Email", { exact: true }).fill("asha@example.com");
  await page.getByLabel("Phone number").fill("+94771234567");
  await page.getByLabel("Qualification").fill("LLB");
  await page.getByLabel("Years of experience").fill("8");
  await page.getByLabel("License number").fill("DEMO-LIC-1");
  await page.getByLabel("Specializations (select multiple)").selectOption("2");
  await page.getByLabel("Legal services (select multiple)").selectOption("2");
  await page.getByRole("button", { name: "Save lawyer", exact: true }).click();

  await expect(
    page.getByRole("heading", {
      name: "Asha Perera",
    }),
  ).toBeVisible();

  await page
    .getByLabel("Date", {
      exact: true,
    })
    .fill("2030-01-01");

  await page.getByLabel("Start time").fill("09:00");
  await page.getByLabel("End time").fill("10:00");
  await page
    .getByRole("button", {
      name: "Save availability",
    })
    .click();

  await expect(page.getByText("2030-01-01 · 09:00–10:00")).toBeVisible();

  await page
    .getByRole("button", {
      name: "Edit",
      exact: true,
    })
    .click();

  await expect(page.getByLabel("Start time")).toHaveValue("09:00:30");

  await page
    .getByRole("button", {
      name: "Save availability",
    })
    .click();

  await expect(page.getByRole("heading", { name: "Add period" })).toBeVisible();

  await page
    .getByRole("button", {
      name: "Deactivate",
      exact: true,
    })
    .click();

  await page
    .getByRole("button", {
      name: "Cancel",
      exact: true,
    })
    .click();

  expect(deactivated).toBe(false);

  await page
    .getByRole("button", {
      name: "Deactivate",
      exact: true,
    })
    .click();

  await page
    .getByRole("button", {
      name: "Confirm",
      exact: true,
    })
    .click();

  await expect(
    page.getByText("Inactive", {
      exact: true,
    }),
  ).toBeVisible();

  expect(deactivated).toBe(true);
});

test("login rejects a non-admin account", async ({ page }) => {
  await page.route(
    "**/api/auth/login",
    (route) =>
      route.fulfill({
        json: {
          token: "customer-test-token",
          userId: 2,
          name: "Customer User",
          email: "customer@example.com",
          role: "Customer",
        },
      }),
  );

  await page.goto("/login");

  await page
    .getByLabel("Email Address", {
      exact: true,
    })
    .fill("customer@example.com");

  await page
    .getByLabel("Password", {
      exact: true,
    })
    .fill("test-password");

  await page
    .getByRole("button", {
      name: "Sign In",
      exact: true,
    })
    .click();

  await expect(
    page.getByRole("alert"),
  ).toContainText(
    "Access denied. You are not authorised to use this portal.",
  );
});