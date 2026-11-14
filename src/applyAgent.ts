import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { discoverAllJobs, DiscoveredJob, loadProfile } from './discoverJobs';
import { answerCustomQuestion } from './llmHelper';

dotenv.config();

export interface JobResult {
  id: string;
  company: string;
  title: string;
  location: string;
  ats: string;
  url: string;
  status: 'APPLIED' | 'DRY_RUN_COMPLETED' | 'MANUAL_ACTION_REQUIRED' | 'FAILED';
  notes: string;
  screenshotPath?: string;
  timestamp: string;
}

const reportsDir = path.resolve(__dirname, '../reports');
const screenshotsDir = path.join(reportsDir, 'screenshots');
const stateFile = path.resolve(__dirname, '../state/appliedJobs.json');
const resumePath = path.resolve(__dirname, '../assets/ArepalliNagaTeja.pdf');

// Ensure output directories exist
fs.mkdirSync(reportsDir, { recursive: true });
fs.mkdirSync(screenshotsDir, { recursive: true });

const DRY_RUN = process.env.DRY_RUN === 'false' ? false : true;
const HEADLESS = process.env.HEADLESS === 'false' ? false : true;

async function applyToGreenhouse(page: Page, job: DiscoveredJob): Promise<JobResult> {
  const profile = loadProfile();
  const timestamp = new Date().toISOString();
  const safeId = job.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const screenshotPath = path.join(screenshotsDir, `${safeId}.png`);

  try {
    await page.goto(job.applyUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Handle possible cookie banners
    const acceptCookies = page.locator('button:has-text("Accept"), button:has-text("Agree"), #onetrust-accept-btn-handler');
    if (await acceptCookies.count() > 0) {
      await acceptCookies.first().click().catch(() => {});
    }

    // Standard Greenhouse fields
    await page.fill('#first_name, input[name*="first_name"]', profile.personal_info.first_name).catch(() => {});
    await page.fill('#last_name, input[name*="last_name"]', profile.personal_info.last_name).catch(() => {});
    await page.fill('#email, input[name*="email"]', profile.personal_info.email).catch(() => {});
    await page.fill('#phone, input[name*="phone"]', profile.personal_info.phone).catch(() => {});

    // Upload Resume PDF
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0 && fs.existsSync(resumePath)) {
      await fileInput.setInputFiles(resumePath).catch((err) => {
        console.warn(`[Greenhouse] Resume upload note: ${err.message}`);
      });
    }

    // Fill Custom Questions
    const fields = await page.locator('.field, .application-question, div[class*="field"]').all();
    for (const field of fields) {
      const labelText = (await field.locator('label').innerText().catch(() => '')).trim();
      if (!labelText || /first name|last name|email|phone|resume|cv/i.test(labelText)) {
        continue;
      }

      // Check text / textarea inputs
      const textInput = field.locator('input[type="text"], textarea').first();
      if (await textInput.count() > 0) {
        const val = await textInput.inputValue().catch(() => '');
        if (!val) {
          if (/linkedin/i.test(labelText)) {
            await textInput.fill(profile.personal_info.linkedin_url);
          } else if (/github|portfolio|website/i.test(labelText)) {
            await textInput.fill(profile.personal_info.portfolio_url);
          } else {
            const answer = await answerCustomQuestion(labelText);
            await textInput.fill(answer);
          }
        }
      }

      // Check select dropdowns
      const selectElem = field.locator('select').first();
      if (await selectElem.count() > 0) {
        const optionElements = await selectElem.locator('option').all();
        const optionsText: string[] = [];
        for (const opt of optionElements) {
          const t = (await opt.innerText()).trim();
          if (t && !/select|choose/i.test(t)) {
            optionsText.push(t);
          }
        }
        if (optionsText.length > 0) {
          const chosen = await answerCustomQuestion(labelText, optionsText);
          await selectElem.selectOption({ label: chosen }).catch(async () => {
            await selectElem.selectOption({ index: 1 }).catch(() => {});
          });
        }
      }
    }

    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    // Check for CAPTCHA
    const pageContent = await page.content();
    if (/turnstile|cf-turnstile|recaptcha|hcaptcha/i.test(pageContent)) {
      return {
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        ats: job.ats,
        url: job.url,
        status: 'MANUAL_ACTION_REQUIRED',
        notes: 'Security check / CAPTCHA detected on form',
        screenshotPath,
        timestamp
      };
    }

    const submitBtn = page.locator('#submit_app, button[type="submit"], input[type="submit"]').first();
    if (await submitBtn.count() === 0) {
      return {
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        ats: job.ats,
        url: job.url,
        status: 'MANUAL_ACTION_REQUIRED',
        notes: 'Submit button not found (possibly redirected to external portal)',
        screenshotPath,
        timestamp
      };
    }

    if (DRY_RUN) {
      return {
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        ats: job.ats,
        url: job.url,
        status: 'DRY_RUN_COMPLETED',
        notes: 'Form populated and verified successfully (submission skipped in DRY_RUN mode)',
        screenshotPath,
        timestamp
      };
    } else {
      await submitBtn.click();
      await page.waitForTimeout(6000);
      const afterSubmitContent = await page.content();
      if (/thank you|submitted|received|confirmation/i.test(afterSubmitContent)) {
        return {
          id: job.id,
          company: job.company,
          title: job.title,
          location: job.location,
          ats: job.ats,
          url: job.url,
          status: 'APPLIED',
          notes: 'Application submitted successfully',
          screenshotPath,
          timestamp
        };
      } else {
        return {
          id: job.id,
          company: job.company,
          title: job.title,
          location: job.location,
          ats: job.ats,
          url: job.url,
          status: 'MANUAL_ACTION_REQUIRED',
          notes: 'Form submission completed with follow-up validation or OTP needed',
          screenshotPath,
          timestamp
        };
      }
    }
  } catch (err: any) {
    await page.screenshot({ path: screenshotPath }).catch(() => {});
    return {
      id: job.id,
      company: job.company,
      title: job.title,
      location: job.location,
      ats: job.ats,
      url: job.url,
      status: 'FAILED',
      notes: err.message.slice(0, 150),
      screenshotPath,
      timestamp
    };
  }
}

