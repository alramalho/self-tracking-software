import { test, expect } from "@playwright/test";
const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"]) {
  test(`comments sheet, reply, draft, send and delete in ${theme}`, async ({
    page,
    request,
  }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme },
    });
    await request.post(`${API}/__timeline-design`);
    await page.goto("/?activityEntryId=joint-b");
    await page
      .getByRole("button", { name: "Comments (1)", exact: true })
      .click();
    const sheet = page.getByTestId("comments-sheet");
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByText("Great morning!", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => (await sheet.boundingBox())?.y)
      .toBeLessThan(page.viewportSize()!.height * 0.5);
    const box = await sheet.boundingBox();
    expect(box!.y).toBeGreaterThan(page.viewportSize()!.height * 0.3);
    await page.screenshot({
      path: `test-results/comments-${theme.toLowerCase()}.png`,
    });
    await sheet.getByRole("button", { name: /Reply to/ }).click();
    await expect(page.getByTestId("comment-input")).toHaveValue(/@\w+ /);
    await page.getByTestId("comment-input").fill("Great ride together");
    await page
      .getByRole("button", { name: "Close comments", exact: true })
      .click();
    await expect(sheet).not.toBeVisible();
    await page
      .getByRole("button", { name: "Comments (1)", exact: true })
      .click();
    await expect(page.getByTestId("comment-input")).toHaveValue(
      "Great ride together",
    );
    await page
      .getByRole("button", { name: "Post Comment", exact: true })
      .click();
    await expect(
      sheet.getByText("Great ride together", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("comment-input")).toHaveValue("");
    await sheet
      .getByRole("button", { name: "Delete comment", exact: true })
      .click();
    await sheet
      .getByRole("button", { name: "Confirm delete comment", exact: true })
      .click();
    await expect(
      sheet.getByText("Great ride together", { exact: true }),
    ).not.toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible();
    await page
      .getByRole("button", { name: "Comments (1)", exact: true })
      .click();
    await expect(sheet).toBeVisible();
    await page
      .getByLabel("Dismiss comments", { exact: true })
      .click({ position: { x: 10, y: 10 } });
    await expect(sheet).not.toBeVisible();
    const state = await (await request.get(`${API}/__state`)).json();
    const sent = state.requests.filter(
      (r: any) => r.method === "POST" && r.path.endsWith("/comments"),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].path).toBe("/activities/activity-entries/joint-b/comments");
    expect(sent[0].body.text).toBe("Great ride together");
  });
}

test("empty comments keep a failed draft and retry only once", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await page.goto("/?activityEntryId=entry-run");
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  await expect(
    page.getByText("No comments yet", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Post Comment", exact: true }),
  ).toBeDisabled();
  await page.getByTestId("comment-input").fill("Keep this draft on failure");
  await request.post(`${API}/__fail`, {
    data: { path: "/activities/activity-entries/entry-run/comments" },
  });
  await page.getByRole("button", { name: "Post Comment", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Couldn't post");
  await expect(page.getByTestId("comment-input")).toHaveValue(
    "Keep this draft on failure",
  );
  await page.getByRole("button", { name: "Post Comment", exact: true }).click();
  await expect(
    page
      .getByTestId("comments-sheet")
      .getByText("Keep this draft on failure", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("comment-input")).toHaveValue("");
  const state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.entries.find((entry: any) => entry.id === "entry-run").comments,
  ).toHaveLength(1);
});

test("a long conversation scrolls while the composer stays pinned", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  for (let i = 0; i < 25; i++)
    await request.post(
      `${API}/activities/activity-entries/entry-run/comments`,
      {
        headers: { Authorization: "Bearer local-e2e-token" },
        data: { text: `Comment number ${i}` },
      },
    );
  await page.goto("/?activityEntryId=entry-run");
  await page
    .getByRole("button", { name: "Comments (25)", exact: true })
    .click();
  const input = page.getByTestId("comment-input");
  await expect
    .poll(
      async () => (await page.getByTestId("comments-sheet").boundingBox())?.y,
    )
    .toBeLessThan(page.viewportSize()!.height * 0.5);
  const sheetBox = (await page.getByTestId("comments-sheet").boundingBox())!;
  await page.mouse.move(195, sheetBox.y - 10);
  await page.mouse.down();
  await page.mouse.move(195, 30, { steps: 20 });
  await page.mouse.up();
  await expect
    .poll(
      async () => (await page.getByTestId("comments-sheet").boundingBox())?.y,
    )
    .toBeLessThan(100);
  const before = await input.boundingBox();
  await page
    .getByTestId("comments-sheet")
    .getByText("Comment number 24", { exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page
      .getByTestId("comments-sheet")
      .getByText("Comment number 24", { exact: true }),
  ).toBeVisible();
  const after = await input.boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
  await expect(input).toBeInViewport();
});

test("achievement comments use the post endpoint and production ownership shape", async ({
  page,
  request,
}) => {
  await request.post(`${API}/__reset`);
  await request.post(`${API}/__achievement`);
  await page.goto("/");
  const card = page
    .getByTestId("feed-card")
    .filter({ hasText: "My first habit" });
  await card.getByRole("button", { name: "Comments", exact: true }).click();
  await page.getByTestId("comment-input").fill("Congratulations");
  await page.getByRole("button", { name: "Post Comment", exact: true }).click();
  const sheet = page.getByTestId("comments-sheet");
  await expect(
    sheet.getByText("Congratulations", { exact: true }),
  ).toBeVisible();
  await sheet
    .getByRole("button", { name: "Delete comment", exact: true })
    .click();
  await sheet
    .getByRole("button", { name: "Confirm delete comment", exact: true })
    .click();
  await expect(
    sheet.getByText("Congratulations", { exact: true }),
  ).not.toBeVisible();
  const state = await (await request.get(`${API}/__state`)).json();
  expect(
    state.requests.some(
      (r: any) =>
        r.method === "POST" &&
        r.path === "/achievements/achievement-test/comments",
    ),
  ).toBe(true);
  expect(state.achievements[0].comments).toHaveLength(0);
});
