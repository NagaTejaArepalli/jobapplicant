import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { loadProfile } from './discoverJobs';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Smart domain-aware fallback answerer when LLM is unavailable or offline
 */
export function heuristicAnswer(question: string, options?: string[]): string {
  const q = question.toLowerCase().trim();
  const profile = loadProfile();

  // If options exist, select the best matching option from the dropdown / radio choices
  if (options && options.length > 0) {
    // Export rule / Sanctions
    if (q.includes('export') || q.includes('sanction') || q.includes('embargo')) {
      const noOpt = options.find(o => /^no\b/i.test(o.trim()) || /not affected/i.test(o));
      if (noOpt) return noOpt;
    }

    // Work authorization
    if (q.includes('authorized') || q.includes('authorization') || q.includes('legally')) {
      const yesOpt = options.find(o => /^yes\b/i.test(o.trim()) || /authorized/i.test(o));
      if (yesOpt) return yesOpt;
    }

    // Visa sponsorship
    if (q.includes('sponsorship') || q.includes('visa')) {
      const noOpt = options.find(o => /^no\b/i.test(o.trim()) || /do not require/i.test(o));
      if (noOpt) return noOpt;
    }

    // Previously worked for company
    if (q.includes('previously worked') || q.includes('former employee') || q.includes('worked for')) {
      const noOpt = options.find(o => /^no\b/i.test(o.trim()));
      if (noOpt) return noOpt;
    }

    // Degree / Education level
    if (q.includes('degree') || q.includes('education level')) {
      const bachelorOpt = options.find(o => /bachelor/i.test(o));
      if (bachelorOpt) return bachelorOpt;
    }

    // Discipline / Major / Field of study
    if (q.includes('discipline') || q.includes('major') || q.includes('field of study')) {
      const csOpt = options.find(o => /computer science/i.test(o));
      if (csOpt) return csOpt;
      const engOpt = options.find(o => /engineering/i.test(o));
      if (engOpt) return engOpt;
    }

    // Relocation
    if (q.includes('relocat')) {
      const yesOpt = options.find(o => /^yes\b/i.test(o.trim()));
      if (yesOpt) return yesOpt;
    }

    // How did you hear about this role
    if (q.includes('hear') || q.includes('source') || q.includes('referral') || q.includes('find this job')) {
      const linkedInOpt = options.find(o => /linkedin/i.test(o));
      if (linkedInOpt) return linkedInOpt;
      const siteOpt = options.find(o => /career|website|company/i.test(o));
      if (siteOpt) return siteOpt;
      const boardOpt = options.find(o => /job board|online/i.test(o));
      if (boardOpt) return boardOpt;
      const otherOpt = options.find(o => /other/i.test(o));
      if (otherOpt) return otherOpt;
    }

    // Equal opportunity / Diversity (Gender, Race, Veteran, Disability)
    if (q.includes('gender') || q.includes('race') || q.includes('veteran') || q.includes('disability') || q.includes('demographic')) {
      const declineOpt = options.find(o => /prefer not|decline|do not wish|choose not|not disclose/i.test(o));
      if (declineOpt) return declineOpt;
      const noOpt = options.find(o => /^no\b|not a veteran|no disability/i.test(o.trim()));
      if (noOpt) return noOpt;
    }

    // Notice period
    if (q.includes('notice') || q.includes('how soon') || q.includes('joining')) {
      const noticeOpt = options.find(o => /30|1 month|< 1 month|immediate/i.test(o));
      if (noticeOpt) return noticeOpt;
    }

    // Experience ranges
    if (q.includes('experience') || q.includes('years')) {
      const expOpt = options.find(o => /\b3\b|3-5|3 - 5|3 to 5/i.test(o));
      if (expOpt) return expOpt;
    }

    // Default to the first reasonable non-placeholder option
    const validOpt = options.find(o => !/select|choose|please/i.test(o));
    return validOpt || options[0];
  }

  // Text inputs heuristics:

  // Current or most recent employer / company
  if (q.includes('employer') || q.includes('company') || q.includes('organization') || q.includes('current firm')) {
    return profile.experience_summary.current_company || 'Infor';
  }

  // Current or most recent title / designation / role
  if (q.includes('title') || q.includes('designation') || q.includes('current role') || q.includes('job role')) {
    return profile.experience_summary.current_title || 'QA Engineer (SDET)';
  }

  // How did you hear about this role
  if (q.includes('hear about') || q.includes('how did you find') || q.includes('referral') || q.includes('source')) {
    return 'Company Careers Website';
  }

  // Work Authorization / Visa / Deemed Export
  if (q.includes('export') || q.includes('sanction') || q.includes('embargo')) {
    return 'No';
  }
  if (q.includes('authorized to work') || q.includes('legally authorized') || q.includes('right to work')) {
    return 'Yes';
  }
  if (q.includes('sponsorship') || q.includes('visa')) {
    return profile.hr_logistics.requires_visa_sponsorship_in_india || 'No';
  }

  // Logistics & Relocation
  if (q.includes('relocate') || q.includes('relocation')) {
    return profile.hr_logistics.willing_to_relocate_to_hyderabad || 'Yes';
  }
  if (q.includes('notice') || q.includes('how soon') || q.includes('joining period')) {
    return profile.hr_logistics.notice_period_days || '30';
  }
  if (q.includes('current ctc') || q.includes('current salary') || q.includes('current compensation') || q.includes('fixed ctc')) {
    return profile.hr_logistics.current_ctc_lpa ? `${profile.hr_logistics.current_ctc_lpa} LPA` : '14 LPA';
  }
  if (q.includes('expected ctc') || q.includes('expected salary') || q.includes('expected compensation')) {
    return profile.hr_logistics.expected_ctc_lpa ? `${profile.hr_logistics.expected_ctc_lpa} LPA` : '22 LPA';
  }

  // Experience queries
  if (q.includes('years') || q.includes('experience') || q.includes('how long')) {
    return profile.experience_summary.relevant_automation_years || '3.5';
  }

  // Education queries
  if (q.includes('degree') || q.includes('qualification') || q.includes('highest education')) {
    return profile.experience_summary.education?.degree || 'Bachelor of Technology in Computer Science';
  }
  if (q.includes('university') || q.includes('college') || q.includes('institute') || q.includes('school')) {
    return profile.experience_summary.education?.university || 'Vel Tech Rangarajan Dr. Sagunthala R&D Institute';
  }
  if (q.includes('graduation year') || q.includes('year of pass') || q.includes('passing year')) {
    return String(profile.experience_summary.education?.graduation_year || '2023');
  }
  if (q.includes('grade') || q.includes('gpa') || q.includes('cgpa') || q.includes('percentage')) {
    return profile.experience_summary.education?.grade || 'First Class with Distinction';
  }

  // Location / Address queries
  if (q.includes('city') || q.includes('town')) {
    return 'Bengaluru';
  }
  if (q.includes('state') || q.includes('province')) {
    return 'Karnataka';
  }
  if (q.includes('country')) {
    return 'India';
  }
  if (q.includes('postal') || q.includes('pincode') || q.includes('zip')) {
    return '560001';
  }
  if (q.includes('address') || q.includes('current location')) {
    return profile.personal_info.current_location || 'Bengaluru, Karnataka, India';
  }

  // Online profile URLs
  if (q.includes('linkedin')) {
    return profile.personal_info.linkedin_url;
  }
  if (q.includes('github') || q.includes('portfolio') || q.includes('website') || q.includes('url')) {
    return profile.personal_info.portfolio_url;
  }

  // Cover letter / why join
  if (q.includes('cover letter') || q.includes('why do you want') || q.includes('summary') || q.includes('describe yourself')) {
    return 'Passionate Senior QA Automation Engineer & SDET with 3.5+ years of experience in enterprise test automation, Playwright, Selenium, and CI/CD pipelines.';
  }

  return 'N/A';
}

