"use strict";

const { test, expect } = require("@playwright/test");

function collectErrors(page) {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("renders core UI with no console or page errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.locator("#rankName")).not.toBeEmpty();
  await expect(page.locator("nav.tabs .tab").first()).toBeVisible();
  const tabs = await page.locator("nav.tabs .tab").count();
  expect(tabs).toBeGreaterThanOrEqual(10);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("local storage saves and survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-action="gather"]').click();
  const raw = await page.evaluate(() => localStorage.getItem("murim_cultivation_save_v3"));
  expect(raw).toBeTruthy();
  await page.reload();
  const qi = await page.evaluate(() => JSON.parse(localStorage.getItem("murim_cultivation_save_v3")).qi);
  expect(qi).toBeGreaterThan(0);
});

test("every tab switches and core actions do not throw", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  const tabs = ["quests", "world", "techniques", "skills", "equipment", "faction", "clan", "sect", "journal", "info"];
  for (const t of tabs) {
    await page.locator(`.tab[data-tab="${t}"]`).click();
    await expect(page.locator(`[data-panel="${t}"]`)).toBeVisible();
  }
  await page.locator('[data-action="gather"]').click();
  await page.locator('[data-action="explore"]').click();
  await page.locator('[data-action="rest"]').click();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("layout collapses to one column on a narrow viewport", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 780 });
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector(".grid")).gridTemplateColumns.split(" ").length);
  expect(cols).toBe(1);
});
