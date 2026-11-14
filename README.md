# AI QA/SDET Job Applier Agent (Bengaluru, Hyderabad & Pan-India)

An automated AI-powered agent designed to discover active QA/SDET openings directly from company career portals (Greenhouse and Lever ATS APIs) and automate the application process using **Playwright** + **Google Gemini AI**, with automated daily email summaries and multi-platform automation support (**GitHub Actions**, **GitLab CI/CD**, or **Local Windows/Mac Task Scheduler**).

---

## 🎯 Architecture & Advantages

Unlike scrapers that query LinkedIn or Naukri (which often result in "Easy Apply" black holes, stale postings, or recruiter ghosting), this agent communicates directly with official career ATS endpoints:
- **Greenhouse API** (`boards-api.greenhouse.io`)
- **Lever API** (`api.lever.co`)

### Key Features
1. **Direct-to-ATS Discovery**: Queries official ATS APIs for fresh roles in Bengaluru, Hyderabad, Pune, Chennai, and remote India.
2. **AI-Powered Screening Form Filler**: Uses Gemini 2.5 Flash to dynamically answer complex custom screening questions (CTC, Notice Period, Years of experience with Playwright / Selenium / Java / API, etc.) strictly grounded in candidate data.
3. **Smart Heuristic Fallback**: Includes deterministic fallbacks so the bot continues to work smoothly even if offline or if no Gemini API key is provided.
4. **Duplicate Prevention**: Maintains a persistent state ledger (`state/appliedJobs.json`) cached and committed across runs.
5. **Dry-Run Safe Mode**: Configurable `DRY_RUN=true` mode by default, allowing end-to-end form population, validation, and screenshot verification without submitting duplicates.
6. **Consolidated Email Reporter**: Compiles an HTML report table + CSV attachment and delivers it via SMTP right after each execution.

---

## 📁 Repository Structure

```
JOBAPPLIERAGENT/
├── .github/workflows/
│   └── agent.yml                   # GitHub Actions workflow (2,000 free mins, no credit card)
├── .gitlab-ci.yml                  # GitLab CI/CD pipeline definition
├── assets/
│   └── ArepalliNagaTeja.pdf        # Candidate resume PDF (uploaded on application forms)
├── config/
│   ├── candidateProfile.json       # Candidate experience, education, HR logistics & preferences
│   └── targetCompanies.json        # Curated list of Greenhouse & Lever company boards
├── state/
│   └── appliedJobs.json            # Deduplication ledger tracking applied job IDs
├── src/
│   ├── discoverJobs.ts             # Fetches & filters QA/SDET jobs via ATS APIs
│   ├── llmHelper.ts                # Gemini AI + heuristic screening question engine
│   ├── applyAgent.ts               # Playwright browser automation & form filler
│   └── sendEmailReport.ts          # Consolidated HTML email + CSV reporter
├── reports/
│   ├── application_summary.json    # JSON output of the last run
│   ├── applied_jobs_report.csv     # CSV report of applications
│   └── screenshots/                # Full-page screenshots captured during runs
├── run_agent.bat                   # 1-click Windows runner / Task Scheduler script
├── run_agent.ps1                   # Windows PowerShell runner
├── run_agent.sh                    # Linux / macOS / crontab runner
├── .env.example                    # Environment variable template
├── package.json
└── tsconfig.json
```

---

## ⚡ 3 Ways to Run for Free (Bypassing GitLab Credit Card Check)

### Option 1: GitHub Actions (Recommended — 100% Free, No Credit Card)
GitHub Actions provides **2,000 free minutes per month** with no credit card required.

1. **Push your repository to GitHub**:
   ```bash
   git remote add github https://github.com/<your-username>/<your-repo-name>.git
   git push -u github main
   ```
2. **Add Secrets** in your GitHub repo under **Settings → Secrets and variables → Actions**:
   - `GEMINI_API_KEY`: Your Google AI Studio API key.
   - `SMTP_USER`: `nagateja2704@gmail.com`
   - `SMTP_PASS`: Your 16-character Google App Password.
3. **Execution**:
   - The workflow automatically runs on a schedule every weekday at **9:00 AM IST** (`30 3 * * 1-5` UTC).
   - You can also run it manually anytime by going to the **Actions** tab → **SDET Auto-Apply Agent** → **Run workflow**.

---

### Option 2: Keep GitLab with a Free Self-Hosted "Local Runner"
If you prefer GitLab, bypass their credit card verification by registering your own laptop as a GitLab runner:

1. Download the GitLab runner binary for your OS: [GitLab Runner Install Docs](https://docs.gitlab.com/runner/install/).
2. In your GitLab project, go to **Settings → CI/CD → Runners**.
3. Under **Project runners**, click **New project runner** and tag it (e.g., `playwright`, `windows`).
4. Run the registration command shown by GitLab in your terminal.
5. Once registered, start the runner (`gitlab-runner run`). Any pipeline trigger will now execute directly on your machine without requiring a credit card!

---

### Option 3: Run Locally via Windows Task Scheduler or Crontab
Run the bot completely on your local machine with zero cloud configuration:

1. Copy `.env.example` to `.env` and fill in your credentials (`GEMINI_API_KEY`, `SMTP_USER`, `SMTP_PASS`).
2. Test by double-clicking `run_agent.bat` (or executing `run_agent.ps1` in PowerShell).
3. **Automate with Windows Task Scheduler**:
   - Open **Task Scheduler** in Windows (`taskschd.msc`).
   - Click **Create Basic Task** → Name: "SDET Job Applier".
   - Trigger: **Daily** at **9:00 AM**.
   - Action: **Start a program** → Program/script: `d:\AI Projects\JOBAPPLIERAGENT\run_agent.bat`.
   - Add argument: `--no-pause`.

---

## 🛠 Manual Execution Commands

| Command | Description |
|---|---|
| `npm run discover` | Queries Greenhouse & Lever APIs and displays all matching QA/SDET roles in India. |
| `npm run apply` | Executes the Playwright agent to fill forms and record results. |
| `npm run email` | Compiles the consolidated HTML table & CSV and emails the report. |
| `npm start` | Executes the full pipeline: discover, apply, and email report. |
| `npm run build` | Compiles TypeScript code to `dist/`. |