export async function answerCustomQuestion(questionLabel: string, options?: string[]): Promise<string> {
  const profile = loadProfile();

  if (!genAI) {
    return heuristicAnswer(questionLabel, options);
  }

  try {
    const prompt = `
You are filling out a job application on behalf of candidate ${profile.personal_info.full_name}.
Candidate Profile & Resume Context:
${JSON.stringify(profile, null, 2)}

Question asked on the application form:
"${questionLabel}"

${options && options.length > 0 ? `Available dropdown/radio choices: ${JSON.stringify(options)}` : ''}

Rules:
1. Reply ONLY with the exact, concise value to enter into the input field (or the exact matching option string if choices are provided).
2. If asked for current or most recent employer/company, answer "${profile.experience_summary.current_company}".
3. If asked for current or most recent title/role, answer "${profile.experience_summary.current_title}".
4. If asked how you heard about the job, answer "Company Careers Website" or match "LinkedIn".
5. If asked for years of experience in Java, Selenium, Playwright, BDD, API, or QA, answer "3.5" (or "3" if integer required).
6. If asked about notice period, answer "30 days" or "30".
7. If asked about current CTC, answer "14 LPA" or "14".
8. If asked about expected CTC, answer "22 LPA" or "22".
9. If asked about relocation or hybrid work in India, answer "Yes".
10. If asked about requiring visa sponsorship in India, answer "No".
11. If asked about export compliance / sanctions affecting employment, answer "No".
12. If asked if authorized to work in the country, answer "Yes".
13. Never dump a generic sentence about years of experience into fields that ask for company, title, or source.
`;

    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-flash-latest',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-pro-latest'
    ].filter(Boolean) as string[];
    let text = '';

    for (const m of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const result = await model.generateContent(prompt);
        text = result.response.text().trim();
        if (text) {
          break;
        }
      } catch (innerErr: any) {
        if (innerErr.message && (innerErr.message.includes('404') || innerErr.message.includes('not found') || innerErr.message.includes('no longer available'))) {
          continue;
        }
        throw innerErr;
      }
    }
    return text || heuristicAnswer(questionLabel, options);
  } catch (err: any) {
    console.warn(`[LLM Helper] Gemini API fallback used (${err.message}).`);
    return heuristicAnswer(questionLabel, options);
  }
}
