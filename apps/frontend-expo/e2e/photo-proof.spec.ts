import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

const API = "http://127.0.0.1:4317";
for (const theme of ["DARK", "LIGHT"]) {
  test(`photo proof previews, removal and failed-upload recovery in ${theme}`, async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await request.patch(`${API}/users/user`, {
      headers: { Authorization: "Bearer local-e2e-token" },
      data: { themeMode: theme, themeBaseColor: "AMBER" },
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/add");
    await page.getByRole("button", { name: "Log Running", exact: true }).click();
    await page.getByRole("button", { name: "Set quantity to 45", exact: true }).click();
    await page.getByRole("button", { name: "Log Activity", exact: true }).click();
    await expect(page.getByText("📸 Add a proof!", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/photo-proof-empty-${theme}.png` });
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Add photos (optional)", exact: true }).click();
    await (await chooser).setFiles(Array.from({length: 10}, () => resolve("assets/icon.png")));
    await expect(page.getByRole("button", { name: "Remove photo 10", exact: true })).toBeVisible();
    await expect(page.getByTestId("activity-photo-upload-tile")).toHaveCount(0);
    await page.getByRole("button", { name: "Remove photo 10", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add more photos (9/10)", exact: true })).toBeVisible();
    for (let i=9; i>2; i--) await page.getByRole("button", { name: `Remove photo ${i}`, exact: true }).click();
    await page.getByLabel("Caption (optional)", { exact: true }).fill("Proof with two photos");
    await page.screenshot({ path: `test-results/photo-proof-selected-${theme}.png` });
    await request.post(`${API}/__fail`, { data: { path: "/activities/log-activity" } });
    await page.getByRole("button", { name: "Upload 2 photos", exact: true }).click();
    await expect(page.getByRole("button", { name: "Upload 2 photos", exact: true })).toBeEnabled();
    await expect(page.getByLabel("Caption (optional)", { exact: true })).toHaveValue("Proof with two photos");
    await expect(page.getByRole("button", { name: "Remove photo 2", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Upload 2 photos", exact: true }).click();
    await expect(page.getByTestId("activity-photo-step")).toHaveCount(0);
    const state = await (await request.get(`${API}/__state`)).json();
    const upload = state.requests.filter((r: any) => r.path === "/activities/log-activity").at(-1);
    expect(upload.body.description).toBe("Proof with two photos");
    expect(upload.body.uploadedPhotos).toHaveLength(2);
    expect(upload.body.uploadedPhotos.every((photo: any) => photo.size > 0 && photo.type === "image/png")).toBe(true);
  });
}
