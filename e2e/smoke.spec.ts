/**
 * E2E smoke test for Cymru Rugby app.
 * - Account creation / sign-in
 * - Competition detail pages: Age Grade U14 and BUCS
 * - Scroll reachability past horizontal table to Fixtures & Results
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8085';
/** Set in `.env` or the shell — never commit real credentials. */
const EMAIL = process.env.PLAYWRIGHT_SMOKE_EMAIL ?? '';
const PASSWORD = process.env.PLAYWRIGHT_SMOKE_PASSWORD ?? '';

// Fixtures section states we record
type FixturesState = 'list' | 'empty-state' | 'error-state' | 'loading' | 'unknown';

const results: {
  accountCreation: 'PASS' | 'FAIL';
  accountSignIn: 'PASS' | 'FAIL' | 'SKIP';
  ageGradeU14: {
    scrollReachability: 'PASS' | 'FAIL';
    fixturesState: FixturesState;
  };
  bucs: {
    scrollReachability: 'PASS' | 'FAIL';
    fixturesState: FixturesState;
  };
  blockers: string[];
  tableNotes: string[];
} = {
  accountCreation: 'FAIL',
  accountSignIn: 'SKIP',
  ageGradeU14: { scrollReachability: 'FAIL', fixturesState: 'unknown' },
  bucs: { scrollReachability: 'FAIL', fixturesState: 'unknown' },
  blockers: [],
  tableNotes: [],
};

async function recordFixturesState(page: import('@playwright/test').Page): Promise<FixturesState> {
  if (await page.getByText(/could not load fixtures/i).first().isVisible()) return 'error-state';
  if (await page.getByText(/no fixtures/i).first().isVisible()) return 'empty-state';
  if (await page.getByText(/^upcoming$/i).first().isVisible()) return 'list';
  if (await page.getByText(/^results$/i).first().isVisible()) return 'list';
  return 'unknown';
}

