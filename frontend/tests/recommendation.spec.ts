import { test, expect, type Page } from "@playwright/test";
import { recommendationSchema } from "../src/features/lawyers/recommendations/schema";

const id = "11111111-1111-4111-8111-111111111111";

const lawyer = {
  lawyerId: id,
  name: "Stored Lawyer",
  status: "Active",
  experience: 8,
  specializations: [
    {
      id: 4,
      name: "Property Law",
    },
  ],
  legalServices: [
    {
      id: 2,
      name: "Property dispute",
    },
  ],
};


async function login(page: Page) {

  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      json: {
        token: "test-token",
        userId: 1,
        name: "Admin User",
        email: "admin@example.com",
        role: "Admin",
      },
    }),
  );


  await page.route("**/api/lawyer-management/search**", (route) =>
    route.fulfill({
      json: {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
      },
    }),
  );


  await page.route("**/api/specializations", (route) =>
    route.fulfill({
      json: [],
    }),
  );


  await page.route("**/api/legal-services", (route) =>
    route.fulfill({
      json: [],
    }),
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


  // Wait until login completes
  await expect(
    page.getByRole("link", {
      name: /LegalEase Admin Console/i,
    }),
  ).toBeVisible();


  // Open recommendation page directly
  await page.goto(
    "/admin/lawyer-management/recommendation-test",
  );

}


  




test(
  "recommendation page requires authentication",
  async ({ page }) => {

    await page.goto(
      "/admin/lawyer-management/recommendation-test",
    );


    await expect(page)
      .toHaveURL(/\/login$/);

  },
);



test(
  "recommendation validation rejects blank, short, oversized and invalid date inputs",
  () => {

    const valid = {
      requirement: " Property dispute ",
      date: "",
      limit: "5",
    };


    expect(
      recommendationSchema.parse(valid).requirement,
    ).toBe("Property dispute");


    for (const update of [
      {
        requirement: " ",
      },
      {
        requirement: "ab",
      },
      {
        requirement: "a".repeat(4001),
      },
      {
        date: "2030-02-30",
      },
      {
        limit: "21",
      },
    ]) {

      expect(
        recommendationSchema.safeParse({
          ...valid,
          ...update,
        }).success,
      ).toBe(false);

    }

  },
);



test(
  "examples do not submit; valid payload, loading, real fields and profile link",
  async ({ page }) => {


    let calls = 0;


    let release: () => void = () => {};


    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });



    await page.route(
      "**/api/lawyer-recommendations",
      async (route) => {

        calls++;


        expect(
          route.request().headers().authorization,
        )
          .toBe("Bearer test-token");


        expect(
          route.request().postDataJSON(),
        )
          .toEqual({
            requirement:
              "I need help with a property ownership dispute.",
            date:
              "2030-03-03",
            limit: 3,
          });


        await gate;


        await route.fulfill({
          json: {
            recommendations: [
              {
                lawyerId: id,
                score: 88,
                reason:
                  "Stored specialization matches.",
              },
            ],
            warnings: [],
            trace: [],
          },
        });

      },
    );



    await page.route(
      `**/api/lawyer-management/${id}`,
      (route) =>
        route.fulfill({
          json: lawyer,
        }),
    );


    await page.route(
      `**/api/lawyer-management/${id}/availability`,
      (route) =>
        route.fulfill({
          json: [],
        }),
    );



    await login(page);



    await page
      .getByRole("button", {
        name: "Find Suitable Lawyers",
      })
      .click();



    await expect(
      page.getByRole("alert"),
    )
      .toContainText("at least 3");



    await page
      .getByRole("button", {
        name: "Property dispute",
        exact: true,
      })
      .click();



    expect(calls)
      .toBe(0);



    await page
      .getByLabel(
        "Preferred date (optional)",
      )
      .fill("2030-03-03");



    await page
      .getByRole("combobox", {
        name: /Maximum results/,
      })
      .selectOption("3");



    await page
      .getByRole("button", {
        name: "Find Suitable Lawyers",
      })
      .click();



    await expect(
      page.getByRole("status"),
    )
      .toHaveText(
        "Analyzing your legal requirement…",
      );



    await expect(
      page.getByRole("button", {
        name: "Find Suitable Lawyers",
      }),
    )
      .toBeDisabled();



    release();



    await expect(
      page.getByRole("heading", {
        name: "Stored Lawyer",
      }),
    )
      .toBeVisible();



    await expect(
      page.getByText(
        "Stored specialization matches.",
      ),
    )
      .toBeVisible();



    await expect(
      page.getByText(
        "Recommendation score: 88",
      ),
    )
      .toBeVisible();



    await page
      .getByRole("link", {
        name: /View Lawyer/,
      })
      .click();



    await expect(page)
      .toHaveURL(
        new RegExp(
          `/admin/lawyer-management/${id}$`,
        ),
      );



    expect(calls)
      .toBe(1);

  },
);



test(
  "no date, empty results, stale inactive details, and service errors create no fallback lawyers",
  async ({ page }) => {


    let mode = "empty";



    await page.route(
      "**/api/lawyer-recommendations",
      (route) => {


        expect(
          route.request().postDataJSON(),
        )
          .not
          .toHaveProperty("date");



        if (mode === "error") {

          return route.fulfill({
            status: 503,
            json: {
              title:
                "Recommendation service is unavailable.",
            },
          });

        }



        return route.fulfill({
          json: {

            recommendations:
              mode === "inactive"
                ? [
                    {
                      lawyerId: id,
                      score: 8,
                      reason:
                        "Previously active.",
                    },
                  ]
                : [],


            warnings: [
              "Refine your requirement.",
            ],

            trace: [],

          },
        });

      },
    );



    await page.route(
      `**/api/lawyer-management/${id}`,
      (route) =>
        route.fulfill({
          json: {
            ...lawyer,
            status: "Inactive",
          },
        }),
    );



    await login(page);



    await page
      .getByRole("button", {
        name: "Property dispute",
        exact: true,
      })
      .click();



    for (const next of [
      "empty",
      "inactive",
      "error",
    ]) {


      mode = next;



      await page
        .getByRole("button", {
          name: "Find Suitable Lawyers",
        })
        .click();



      if (mode === "error") {


        await expect(
          page.getByRole("alert"),
        )
          .toHaveText(
            "Recommendation service is unavailable.",
          );


      } else {


        await expect(
          page.getByText(
            "No suitable active lawyers were found for this requirement.",
          ),
        )
          .toBeVisible();



        await expect(
          page.getByRole("article"),
        )
          .toHaveCount(0);

      }

    }

  },
);