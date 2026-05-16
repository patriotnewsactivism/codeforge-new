import { runTest } from "./scripts/auth";

runTest("Take Screenshots", async (helper) => {
  const { page } = helper;

  // Screenshot landing page
  await helper.goto("/");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "screenshots/landing.png", fullPage: true });
  console.log("Landing screenshot taken");

  // Go to dashboard
  await helper.goto("/dashboard");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "screenshots/dashboard.png", fullPage: true });
  console.log("Dashboard screenshot taken");

  // Create a project and open IDE
  const newProjectBtn = page.locator("text=New Project").first();
  if (await newProjectBtn.isVisible()) {
    await newProjectBtn.click();
    await page.waitForTimeout(500);
    await page.fill('input[id="name"]', "My First App");
    await page.fill('input[id="desc"]', "A test project");
    await page.locator("text=Create Project").click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "screenshots/ide.png", fullPage: true });
    console.log("IDE screenshot taken");
  }

}).catch(() => process.exit(1));
