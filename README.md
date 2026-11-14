# AI QA/SDET Job Applier Agent (Bengaluru, Hyderabad & Pan-India)

An automated AI-powered agent designed to discover active QA/SDET openings directly from company career portals (Greenhouse and Lever ATS APIs) and automate the application process using **Playwright** + **Google Gemini AI**, with automated daily email summaries and scheduled execution via **GitLab CI/CD**.

---

## 🎯 Architecture & Advantages

Unlike scrapers that query LinkedIn or Naukri (which often result in "Easy Apply" black holes, stale postings, or recruiter ghosting), this agent communicates directly with official career ATS endpoints:
- **Greenhouse API** (`boards-api.greenhouse.io`)
- **Lever API** (`api.lever.co`)

### Key Features
1. **Direct-to-ATS Discovery**: Queries official ATS APIs for fresh roles in Bengaluru, Hyderabad, Pune, Chennai, and remote India.
2. **AI-Powered Screening Form Filler**: Uses Gemini 2.5 Flash to dynamically answer complex custom screening questions (CTC, Notice Period, Years of experience with Playwright / Selenium / Java / API, etc.) strictly grounded in candidate data.
3. **Smart Heuristic Fallback**: Includes deterministic fallbacks so the bot continues to work smoothly even if offline or if no Gemini API key is provided.
4. **Duplicate Prevention**: Maintains a persistent state ledger (`state/appliedJobs.json`) cached across runs.
5. **Dry-Run Safe Mode**: Configurable `DRY_RUN=true` mode by default, allowing end-to-end form population, validation, and screenshot verification without submitting duplicates.
6. **Consolidated Email Reporter**: Compiles an HTML report table + CSV attachment and delivers it via SMTP right after each execution.
7. **GitLab CI/CD Scheduled Runner**: Runs in official Microsoft Playwright containers with artifact archiving and scheduling support.

---

## 📁 Repository Structure

```
JOBAPPLIERAGENT/
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
├── .gitlab-ci.yml                  # GitLab CI/CD pipeline definition
├── .env.example                    # Environment variable template
├── package.json
└── tsconfig.json
```

---

## 🚀 Quick Start (Local Setup)

### 1. Install Dependencies
```bash
npm install
npx playwright install chromium
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your details:
```bash
cp .env.example .env
```
Key variables:
- `GEMINI_API_KEY`: Your Google AI Studio API key.
- `SMTP_USER`: Your Gmail address (e.g. `nagateja2704@gmail.com`).
- `SMTP_PASS`: 16-character Google App Password (generated from Google Account → Security → 2-Step Verification → App Passwords).
- `DRY_RUN`: Set to `true` to test form filling without final submission, or `false` for live submissions.
- `HEADLESS`: `true` for headless execution or `false` to watch the browser in real time.

### 3. Replace Resume File
Replace `assets/ArepalliNagaTeja.pdf` with your updated PDF resume.

---

## 🛠 Available Commands

| Command | Description |
|---|---|
| `npm run discover` | Queries Greenhouse & Lever APIs and displays all matching QA/SDET roles in India. |
| `npm run apply` | Executes the Playwright agent to fill forms and record results. |
| `npm run email` | Compiles the consolidated HTML table & CSV and emails the report. |
| `npm start` | Executes the full pipeline: discover, apply, and email report. |
| `npm run build` | Compiles TypeScript code to `dist/`. |

---

## ⚙️ GitLab CI/CD Setup

1. **Push this repository to GitLab**:
   ```bash
   git add .
   git commit -m "feat: complete AI SDET job applier agent"
   git remote add origin <your-gitlab-repo-url>
   git push -u origin main
   ```

2. **Add CI/CD Variables** in **GitLab → Settings → CI/CD → Variables**:
   - `GEMINI_API_KEY`: (Masked) Your Google AI Studio API key.
   - `SMTP_USER`: (Masked) Your email address.
   - `SMTP_PASS`: (Masked) Your 16-character Google App Password.
   - `DRY_RUN`: `false` (for live applications) or `true` (for test runs).

3. **Set Scheduled Runs**:
   - Go to **GitLab → Build → Pipeline schedules**.
   - Create a new schedule (e.g., `0 9 * * 1-5` for 9:00 AM IST every weekday).

---

## 🔒 Security & Anti-Bot Best Practices
- The agent respects rate limits and processes in configurable batches (default 10-15 applications per run).
- Any job page requiring strict human CAPTCHAs or OTP verification is flagged with status `MANUAL_ACTION_REQUIRED` and direct job URLs are included in your daily report so you can complete them in 30 seconds.
