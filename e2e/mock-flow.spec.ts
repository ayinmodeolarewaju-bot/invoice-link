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
  await expect(page.getByTestId("paid-toast")).toBeVisible({ timeout: 30_000 });
  await page.waitForURL(/\/receipt\//, { timeout: 30_000 });
  await expect(page.getByText(/Simulated · not on-chain/)).toBeVisible();
  await expect(page.getByTestId("fingerprint")).toBeVisible();
  const fp = await (await page.request.get(`/api/receipt/${id}/fingerprint`)).json();
  expect(fp.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(await page.getByTestId("fingerprint").getAttribute("title")).toBe(fp.hash);
  // On-chain anchor: offered on the paid receipt, not anchored yet, and a bogus tx hash is refused.
  await expect(page.getByTestId("anchor")).toContainText(/anchor on NEAR/i);
  const a0 = await (await page.request.get(`/api/receipt/${id}/anchor`)).json();
  expect(a0).toMatchObject({ anchored: false, sha256: fp.hash });
  const bad = await page.request.post(`/api/receipt/${id}/anchor`, { data: { txHash: "nope", signer: "brook.testnet", network: "testnet" } });
  expect(bad.status()).toBe(422);

  const inv = await page.request.get(`/api/invoices/${id}`); expect(inv.ok()).toBe(true);
  expect(JSON.stringify(await inv.json())).toContain('"paid"');
  expect(errors).toEqual([]);
});
test("quote API refuses an unknown invoice", async ({ request }) => {
  const r = await request.post("/api/oneclick/quote", { data: { invoiceId: "nope", symbol: "USDC", chain: "base" } });
  expect(r.status()).toBe(404);
});

test("invoice in NEAR shows that currency on the pay page and quote", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Create pay link →")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Receive as NEAR" }).click();
  await page.getByText("Create pay link →").click();
  const link = page.getByTestId("paylink"); await expect(link).toBeVisible();
  const id = (await link.textContent())!.split("/pay/")[1].trim();
  const saved = await page.request.get(`/api/invoices/${id}`);
  expect(saved.ok()).toBe(true);
  const body = await saved.json();
  expect(body.invoice.currency).toBe("NEAR");
  expect(body.invoice.payoutChain).toBe("near");

  await page.goto(`/pay/${id}`);
  await expect(page.getByRole("heading", { name: /requested .*NEAR/ })).toBeVisible();
  await page.getByRole("button", { name: /^Pay .*NEAR/ }).click();
  await expect(page.getByText("You send")).toBeVisible();
  await expect(page.getByText(/receives/)).toBeVisible();
  await expect(page.getByText(/NEAR · NEAR/)).toBeVisible();
});
