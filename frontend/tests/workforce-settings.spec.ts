import { expect, test, type Page } from '@playwright/test';
const root = '/admin/lawyer-services/ai-operations';
const defaults = { practiceAreaId: 70, practiceAreaName: 'Criminal Law', minimumActiveLawyers: 0, targetActiveLawyers: 0, minimumFutureSlots: 0, highDemandThreshold: 5, watchCapacityRatio: .75, source: 'DEFAULT' };
async function fixture(page: Page, development = true) {
  await page.addInitScript(() => { localStorage.setItem('legalease_staff_user', JSON.stringify({ userId: 1, name: 'Admin', role: 'Admin' })); localStorage.setItem('token', 'test-token'); });
  let setting = { ...defaults }; let scenario = 'RECRUITMENT_NEEDED'; let error = false; let demoConflict = false;
  const stats = { saves: 0, resets: 0, applies: 0, demoResets: 0, analyses: 0, generates: 0 };
  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    const path = new URL(route.request().url()).pathname; const method = route.request().method(); let json: unknown = []; let status = 200;
    if (path.endsWith('/summary')) json = { activeLawyers: 4, totalLawyers: 4, practiceAreas: 1, legalServices: 5, coverage: [] };
    if (path === '/api/workforce-settings') json = [setting];
    if (path === '/api/workforce-settings/70') {
      if (method === 'PUT') { stats.saves++; if (error) { status = 400; json = { errors: { targetActiveLawyers: ['Target must be at least minimum.'] } }; } else { setting = { ...setting, ...route.request().postDataJSON(), source: 'CUSTOM' }; json = setting; } }
      if (method === 'DELETE') { stats.resets++; setting = { ...defaults }; json = setting; }
    }
    if (path === '/api/dev/workforce-demo') { status = development ? 200 : 404; json = { available: development }; }
    if (path === '/api/dev/workforce-demo/apply') { stats.applies++; scenario = route.request().postDataJSON().scenario; expect(route.request().postDataJSON().practiceAreaId).toBe(70); json = { scenario, practiceAreaId: 72, message: 'Isolated demo updated.' }; if (demoConflict) { status = 409; json = { title: 'An Admin-created opening already exists in this demo area. Review Careers before demonstrating new recruitment.' }; } }
    if (path === '/api/dev/workforce-demo/reset') { stats.demoResets++; scenario = 'HEALTHY_COVERAGE'; json = { scenario, practiceAreaId: 72, message: 'Demo baseline restored.' }; }
    if (path === '/api/workforce-analysis') { stats.analyses++; const healthy = scenario === 'HEALTHY_COVERAGE'; const recruitment = scenario === 'EXISTING_RECRUITMENT'; json = { generatedAt: '2026-10-04T08:00:00Z', recentWindowDays: 30, futureWindowDays: 30, unmappedCareerOpeningCount: 0, limitations: [], practiceAreas: [{ practiceAreaId: 72, practiceAreaName: '[Demo] Criminal Law', activeLawyerCount: healthy ? 6 : 2, legalServiceCount: 0, recentDemandCount: healthy ? 0 : 12, recentAppointmentCount: 0, futureAvailableSlotCount: healthy ? 12 : 0, openCareerOpeningCount: recruitment ? 1 : 0, openings: recruitment ? [{ careerId: 4, jobTitle: '[Demo] Criminal Law Practitioner' }] : [], status: healthy ? 'HEALTHY' : 'CAPACITY_CONCERN', reasons: healthy ? ['CAPACITY_WITHIN_CONFIGURED_RULES'] : ['BELOW_MINIMUM_LAWYERS'], planningRules: setting }] }; }
    if (path.endsWith('/suggestions')) stats.generates++;
    await route.fulfill({ status, json });
  });
  return { stats, failSave: () => { error = true; }, conflictDemo: () => { demoConflict = true; } };
}
test('settings load real defaults save custom rules reset and refetch analysis', async ({ page }) => {
  const { stats } = await fixture(page); await page.goto(root);
  await expect(page.getByRole('button', { name: 'Run Workforce Analysis' })).toBeVisible(); await page.getByRole('button', { name: 'Workforce Settings', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByText('Default', { exact: true })).toBeVisible(); await expect(dialog.getByLabel('High Demand Threshold')).toHaveValue('5');
  await dialog.getByLabel('Minimum Active Lawyers').fill('4'); await dialog.getByLabel('Target Active Lawyers').fill('6'); await dialog.getByLabel('Minimum Future Slots').fill('12'); await dialog.getByLabel('High Demand Threshold').fill('10'); await dialog.getByLabel('Watch Capacity Ratio (%)').fill('80');
  await dialog.getByRole('button', { name: 'Save Settings' }).click(); await expect(dialog.getByRole('status')).toContainText('Workforce settings saved'); await expect(dialog.getByText('Custom', { exact: true })).toBeVisible(); expect(stats.saves).toBe(1); expect(stats.analyses).toBe(1);
  await dialog.getByRole('button', { name: 'Reset to Defaults' }).click(); await expect(dialog.getByText('Default', { exact: true })).toBeVisible(); await expect(dialog.getByLabel('Watch Capacity Ratio (%)')).toHaveValue('75'); expect(stats.resets).toBe(1);
  await dialog.getByRole('button', { name: 'Close workforce settings' }).click(); await expect(dialog).toBeHidden(); await expect(page.getByRole('button', { name: 'Workforce Settings', exact: true })).toBeFocused();
});
test('local and backend validation errors do not claim a save', async ({ page }) => {
  const { stats, failSave } = await fixture(page); await page.goto(root); await page.getByRole('button', { name: 'Workforce Settings', exact: true }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Minimum Active Lawyers').fill('4'); await dialog.getByLabel('Target Active Lawyers').fill('3'); await dialog.getByRole('button', { name: 'Save Settings' }).click(); await expect(dialog.getByRole('alert')).toContainText('target at least the minimum'); expect(stats.saves).toBe(0);
  await dialog.getByLabel('Target Active Lawyers').fill('6'); failSave(); await dialog.getByRole('button', { name: 'Save Settings' }).click(); await expect(dialog.getByRole('alert')).toContainText('Target must be at least minimum');
});
test('demo selector applies refetches resets and blocks duplicate recruitment', async ({ page }) => {
  const { stats } = await fixture(page); await page.goto(root); await page.locator('summary').filter({ hasText: 'Demo Scenarios' }).click();
  await page.getByLabel('Scenario', { exact: true }).selectOption('RECRUITMENT_NEEDED'); await page.getByRole('button', { name: 'Apply Demo Scenario' }).click(); await expect(page.getByRole('status').filter({ hasText: 'Demo scenario' })).toContainText('Recruitment Needed'); expect(stats.applies).toBe(1); expect(stats.analyses).toBe(1); expect(stats.generates).toBe(0);
  await page.getByRole('button', { name: 'Run Workforce Analysis' }).click(); await expect(page.getByRole('button', { name: 'Prepare Hiring Proposal' })).toBeEnabled(); await page.getByRole('button', { name: 'View Analysis Details' }).click(); await expect(page.getByText('Workforce Rules', { exact: true })).toBeVisible(); await expect(page.getByText('Below configured minimum lawyer count.', { exact: false }).first()).toBeVisible();
  await page.getByLabel('Scenario', { exact: true }).selectOption('EXISTING_RECRUITMENT'); await page.getByRole('button', { name: 'Apply Demo Scenario' }).click(); await expect(page.getByRole('status').filter({ hasText: 'Demo scenario' })).toContainText('Existing Recruitment'); await page.getByRole('button', { name: 'Run Workforce Analysis' }).click(); await expect(page.getByRole('heading', { name: 'Current Recruitment' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Prepare Hiring Proposal' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset Demo Data' }).click(); await expect(page.getByRole('status').filter({ hasText: 'Demo baseline' })).toContainText('Demo baseline restored'); await page.getByRole('button', { name: 'Run Workforce Analysis' }).click(); await expect(page.getByRole('heading', { name: 'Workforce Coverage Healthy' })).toBeVisible(); expect(stats.demoResets).toBe(1);
});
test('a nondevelopment backend never exposes demo controls', async ({ page }) => {
  await fixture(page, false); await page.goto(root); await page.getByRole('button', { name: 'Workforce Settings', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('button', { name: 'Apply Demo Scenario' })).toHaveCount(0); await expect(page.getByText('Demo Scenarios', { exact: false })).toHaveCount(0);
});
test('settings dialog and secondary demo controls fit supported widths with keyboard access', async ({ page }, info) => {
  await fixture(page); await page.goto(root);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto(root); const open = page.getByRole('button', { name: 'Workforce Settings', exact: true }); await open.focus(); await page.keyboard.press('Enter'); const dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('Minimum Active Lawyers')).toBeVisible();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true); await page.screenshot({ path: info.outputPath(`settings-${width}.png`), fullPage: true }); await page.keyboard.press('Escape'); await expect(open).toBeFocused();
    const details = page.locator('details').filter({ hasText: 'Demo Scenarios' }); if ((await details.getAttribute('open')) === null) { await details.locator('summary').focus(); await page.keyboard.press('Enter'); } expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: info.outputPath(`demo-${width}.png`), fullPage: true });
  }
});

test('demo mutation protection explains the conflict without claiming success', async ({ page }) => {
  const { stats, conflictDemo } = await fixture(page); conflictDemo(); await page.goto(root); await page.locator('summary').filter({ hasText: 'Demo Scenarios' }).click(); await page.getByRole('button', { name: 'Apply Demo Scenario' }).click(); await expect(page.getByRole('alert')).toContainText('Review Careers before demonstrating new recruitment'); expect(stats.analyses).toBe(0); await expect(page.getByRole('status')).toHaveCount(0);
});
