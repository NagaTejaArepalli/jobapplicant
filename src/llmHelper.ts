import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { loadProfile } from './discoverJobs';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Fallback heuristic answerer when LLM is unavailable or offline
 */
function heuristicAnswer(question: string, options?: string[]): string {
  const q = question.toLowerCase();
  const profile = loadProfile();

  // If options exist, select the best matching option
  if (options && options.length > 0) {
    if (q.includes('relocat')) {
      const yesOpt = options.find(o => /^yes/i.test(o));
      if (yesOpt) return yesOpt;
    }
    if (q.includes('sponsorship') || q.includes('visa')) {
      const noOpt = options.find(o => /^no/i.test(o));
      if (noOpt) return noOpt;
    }
    if (q.includes('gender') || q.includes('race') || q.includes('veteran') || q.includes('disability')) {
      const declineOpt = options.find(o => /prefer not|decline|do not wish|choose not/i.test(o));
      if (declineOpt) return declineOpt;
    }
    if (q.includes('notice')) {
      const noticeOpt = options.find(o => /30|1 month|< 1 month/i.test(o));
      if (noticeOpt) return noticeOpt;
    }
    if (q.includes('experience') || q.includes('years')) {
      const expOpt = options.find(o => /3|3-5|3 - 5|3 to 5/i.test(o));
      if (expOpt) return expOpt;
    }
    return options[0];
  }

  // Text heuristics
  if (q.includes('notice') || q.includes('how soon')) {
    return profile.hr_logistics.notice_period_days || '30';
  }
  if (q.includes('current ctc') || q.includes('current salary') || q.includes('current compensation')) {
    return profile.hr_logistics.current_ctc_lpa || '14';
  }
  if (q.includes('expected ctc') || q.includes('expected salary') || q.includes('expected compensation')) {
    return profile.hr_logistics.expected_ctc_lpa || '22';
  }
  if (q.includes('years') && (q.includes('experience') || q.includes('playwright') || q.includes('selenium') || q.includes('automation') || q.includes('qa') || q.includes('testing') || q.includes('java'))) {
    return profile.experience_summary.relevant_automation_years || '3.5';
  }
  if (q.includes('relocate') || q.includes('relocation')) {
    return profile.hr_logistics.willing_to_relocate_to_hyderabad || 'Yes';
  }
  if (q.includes('visa') || q.includes('sponsorship')) {
    return profile.hr_logistics.requires_visa_sponsorship_in_india || 'No';
  }
  if (q.includes('city') || q.includes('location')) {
    return profile.personal_info.current_location || 'Bengaluru, India';
  }
  if (q.includes('linkedin')) {
    return profile.personal_info.linkedin_url;
  }
  if (q.includes('github') || q.includes('portfolio') || q.includes('website')) {
    return profile.personal_info.portfolio_url;
  }

  return '3.5 years of experience in QA Automation and SDET with Playwright, Selenium, and API testing.';
}

export async function answerCustomQuestion(questionLabel: string, options?: string[]): Promise<string> {
  const profile = loadProfile();

  if (!genAI) {
    return heuristicAnswer(questionLabel, options);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `
You are filling out a job application on behalf of candidate ${profile.personal_info.full_name}.
Candidate Profile & Resume Context:
${JSON.stringify(profile, null, 2)}

Question asked on the application form:
"${questionLabel}"

${options && options.length > 0 ? `Available dropdown/radio choices: ${JSON.stringify(options)}` : ''}

Rules:
1. Reply ONLY with the exact, concise value to enter into the input field (or the exact matching option string if choices are provided). Do not add markdown or extra sentences.
2. If asked for years of experience in Java, Selenium, Playwright, BDD, API, or QA, answer "3.5" (or "3" if an integer is required).
3. If asked about notice period, answer "30 days" or "30".
4. If asked about current CTC, answer "14 LPA" or "14".
5. If asked about expected CTC, answer "22 LPA" or "22".
6. If asked about relocation or hybrid work in India, answer "Yes".
7. If asked about requiring visa sponsorship in India, answer "No".
8. Never fabricate skills or experience outside the candidate profile.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text || heuristicAnswer(questionLabel, options);
  } catch (err: any) {
    console.warn(`[LLM Helper] Gemini API fallback used (${err.message}).`);
    return heuristicAnswer(questionLabel, options);
  }
}
