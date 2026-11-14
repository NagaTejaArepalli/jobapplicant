import * as fs from 'fs';
import * as path from 'path';

export interface DiscoveredJob {
  id: string;
  company: string;
  title: string;
  location: string;
  ats: 'Greenhouse' | 'Lever';
  url: string;
  applyUrl: string;
}

export function loadProfile() {
  const profilePath = path.resolve(__dirname, '../config/candidateProfile.json');
  return JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
}

export function loadTargetCompanies() {
  const companiesPath = path.resolve(__dirname, '../config/targetCompanies.json');
  return JSON.parse(fs.readFileSync(companiesPath, 'utf-8'));
}

export async function fetchGreenhouseJobs(): Promise<DiscoveredJob[]> {
  const profile = loadProfile();
  const companies = loadTargetCompanies();
  const matchedJobs: DiscoveredJob[] = [];

  const locationRegex = /\b(india|bangalore|bengaluru|hyderabad|pune|chennai|noida|gurugram|gurgaon|mumbai)\b|remote.*india|india.*remote/i;
  const foreignCountryRegex = /\b(brazil|united states|usa|canada|germany|australia|singapore|japan|france|uk|united kingdom)\b/i;
  const targetRegex = new RegExp(profile.target_preferences.target_keywords.join('|'), 'i');
  const excludeRegex = new RegExp(profile.target_preferences.exclude_title_keywords.join('|'), 'i');
  const excludedCompanies = (profile.target_preferences.exclude_companies || []).map((c: string) => c.toLowerCase());

  for (const board of companies.greenhouse || []) {
    if (excludedCompanies.includes(board.toLowerCase())) {
      continue;
    }

    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`);
      if (!res.ok) {
        continue;
      }
      const data: any = await res.json();
      for (const job of data.jobs || []) {
        const title = job.title || '';
        const loc = job.location?.name || '';
        const matchesLoc = locationRegex.test(loc) && !foreignCountryRegex.test(loc);
        const matchesRole = targetRegex.test(title);
        const isExcluded = excludeRegex.test(title);

        if (matchesLoc && matchesRole && !isExcluded) {
          matchedJobs.push({
            id: `gh_${board}_${job.id}`,
            company: board.toUpperCase(),
            title: title.trim(),
            location: loc.trim(),
            ats: 'Greenhouse',
            url: job.absolute_url,
            applyUrl: job.absolute_url
          });
        }
      }
    } catch (err: any) {
      console.warn(`[Greenhouse] Notice fetching board "${board}": ${err.message}`);
    }
  }

  return matchedJobs;
}

export async function fetchLeverJobs(): Promise<DiscoveredJob[]> {
  const profile = loadProfile();
  const companies = loadTargetCompanies();
  const matchedJobs: DiscoveredJob[] = [];

  const locationRegex = /\b(india|bangalore|bengaluru|hyderabad|pune|chennai|noida|gurugram|gurgaon|mumbai)\b|remote.*india|india.*remote/i;
  const foreignCountryRegex = /\b(brazil|united states|usa|canada|germany|australia|singapore|japan|france|uk|united kingdom)\b/i;
  const targetRegex = new RegExp(profile.target_preferences.target_keywords.join('|'), 'i');
  const excludeRegex = new RegExp(profile.target_preferences.exclude_title_keywords.join('|'), 'i');
  const excludedCompanies = (profile.target_preferences.exclude_companies || []).map((c: string) => c.toLowerCase());

  for (const board of companies.lever || []) {
    if (excludedCompanies.includes(board.toLowerCase())) {
      continue;
    }

    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${board}?mode=json`);
      if (!res.ok) {
        continue;
      }
      const postings: any[] = await res.json();
      for (const job of postings || []) {
        const title = job.text || '';
        const loc = job.categories?.location || '';
        const allText = `${loc} ${job.description || ''}`;
        const matchesLoc = (locationRegex.test(loc) || locationRegex.test(allText)) && !foreignCountryRegex.test(loc);
        const matchesRole = targetRegex.test(title);
        const isExcluded = excludeRegex.test(title);

        if (matchesLoc && matchesRole && !isExcluded) {
          matchedJobs.push({
            id: `lever_${board}_${job.id}`,
            company: board.toUpperCase(),
            title: title.trim(),
            location: loc.trim() || 'India / Remote',
            ats: 'Lever',
            url: job.hostedUrl,
            applyUrl: job.applyUrl || `${job.hostedUrl}/apply`
          });
        }
      }
    } catch (err: any) {
      console.warn(`[Lever] Notice fetching board "${board}": ${err.message}`);
    }
  }

  return matchedJobs;
}

export async function discoverAllJobs(): Promise<DiscoveredJob[]> {
  const [greenhouseJobs, leverJobs] = await Promise.all([
    fetchGreenhouseJobs(),
    fetchLeverJobs()
  ]);
  return [...greenhouseJobs, ...leverJobs];
}

// Standalone execution support
if (require.main === module) {
  (async () => {
    console.log('--- Discovering QA/SDET Jobs from Greenhouse & Lever APIs ---');
    const jobs = await discoverAllJobs();
    console.log(`Discovered ${jobs.length} target matching jobs across India hubs:\n`);
    jobs.forEach((j, idx) => {
      console.log(`${idx + 1}. [${j.ats}] ${j.company} - ${j.title} (${j.location})`);
      console.log(`   Link: ${j.url}`);
    });
  })();
}