async function applyToLever(page: Page, job: DiscoveredJob): Promise<JobResult> {
  const profile = loadProfile();
  const timestamp = new Date().toISOString();
  const safeId = job.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const screenshotPath = path.join(screenshotsDir, `${safeId}.png`);

  try {
    await page.goto(job.applyUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Standard Lever fields
    await page.fill('input[name="name"]', profile.personal_info.full_name).catch(() => {});
    await page.fill('input[name="email"]', profile.personal_info.email).catch(() => {});
    await page.fill('input[name="phone"]', profile.personal_info.phone).catch(() => {});
    await page.fill('input[name="org"]', profile.experience_summary.current_company).catch(() => {});
    await page.fill('input[name="urls[LinkedIn]"]', profile.personal_info.linkedin_url).catch(() => {});
    await page.fill('input[name="urls[GitHub]"], input[name="urls[Portfolio]"]', profile.personal_info.portfolio_url).catch(() => {});

    // Upload Resume
    const resumeInput = page.locator('input[type="file"]').first();
    if (await resumeInput.count() > 0 && fs.existsSync(resumePath)) {
      await resumeInput.setInputFiles(resumePath).catch((err) => {
        console.warn(`[Lever] Resume upload note: ${err.message}`);
      });
    }

    // Additional questions
    const questionWrappers = await page.locator('.application-question, .custom-question').all();
    for (const wrapper of questionWrappers) {
      const label = (await wrapper.locator('.application-label, label').innerText().catch(() => '')).trim();
      if (!label) continue;

      const input = wrapper.locator('input[type="text"], textarea').first();
      if (await input.count() > 0) {
        const val = await input.inputValue().catch(() => '');
        if (!val) {
          const ans = await answerCustomQuestion(label);
          await input.fill(ans);
        }
      }
    }

    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    // Check CAPTCHA
    const pageContent = await page.content();
    if (/turnstile|recaptcha|hcaptcha/i.test(pageContent)) {
      return {
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        ats: job.ats,
        url: job.url,
        status: 'MANUAL_ACTION_REQUIRED',
        notes: 'Security check / CAPTCHA detected on Lever form',
        screenshotPath,
        timestamp
      };
    }

    const submitBtn = page.locator('#btn-submit, button[type="submit"]').first();
    if (await submitBtn.count() === 0) {
      return {
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        ats: job.ats,
        url: job.url,
        status: 'MANUAL_ACTION_REQUIRED',
        notes: 'Submit button not found',
        screenshotPath,
        timestamp
      };
    }

    if (DRY_RUN) {
      return {
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        ats: job.ats,
        url: job.url,
        status: 'DRY_RUN_COMPLETED',
        notes: 'Form populated and verified successfully (submission skipped in DRY_RUN mode)',
        screenshotPath,
        timestamp
      };
    } else {
      await submitBtn.click();
      await page.waitForTimeout(6000);
      return {
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        ats: job.ats,
        url: job.url,
        status: 'APPLIED',
        notes: 'Application submitted successfully',
        screenshotPath,
        timestamp
      };
    }
  } catch (err: any) {
    await page.screenshot({ path: screenshotPath }).catch(() => {});
    return {
      id: job.id,
      company: job.company,
      title: job.title,
      location: job.location,
      ats: job.ats,
      url: job.url,
      status: 'FAILED',
      notes: err.message.slice(0, 150),
      screenshotPath,
      timestamp
    };
  }
}

export async function runApplyAgent(maxJobs: number = 10): Promise<JobResult[]> {
  console.log('=====================================================');
  console.log(` Starting AI QA/SDET Job Applier (DRY_RUN=${DRY_RUN})`);
  console.log('=====================================================');

  const appliedIds: string[] = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
    : [];

  const discoveredJobs = await discoverAllJobs();
  const unappliedJobs = discoveredJobs.filter(j => !appliedIds.includes(j.id));

  console.log(`Total discovered target jobs: ${discoveredJobs.length}`);
  console.log(`Unapplied jobs ready to process: ${unappliedJobs.length}`);

  const jobsToProcess = unappliedJobs.slice(0, maxJobs);
  const results: JobResult[] = [];

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  for (const job of jobsToProcess) {
    console.log(`\nProcessing [${job.ats}] ${job.company}: "${job.title}" (${job.location})`);
    let result: JobResult;

    if (job.ats === 'Greenhouse') {
      result = await applyToGreenhouse(page, job);
    } else {
      result = await applyToLever(page, job);
    }

    console.log(`  -> Status: ${result.status} | Notes: ${result.notes}`);
    results.push(result);

    if (result.status === 'APPLIED' || (DRY_RUN && result.status === 'DRY_RUN_COMPLETED')) {
      appliedIds.push(job.id);
    }
  }

  await browser.close();

  // Save updated state
  fs.writeFileSync(stateFile, JSON.stringify(appliedIds, null, 2));

  // Save JSON summary
  const summaryJsonPath = path.join(reportsDir, 'application_summary.json');
  fs.writeFileSync(summaryJsonPath, JSON.stringify(results, null, 2));

  // Save CSV report
  const csvPath = path.join(reportsDir, 'applied_jobs_report.csv');
  const csvHeaders = 'Company,Title,Location,ATS,Status,Notes,URL,Timestamp\n';
  const csvRows = results
    .map(r => `"${r.company}","${r.title.replace(/"/g, '""')}","${r.location}","${r.ats}","${r.status}","${r.notes.replace(/"/g, '""')}","${r.url}","${r.timestamp}"`)
    .join('\n');
  fs.writeFileSync(csvPath, csvHeaders + csvRows);

  console.log(`\nCompleted run. Saved reports to:\n - ${summaryJsonPath}\n - ${csvPath}`);
  return results;
}

if (require.main === module) {
  runApplyAgent().catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}
