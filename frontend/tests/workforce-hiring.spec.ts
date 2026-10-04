import { expect, test, type Page } from '@playwright/test';
const root = '/admin/lawyer-services/ai-operations';
const api = /^https?:\/\/[^/]+\/api\//;
const area = { practiceAreaId: 70, practiceAreaName: 'Recorded Area', activeLawyerCount: 1, legalServiceCount: 2, recentDemandCount: 7, recentAppointmentCount: 3, futureAvailableSlotCount: 2, openCareerOpeningCount: 0, status: 'CAPACITY_CONCERN', reasons: ['HIGH_DEMAND_LOW_AVAILABILITY'], openings: [] as { careerId: number; jobTitle: string }[] };
const healthy = { ...area, practiceAreaId: 71, practiceAreaName: 'Healthy Area', activeLawyerCount: 4, futureAvailableSlotCount: 30, status: 'HEALTHY', reasons: ['CAPACITY_WITHIN_CONFIGURED_RULES'] };
const report = { generatedAt: new Date().toISOString(), recentWindowDays: 30, futureWindowDays: 30, practiceAreas: [area, healthy], unmappedCareerOpeningCount: 0, limitations: ['Recorded facts; no service-specific demand.'] };
const draft = { suggestedTitle: 'Recorded Area Associate', operationalReason: 'Recorded demand exceeds upcoming capacity.', summary: 'Support matters in the recorded area.', responsibilities: ['Assist with recorded matters.'], focusAreas: ['Recorded Area'] };
const summary = { activeLawyers: 5, totalLawyers: 5, practiceAreas: 2, legalServices: 4, coverage: [] };
const workflow = { workflowId: 'hiring-fixture', practiceAreaId: 70, status: 'AWAITING_APPROVAL', snapshot: area, draft, careerOpeningId: null as number | null, approvedTitle: null as string | null, createdAt: report.generatedAt, updatedAt: report.generatedAt, approvedAt: null };
async function login(page: Page, role = 'Admin') { await page.addInitScript(role => { localStorage.setItem('legalease_staff_user', JSON.stringify({ userId: 1, name: 'Test Admin', role })); localStorage.setItem('token', 'fixture-token'); }, role); }
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
async function fixtures(page: Page, options: { report?: typeof report; status?: string; failAnalysis?: boolean; failAI?: boolean; stale?: boolean; conflict?: boolean; gateAnalysis?: ReturnType<typeof deferred>; gateAI?: ReturnType<typeof deferred>; gateApprove?: ReturnType<typeof deferred>; gateRestore?: ReturnType<typeof deferred> } = {}) {
  await login(page);
  const stats = { analysis: 0, generates: 0, approvals: 0, saves: 0 };
  let saved = { ...structuredClone(workflow), status: options.status ?? workflow.status };
  if (saved.status === 'CAREER_OPENING_CREATED') saved = { ...saved, careerOpeningId: 14, approvedTitle: draft.suggestedTitle };
  await page.route(api, async route => {
    const path = new URL(route.request().url()).pathname; const method = route.request().method(); let body: unknown = []; let status = 200;
    if (path.endsWith('/summary')) body = summary;
    if (path === '/api/workforce-analysis') { stats.analysis++; await options.gateAnalysis?.promise; status = options.failAnalysis ? 503 : 200; body = options.failAnalysis ? { title: 'Internal SQL stack trace should never appear' } : options.report ?? report; }
    if (path === '/api/workforce-analysis/suggestions' && method === 'POST') { stats.generates++; await options.gateAI?.promise; expect(route.request().postDataJSON()).toEqual(route.request().postDataJSON().workflowId ? { practiceAreaId: 70, workflowId: 'hiring-fixture' } : { practiceAreaId: 70 }); status = options.failAI ? 503 : 200; body = options.failAI ? { title: 'Secret provider stack trace' } : saved; }
    if (path.endsWith('/hiring-fixture')) { await options.gateRestore?.promise; body = saved; }
    if (path.endsWith('/missing')) { status = 404; body = { title: 'Missing' }; }
    if (path.endsWith('/draft')) { stats.saves++; saved = { ...saved, draft: route.request().postDataJSON() }; body = saved; }
    if (path.endsWith('/approve')) { stats.approvals++; await options.gateApprove?.promise;
      if (options.stale || options.conflict) { status = 409; body = { title: options.stale ? 'Workforce facts changed or expired. Regenerate the suggestion before approval.' : 'Recruitment already in progress for this Practice Area.' }; }
      else { const request = route.request().postDataJSON(); expect(request.draft).toEqual(saved.draft); saved = { ...saved, status: 'CAREER_OPENING_CREATED', careerOpeningId: 14, approvedTitle: request.jobTitle }; body = saved; }
    }
    if (path.endsWith('/dismiss')) { saved = { ...saved, status: 'DISMISSED' }; body = saved; }
    if (path === '/api/careers') body = [{ careerId: 14, jobTitle: saved.approvedTitle, description: 'Approved responsibilities.', applicationsCount: 0, createdAt: report.generatedAt }];
    await route.fulfill({ status, json: body });
  });
  return { stats, options };
}
async function analyse(page: Page) { await page.goto(root); await page.getByRole('button', { name: 'Run Workforce Analysis', exact: true }).click(); await expect(page.getByRole('heading', { name: '1 area requires review' })).toBeVisible(); }
async function propose(page: Page) { await analyse(page); await page.getByRole('button', { name: 'Prepare Hiring Proposal', exact: true }).click(); await expect(page.getByRole('heading', { name: 'AI Hiring Proposal', exact: true })).toBeVisible(); }
function stage(page: Page, label: string) { return page.getByRole('region', { name: 'Workforce workflow progress' }).getByRole('listitem').filter({ has: page.getByText(label, { exact: true }) }); }