async function scrollToFixtures(page: import('@playwright/test').Page): Promise<boolean> {
  const fixturesHeading = page.getByText(/fixtures & results/i);
  for (let i = 0; i < 6; i++) {
    if (await fixturesHeading.isVisible()) return true;
    await page.evaluate(() => window.scrollBy(0, 350));
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  return fixturesHeading.isVisible();
}

test.describe('Cymru Rugby Smoke Test', () => {
  test('full smoke: account, Age Grade U14, BUCS, scroll and fixtures', async ({ page }) => {
    test.skip(
      !EMAIL || !PASSWORD,
      'Set PLAYWRIGHT_SMOKE_EMAIL and PLAYWRIGHT_SMOKE_PASSWORD (see .env.example)'
    );
    test.setTimeout(90_000);
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // --- 1) Account creation or sign-in ---
    const signInBtn = page.getByRole('button', { name: /sign in/i });
    const createAccountBtn = page.getByRole('button', { name: /create account/i });
    const isLanding =
      (await signInBtn.isVisible()) || (await createAccountBtn.isVisible());

    if (isLanding) {
      await page.getByRole('button', { name: /create account/i }).click();
      await page.waitForURL(/sign-up/, { timeout: 5000 });
      await page.waitForTimeout(500);

      await page.getByPlaceholder(/you@example\.com/i).first().fill(EMAIL);
      await page.getByPlaceholder(/password/i).first().fill(PASSWORD);

      const dialogHandled = page.waitForEvent('dialog', { timeout: 8000 }).then(
        async (d) => {
          const msg = d.message().toLowerCase();
          await d.accept();
          return msg;
        }
      ).catch(() => null);

      await page.getByRole('button', { name: /create account/i }).click();
      const dialogMsg = await dialogHandled;
      await page.waitForTimeout(3000);

      if (dialogMsg && (dialogMsg.includes('already') || dialogMsg.includes('exists') || dialogMsg.includes('registered'))) {
        results.accountCreation = 'FAIL';
        await page.getByRole('button', { name: /back to sign in/i }).click();
        await page.waitForURL(/sign-in/);
        await page.getByRole('heading', { name: /welcome back/i }).waitFor({ state: 'visible', timeout: 5000 });
        await page.getByRole('textbox', { name: /you@example\.com/i }).last().fill(EMAIL);
        await page.getByPlaceholder(/password/i).last().fill(PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForTimeout(5000);
        results.accountSignIn = page.url().includes('sign-in') ? 'FAIL' : 'PASS';
        if (results.accountSignIn === 'FAIL') results.blockers.push('Sign-in failed after account exists');
      } else if (!page.url().includes('sign-up')) {
        results.accountCreation = 'PASS';
      } else {
        // Still on sign-up - try sign-in fallback (account may already exist)
        results.accountCreation = 'FAIL';
        await page.getByRole('button', { name: /back to sign in/i }).click();
        await page.waitForURL(/sign-in/);
        await page.getByRole('heading', { name: /welcome back/i }).waitFor({ state: 'visible', timeout: 5000 });
        await page.getByRole('textbox', { name: /you@example\.com/i }).last().fill(EMAIL);
        await page.getByPlaceholder(/password/i).last().fill(PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForTimeout(5000);
        results.accountSignIn = page.url().includes('sign-in') ? 'FAIL' : 'PASS';
        if (results.accountSignIn === 'FAIL') results.blockers.push('Account creation and sign-in both failed');
      }
    } else {
      results.accountCreation = 'PASS';
    }

    // --- 2) Navigate to Competitions tab (skip if not authenticated) ---
    if (page.url().includes('sign-in') || page.url().includes('sign-up')) {
      results.blockers.push('Stuck on auth; cannot reach Competitions');
    } else {
    const compTab = page.locator('text=Competitions').first();
    await compTab.click({ timeout: 15000 });
    await page.waitForTimeout(2500);

    // --- 3) Find and open Age Grade U14 competition ---
    const ageGradeRow = page
      .locator('[aria-label*="U14" i], [aria-label*="Age Grade" i], button:has-text("U14"), a:has-text("U14")')
      .first();
    await page.getByText(/Regional Age Grade|U14/i).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);

    let ageGradeOpened = false;
    if (await ageGradeRow.isVisible()) {
      await ageGradeRow.click();
      ageGradeOpened = true;
    } else {
      const anyU14 = page.locator('text=/U14|Regional Age Grade/').first();
      if (await anyU14.isVisible()) {
        await anyU14.click();
        ageGradeOpened = true;
      }
    }

    if (!ageGradeOpened) {
      results.blockers.push('Could not find or click Age Grade U14 competition');
    } else {
      await page.waitForTimeout(2500);
      results.ageGradeU14.scrollReachability = (await scrollToFixtures(page)) ? 'PASS' : 'FAIL';
      if (results.ageGradeU14.scrollReachability === 'FAIL') {
        results.blockers.push('Age Grade U14: Fixtures & Results not reachable by vertical scroll');
      }
      results.ageGradeU14.fixturesState = await recordFixturesState(page);
      results.tableNotes.push(
        'Age Grade U14: horizontal table ScrollView; vertical scroll via window.scrollBy'
      );
    }

    // --- 4) Back and open BUCS competition ---
    await page.goBack();
    await page.waitForTimeout(2000);

    const bucsRow = page
      .locator('[aria-label*="BUCS" i], button:has-text("BUCS"), a:has-text("BUCS")')
      .first();
    await page.getByText(/BUCS|Universities/).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);

    let bucsOpened = false;
    if (await bucsRow.isVisible()) {
      await bucsRow.click();
      bucsOpened = true;
    } else {
      const anyBucs = page.locator('text=BUCS').first();
      if (await anyBucs.isVisible()) {
        await anyBucs.click();
        bucsOpened = true;
      }
    }

    if (!bucsOpened) {
      results.blockers.push('Could not find or click BUCS competition');
    } else {
      await page.waitForTimeout(2500);
      results.bucs.scrollReachability = (await scrollToFixtures(page)) ? 'PASS' : 'FAIL';
      if (results.bucs.scrollReachability === 'FAIL') {
        results.blockers.push('BUCS: Fixtures & Results not reachable by vertical scroll');
      }
      results.bucs.fixturesState = await recordFixturesState(page);
      results.tableNotes.push('BUCS: same scroll behavior as Age Grade page');
    }
    } // end if authenticated

    // Output
    console.log('\n========== SMOKE TEST RESULTS ==========');
    console.log('Account creation:', results.accountCreation);
    console.log('Account sign-in:', results.accountSignIn);
    console.log('Age Grade U14 scroll reachability:', results.ageGradeU14.scrollReachability);
    console.log('Age Grade U14 fixtures section:', results.ageGradeU14.fixturesState);
    console.log('BUCS scroll reachability:', results.bucs.scrollReachability);
    console.log('BUCS fixtures section:', results.bucs.fixturesState);
    if (results.blockers.length) console.log('Blockers:', results.blockers);
    if (results.tableNotes.length) console.log('Table notes:', results.tableNotes);
    console.log('==========================================\n');

    // Smoke test reports checklist; assertion documents auth as gate for competition tests
    const authOk = results.accountCreation === 'PASS' || results.accountSignIn === 'PASS';
    expect(authOk, 'Account creation/sign-in must succeed to exercise competitions flow').toBeTruthy();
  });
});
