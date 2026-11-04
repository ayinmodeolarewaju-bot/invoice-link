import { expect, test } from "@playwright/test";
// Builder -> pay link -> quote -> deposit -> simulated payment -> receipt, all in mock mode.
test("freelancer creates a link and the client pays it (mock mode)", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page.getByText("Connect NEAR wallet")).toBeVisible({ timeout: 30_000 });
  await page.getByText("Create pay link →").click();
  const link = page.getByTestId("paylink"); await expect(link).toBeVisible();
  const id = (await link.textContent())!.split("/pay/")[1].trim();
  expect(id).toBeTruthy();

  await page.goto(`/pay/${id}`);
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(page.getByText("You send")).toBeVisible();
  await page.getByRole("button", { name: "Get deposit address" }).click();
  await expect(page.getByText("Send exactly")).toBeVisible();
  await page.getByRole("button", { name: /Simulate deposit/ }).click();
  await expect(page.getByText("Payment in progress")).toBeVisible();
  await page.waitForURL(/\/receipt\//, { timeout: 30_000 });
  await expect(page.getByText(/Simulated · not on-chain/)).toBeVisible();

  const inv = await page.request.get(`/api/invoices/${id}`); expect(inv.ok()).toBe(true);
  expect(JSON.stringify(await inv.json())).toContain('"paid"');
  expect(errors).toEqual([]);
});
test("quote API refuses an unknown invoice", async ({ request }) => {
  const r = await request.post("/api/oneclick/quote", { data: { invoiceId: "nope", symbol: "USDC", chain: "base" } });
  expect(r.status()).toBe(404);
});