test('ready is calm and analysis progression waits for the actual API response', async ({ page }) => {
  const gate = deferred(); const { stats } = await fixtures(page, { gateAnalysis: gate });
  await page.goto(root); await expect(page.getByRole('button', { name: 'Run Workforce Analysis' })).toBeVisible(); expect(stats.analysis).toBe(0); await expect(page.getByText('Recorded Area', { exact: true })).toHaveCount(0); await expect(page.getByRole('region', { name: 'Workforce workflow progress' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Run Workforce Analysis' }).click(); await expect(stage(page, 'Demand Data')).toHaveAttribute('data-state', 'ACTIVE'); await expect(stage(page, 'Lawyer Capacity')).toHaveAttribute('data-state', 'PENDING'); await expect(page.getByText('0 of 7 stages complete')).toBeVisible();
  // The request remains unresolved until this explicit release; there are no timed stage transitions.
  gate.resolve(); await expect(stage(page, 'Recruitment Check')).toHaveAttribute('data-state', 'COMPLETE'); await expect(page.getByText('4 of 7 stages complete')).toBeVisible(); expect(stats.analysis).toBe(1);
  await expect(page.getByText('Healthy Area', { exact: true })).toBeHidden(); await page.getByRole('button', { name: 'View Analysis Details' }).click(); await expect(page.getByText('Healthy Area', { exact: true })).toBeVisible(); await expect(page.getByText('Recent Appointments', { exact: true }).first()).toBeVisible();
});
test('healthy result uses real totals and offers no hiring action', async ({ page }, info) => {
  const { stats } = await fixtures(page, { report: { ...report, practiceAreas: [healthy, { ...healthy, practiceAreaId: 72, practiceAreaName: 'Another Healthy Area', activeLawyerCount: 6, futureAvailableSlotCount: 11 }] } });
  await page.goto(root); await page.getByRole('button', { name: 'Run Workforce Analysis' }).click(); await expect(page.getByRole('heading', { name: 'Workforce Coverage Healthy' })).toBeVisible();
  const result = page.getByRole('region', { name: 'Workforce analysis result' }); await expect(result.getByText('10', { exact: true })).toBeVisible(); await expect(result.getByText('41', { exact: true })).toBeVisible(); await expect(page.getByText('4 system checks completed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare Hiring Proposal' })).toHaveCount(0); await expect(page.getByText('Healthy Area', { exact: true })).toBeHidden(); await page.getByRole('button', { name: 'View Analysis Details' }).click(); await expect(page.getByText('Healthy Area', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Prepare Hiring Proposal' })).toHaveCount(0); expect(stats.generates).toBe(0);
  await page.screenshot({ path: info.outputPath('healthy-desktop.png'), fullPage: true });
});
test('proposal edit save regenerate review approval completion and Careers integration', async ({ page }, info) => {
  const gateAI = deferred(); const gateApprove = deferred(); const { stats } = await fixtures(page, { gateAI, gateApprove });
  await analyse(page); await page.getByRole('button', { name: 'Prepare Hiring Proposal' }).click(); await expect(stage(page, 'Hiring Proposal')).toHaveAttribute('data-state', 'ACTIVE'); await expect(page.getByText('Generating proposal from verified workforce data...')).toBeVisible(); gateAI.resolve();
  await expect(page.getByText('AI Generated · Review Required')).toBeVisible(); await expect(page.locator('textarea')).toHaveCount(0); await expect(stage(page, 'Administrator Review')).toHaveAttribute('data-state', 'ACTIVE'); await expect(page).toHaveURL(/hiring=hiring-fixture/);
  await page.screenshot({ path: info.outputPath('proposal-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Edit Draft' }).click(); await page.getByLabel('Summary', { exact: true }).fill('Admin edited summary.'); await page.getByRole('button', { name: 'Save Changes' }).click(); await expect(page.getByText('Admin edited summary.', { exact: true })).toBeVisible(); await expect(page.locator('textarea')).toHaveCount(0); expect(stats.saves).toBe(1);
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click(); await expect(page.getByRole('button', { name: 'Continue to Approval' })).toBeEnabled(); expect(stats.generates).toBe(2);
  await page.reload(); await expect(page.getByText('Admin edited summary.', { exact: true })).toBeVisible(); expect(stats.generates).toBe(2);
  await page.getByRole('button', { name: 'Continue to Approval' }).click(); await expect(page.getByRole('heading', { name: 'Final Review · Career Opening' })).toBeVisible(); await expect(page.getByText('AI Workforce Recommendation', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Back to Proposal' }).click(); await expect(page.getByRole('heading', { name: 'AI Hiring Proposal' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Approval' }).click(); await page.getByLabel('Career Title').fill(''); await page.getByRole('button', { name: 'Approve & Create Career Opening' }).click(); await expect(page.getByRole('alert')).toBeVisible(); expect(stats.approvals).toBe(0);
  await page.getByLabel('Career Title').fill('Admin Reviewed Role'); await page.getByRole('button', { name: 'Approve & Create Career Opening' }).click(); await expect(stage(page, 'Administrator Review')).toHaveAttribute('data-state', 'COMPLETE'); await expect(stage(page, 'Career Opening')).toHaveAttribute('data-state', 'ACTIVE'); await expect(page.getByText('CREATING OPENING', { exact: true })).toBeVisible(); gateApprove.resolve();
  await expect(page.getByRole('heading', { name: 'Career Opening Created', exact: true })).toBeVisible(); await expect(page.getByText('7 of 7 stages complete')).toBeVisible(); expect(stats.approvals).toBe(1);
  await page.screenshot({ path: info.outputPath('completed-desktop.png'), fullPage: true }); await page.reload(); await expect(page.getByRole('heading', { name: 'Career Opening Created' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Approve & Create Career Opening' })).toHaveCount(0);
  await page.getByRole('link', { name: 'View in Careers' }).click(); await expect(page).toHaveURL('/admin/careers'); await expect(page.getByText('Admin Reviewed Role', { exact: true })).toBeVisible(); expect(stats.approvals).toBe(1);
});
test('attention selection excludes healthy areas and existing recruitment is an operational state', async ({ page }) => {
  const occupied = { ...area, practiceAreaId: 72, practiceAreaName: 'Vacant Area', status: 'NO_ACTIVE_LAWYERS', activeLawyerCount: 0, reasons: ['NO_ACTIVE_LAWYERS'], openCareerOpeningCount: 1, openings: [{ careerId: 14, jobTitle: 'Existing Associate' }] };
  const { stats } = await fixtures(page, { report: { ...report, practiceAreas: [area, healthy, occupied] } });
  await page.goto(root); await page.getByRole('button', { name: 'Run Workforce Analysis' }).click(); await expect(page.getByRole('heading', { name: '2 areas require review' })).toBeVisible(); await expect(page.getByText('Healthy Area', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Vacant Area', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Current Recruitment' })).toBeVisible(); await expect(page.getByRole('region', { name: 'Current recruitment' }).getByText('Existing Associate · Opening #14')).toBeVisible(); await expect(page.getByRole('link', { name: 'View Career Opening' })).toHaveAttribute('href', '/admin/careers'); await expect(page.getByRole('button', { name: 'Prepare Hiring Proposal' })).toHaveCount(0); expect(stats.generates).toBe(0);
});
test('analysis failure retry empty catalog and missing workflow', async ({ page }) => {
  const options = { failAnalysis: true, report: { ...report, practiceAreas: [] } }; const { stats } = await fixtures(page, options);
  await page.goto(root); await page.getByRole('button', { name: 'Run Workforce Analysis' }).click(); await expect(page.getByRole('heading', { name: 'Analysis Could Not Be Completed' })).toBeVisible(); await expect(stage(page, 'Demand Data')).toHaveAttribute('data-state', 'FAILED'); await expect(page.getByText('Internal SQL stack trace should never appear')).toHaveCount(0);
  options.failAnalysis = false; await page.getByRole('button', { name: 'Retry Analysis' }).click(); await expect(page.getByRole('heading', { name: 'No Practice Areas', exact: true })).toBeVisible();
  await page.goto(root + '?hiring=missing'); await expect(page.getByRole('button', { name: 'Retry Workflow' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Run Workforce Analysis' })).toHaveCount(0); await page.getByRole('button', { name: 'Return to Analysis' }).click(); await expect(page.getByRole('button', { name: 'Run Workforce Analysis' })).toBeVisible(); expect(stats.generates).toBe(0);
});
test('provider failure is safe and retry uses the existing endpoint', async ({ page }) => {
  const options = { failAI: true }; const { stats } = await fixtures(page, options);
  await analyse(page); await page.getByRole('button', { name: 'Prepare Hiring Proposal' }).click(); await expect(page.getByRole('heading', { name: 'Hiring Proposal Could Not Be Generated' })).toBeVisible(); await expect(stage(page, 'Hiring Proposal')).toHaveAttribute('data-state', 'FAILED'); await expect(page.getByText('Secret provider stack trace')).toHaveCount(0);
  options.failAI = false;
  // A failed generation persisted no workflow, so retry still sends only the Practice Area.
  await page.unroute(api);
  await page.route(api, async route => { const path = new URL(route.request().url()).pathname; if (path.endsWith('/suggestions')) { stats.generates++; expect(route.request().postDataJSON()).toEqual({ practiceAreaId: 70 }); } await route.fulfill({ json: path === '/api/workforce-analysis' ? report : path.endsWith('/summary') ? summary : workflow }); });
  await page.getByRole('button', { name: 'Retry Proposal' }).click(); await expect(page.getByRole('heading', { name: 'AI Hiring Proposal' })).toBeVisible(); expect(stats.generates).toBe(2);
});
test('stale approval requires refresh and regeneration; conflict never claims success', async ({ page }) => {
  const options = { stale: true, conflict: false }; await fixtures(page, options); await propose(page); await page.getByRole('button', { name: 'Continue to Approval' }).click(); await page.getByRole('button', { name: 'Approve & Create Career Opening' }).click();
  await expect(page.getByRole('heading', { name: 'Workforce Data Changed' })).toBeVisible(); await expect(stage(page, 'Career Opening')).toHaveAttribute('data-state', 'FAILED'); await expect(page.getByRole('heading', { name: 'Career Opening Created' })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Approve & Create Career Opening' })).toBeDisabled();
  await page.getByRole('button', { name: 'Refresh Analysis' }).click(); await expect(page.getByRole('button', { name: 'Regenerate', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Regenerate', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Workforce Data Changed' })).toHaveCount(0);
  options.stale = false; options.conflict = true; await page.getByRole('button', { name: 'Continue to Approval' }).click(); await page.getByRole('button', { name: 'Approve & Create Career Opening' }).click(); await expect(page.getByRole('heading', { name: 'Career Opening Was Not Created' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Review Current Recruitment' })).toBeVisible();
});
for (const status of ['AWAITING_APPROVAL', 'CAREER_OPENING_CREATED', 'DISMISSED']) test(`URL restoration renders ${status} without a ready screen or AI request`, async ({ page }) => {
  const gateRestore = deferred(); const { stats } = await fixtures(page, { status, gateRestore }); await page.goto(root + '?hiring=hiring-fixture'); await expect(page.getByRole('heading', { name: 'Restoring Hiring Workflow' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Run Workforce Analysis' })).toHaveCount(0); gateRestore.resolve();
  await expect(page.getByRole('heading', { name: status === 'AWAITING_APPROVAL' ? 'AI Hiring Proposal' : status === 'CAREER_OPENING_CREATED' ? 'Career Opening Created' : 'Suggestion Dismissed', exact: true })).toBeVisible(); if (status === 'AWAITING_APPROVAL') await expect(stage(page, 'Administrator Review')).toHaveAttribute('data-state', 'ACTIVE'); if (status === 'CAREER_OPENING_CREATED') await expect(page.getByText('7 of 7 stages complete')).toBeVisible(); expect(stats.generates).toBe(0);
});
test('dismissal and Done preserve no-opening outcome', async ({ page }) => {
  const { stats } = await fixtures(page); await propose(page); await page.getByRole('button', { name: 'Dismiss Suggestion' }).click(); await expect(page.getByRole('heading', { name: 'Suggestion Dismissed' })).toBeVisible(); await page.reload(); await expect(page.getByRole('heading', { name: 'Suggestion Dismissed' })).toBeVisible(); await page.getByRole('button', { name: 'Done', exact: true }).click(); await expect(page.getByRole('button', { name: 'Run Workforce Analysis' })).toBeVisible(); expect(stats.approvals).toBe(0);
});
test('unlinked recruitment requires human acknowledgement', async ({ page }) => {
  const { stats } = await fixtures(page, { report: { ...report, unmappedCareerOpeningCount: 1 } }); await propose(page); await page.getByRole('button', { name: 'Continue to Approval' }).click(); await page.getByRole('button', { name: 'Approve & Create Career Opening' }).click(); await expect(page.getByRole('alert')).toContainText('Review existing unlinked'); expect(stats.approvals).toBe(0); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Approve & Create Career Opening' }).click(); await expect(page.getByRole('heading', { name: 'Career Opening Created' })).toBeVisible();
});
test('responsive ready result proposal and approval remain readable with reduced motion and keyboard access', async ({ page }, info) => {
  await fixtures(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto(root); const run = page.getByRole('button', { name: 'Run Workforce Analysis' }); await page.screenshot({ path: info.outputPath(`ready-${width}.png`), fullPage: true }); await run.focus(); await expect(run).toBeFocused(); await page.keyboard.press('Enter'); await expect(page.getByRole('heading', { name: '1 area requires review' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.getByRole('button', { name: 'Prepare Hiring Proposal' }).click(); await expect(page.getByRole('heading', { name: 'AI Hiring Proposal' })).toBeVisible(); await expect(stage(page, 'Administrator Review')).toHaveAttribute('data-state', 'ACTIVE');
    await page.getByRole('region', { name: 'Workforce workflow progress' }).scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath(`progress-${width}.png`), fullPage: true }); await page.getByRole('heading', { name: 'AI Hiring Proposal', exact: true }).scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: info.outputPath(`proposal-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Continue to Approval' }).click(); await expect(page.getByLabel('Career Title')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: info.outputPath(`approval-${width}.png`), fullPage: true });
  }
});
test('non-Admin route guard', async ({ page }) => { await login(page, 'Lawyer'); await page.goto(root); await expect(page.getByRole('heading', { name: 'Workforce & Hiring Intelligence' })).toHaveCount(0); await expect(page).not.toHaveURL(root); });

test('evidence rows are compact, keyboard expandable and expose both raw demand signals', async ({ page }) => {
  await fixtures(page); await analyse(page);
  const details = page.getByRole('button', { name: 'View Analysis Details' });
  await expect(details).toHaveAttribute('aria-expanded', 'false'); await details.focus(); await page.keyboard.press('Enter'); await expect(details).toHaveAttribute('aria-expanded', 'true');
  const healthyButton = page.getByRole('button', { name: /Healthy Area.*4 lawyers/ });
  await expect(healthyButton).toHaveAttribute('aria-expanded', 'false');
  const healthyDetails = page.locator('#workforce-evidence-71'); await expect(healthyDetails).toBeHidden();
  await healthyButton.focus(); await page.keyboard.press('Space'); await expect(healthyButton).toHaveAttribute('aria-expanded', 'true'); await expect(healthyDetails).toBeVisible();
  await expect(healthyDetails.getByText('Recent Requests', { exact: true })).toBeVisible(); await expect(healthyDetails.getByText('Recent Appointments', { exact: true })).toBeVisible(); await expect(healthyDetails.getByText('30', { exact: true })).toBeVisible(); await expect(healthyDetails).toContainText('These demand signals are not added together');
  await expect(page.getByRole('button', { name: /Recorded Area.*1 lawyer/ })).toHaveAttribute('aria-expanded', 'true');
  await details.click(); await expect(details).toHaveAttribute('aria-expanded', 'false'); await expect(healthyButton).toBeHidden();
});
test('completed summary retains labelled circle, ownership, real freshness and measured request timing', async ({ page }) => {
  const { stats } = await fixtures(page, { report: { ...report, practiceAreas: [healthy] } });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(root); await page.getByRole('button', { name: 'Run Workforce Analysis' }).click();
  const progress = page.getByRole('region', { name: 'Workforce workflow progress' }); await expect(progress).toBeVisible(); await expect(progress.getByText('4 system checks completed')).toBeVisible(); await expect(progress.locator('svg > circle').nth(1)).toHaveAttribute('stroke-dashoffset', '0');
  for (const label of ['Demand', 'Capacity', 'Coverage', 'Recruitment']) await expect(progress.getByText(label, { exact: true })).toBeVisible();
  await expect(progress.getByText('Demand, capacity and recruitment analysis')).toBeVisible(); await expect(progress.getByText('Hiring proposal generation only')).toBeVisible(); await expect(progress.getByText('Final review and approval')).toBeVisible();
  await expect(page.locator('time')).toHaveAttribute('datetime', report.generatedAt); await expect(page.getByText(/Analysis request completed in/)).toBeVisible();
  await page.getByRole('button', { name: 'Run New Analysis' }).click(); await expect(progress.getByText('4 system checks completed')).toBeVisible(); expect(stats.analysis).toBe(2);
});
test('healthy coverage with recruitment is stable context and healthy status remains intact', async ({ page }) => {
  const recruiting = { ...healthy, openCareerOpeningCount: 1, openings: [{ careerId: 2, jobTitle: 'Healthy Area Practitioner' }], reasons: ['CAPACITY_WITHIN_CONFIGURED_RULES', 'RECRUITMENT_ALREADY_ACTIVE'] };
  await fixtures(page, { report: { ...report, practiceAreas: [recruiting] } });
  await page.goto(root); await page.getByRole('button', { name: 'Run Workforce Analysis' }).click(); await expect(page.getByRole('heading', { name: 'Workforce Coverage Stable' })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Current Recruitment' })).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Prepare Hiring Proposal' })).toHaveCount(0);
  await page.getByRole('button', { name: 'View Analysis Details' }).click(); const row = page.getByRole('button', { name: /Healthy Area.*4 lawyers/ }); await expect(row).toHaveAttribute('aria-expanded', 'true'); await expect(row).toContainText('Healthy'); await expect(page.locator('#workforce-evidence-71')).toContainText('Healthy Area Practitioner · Opening #2');
});
test('visual refinement matrix covers all result and workflow states at five viewport widths', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 1024, 768, 375, 320]) {
    await page.unroute(api); const options = { report: { ...report, practiceAreas: [healthy] }, failAnalysis: false }; await fixtures(page, options); await page.setViewportSize({ width, height: 1000 });
    const capture = async (state: string, target: ReturnType<Page['getByRole']>) => { await target.scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: info.outputPath(`${state}-${width}.png`), fullPage: true }); };
    await page.goto(root); await capture('refined-ready', page.getByRole('button', { name: 'Run Workforce Analysis' })); await page.getByRole('button', { name: 'Run Workforce Analysis' }).click(); await expect(page.getByRole('heading', { name: 'Workforce Coverage Healthy' })).toBeVisible(); await capture('refined-healthy', page.getByRole('region', { name: 'Workforce workflow progress' }));
    if (width < 1024) await expect(page.getByRole('region', { name: 'Workforce workflow progress' }).getByText('Demand', { exact: true })).toBeHidden();
    options.report = { ...report, practiceAreas: [{ ...healthy, openCareerOpeningCount: 1, openings: [{ careerId: 2, jobTitle: 'Healthy Area Practitioner' }] }] }; await page.getByRole('button', { name: 'Run New Analysis' }).click(); await expect(page.getByRole('heading', { name: 'Workforce Coverage Stable' })).toBeVisible(); await capture('refined-recruitment', page.getByRole('region', { name: 'Workforce analysis result' }));
    for (const status of ['WATCH', 'NO_ACTIVE_LAWYERS', 'CAPACITY_CONCERN']) {
      options.report = { ...report, practiceAreas: [{ ...area, status, activeLawyerCount: status === 'NO_ACTIVE_LAWYERS' ? 0 : 1, futureAvailableSlotCount: status === 'NO_ACTIVE_LAWYERS' ? 0 : status === 'WATCH' ? 9 : 2, reasons: [status === 'WATCH' ? 'DEMAND_APPROACHING_CAPACITY' : status === 'NO_ACTIVE_LAWYERS' ? 'NO_ACTIVE_LAWYERS' : 'HIGH_DEMAND_LOW_AVAILABILITY'] }, healthy] };
      await page.getByRole('button', { name: 'Run New Analysis' }).click(); await expect(page.getByRole('heading', { name: '1 area requires review' })).toBeVisible(); await capture(`refined-${status.toLowerCase()}`, page.getByRole('region', { name: 'Workforce analysis result' }));
    }
    await page.getByRole('button', { name: 'View Analysis Details' }).click(); await capture('refined-evidence', page.getByRole('region', { name: 'Analysis details' })); await page.getByRole('button', { name: /Healthy Area.*4 lawyers/ }).click(); await capture('refined-expanded', page.locator('#workforce-evidence-71'));
    await page.getByRole('button', { name: 'Prepare Hiring Proposal' }).click(); await expect(page.getByRole('heading', { name: 'AI Hiring Proposal' })).toBeVisible(); await expect(page.getByText('AI PROPOSAL READY', { exact: true })).toBeVisible(); await capture('refined-proposal', page.getByRole('region', { name: 'Workforce workflow progress' }));
    await page.reload(); await expect(page.getByRole('heading', { name: 'AI Hiring Proposal' })).toBeVisible(); await capture('refined-restored', page.getByRole('heading', { name: 'AI Hiring Proposal' }));
    await page.getByRole('button', { name: 'Continue to Approval' }).click(); await expect(page.getByText('AWAITING REVIEW', { exact: true })).toBeVisible(); await capture('refined-review', page.getByRole('heading', { name: 'Final Review · Career Opening' })); await page.getByRole('button', { name: 'Approve & Create Career Opening' }).click(); await expect(page.getByRole('heading', { name: 'Career Opening Created' })).toBeVisible(); await capture('refined-career', page.getByRole('heading', { name: 'Career Opening Created' }));
    options.failAnalysis = true; await page.goto(root); await page.getByRole('button', { name: 'Run Workforce Analysis' }).click(); await expect(page.getByRole('heading', { name: 'Analysis Could Not Be Completed' })).toBeVisible(); await capture('refined-error', page.getByRole('heading', { name: 'Analysis Could Not Be Completed' }));
  }
});

test('confirmed analysis animates checkpoint pauses while results remain usable; reduced motion skips replay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fixtures(page, { report: { ...report, practiceAreas: [healthy] } });
  await page.goto(root); await page.getByRole('button', { name: 'Run Workforce Analysis' }).click();
  await expect(page.getByRole('heading', { name: 'Workforce Coverage Healthy' })).toBeVisible();
  const ring = page.getByRole('region', { name: 'Workforce workflow progress' }).locator('svg > circle').nth(1);
  const replay = await ring.evaluate(element => {
    const animation = element.getAnimations()[0];
    const frames = animation?.effect?.getKeyframes() ?? [];
    return { running: animation?.playState === 'running', holds: frames.slice(1).filter((frame, index) => frame.strokeDashoffset === frames[index].strokeDashoffset).length };
  });
  expect(replay.running).toBe(true); expect(replay.holds).toBe(4);
  await expect(page.getByRole('button', { name: 'Run New Analysis' })).toBeEnabled();
  await page.getByRole('button', { name: 'View Analysis Details' }).click(); await expect(page.getByRole('button', { name: /Healthy Area.*4 lawyers/ })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => ring.evaluate(element => element.getAnimations().length)).toBe(0);
  await page.getByRole('button', { name: 'Run New Analysis' }).click(); await expect(page.getByRole('heading', { name: 'Workforce Coverage Healthy' })).toBeVisible();
  expect(await ring.evaluate(element => element.getAnimations().length)).toBe(0);
  await expect(ring).toHaveAttribute('stroke-dashoffset', '0');
});
