import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { loadProfile } from './discoverJobs';

dotenv.config();

export async function sendEmailReport() {
  const profile = loadProfile();
  const reportsDir = path.resolve(__dirname, '../reports');
  const summaryJsonPath = path.join(reportsDir, 'application_summary.json');
  const csvReportPath = path.join(reportsDir, 'applied_jobs_report.csv');

  let results: any[] = [];
  if (fs.existsSync(summaryJsonPath)) {
    try {
      results = JSON.parse(fs.readFileSync(summaryJsonPath, 'utf-8'));
    } catch (e) {
      console.warn('Could not parse summary JSON file.');
    }
  }

  const recipientEmail = process.env.REPORT_EMAIL || profile.personal_info.email || 'nagateja2704@gmail.com';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  console.log(`\n=====================================================`);
  console.log(` Generating Consolidated Email Report for ${recipientEmail}`);
  console.log(`=====================================================`);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPLIED': return '#16a34a';
      case 'DRY_RUN_COMPLETED': return '#2563eb';
      case 'MANUAL_ACTION_REQUIRED': return '#d97706';
      default: return '#dc2626';
    }
  };

  const rowsHtml = results.map((r: any) => `
    <tr>
      <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600;">${r.company}</td>
      <td style="padding:10px;border:1px solid #e5e7eb;">${r.title}</td>
      <td style="padding:10px;border:1px solid #e5e7eb;">${r.location}</td>
      <td style="padding:10px;border:1px solid #e5e7eb;color:${getStatusColor(r.status)};font-weight:700;">${r.status}</td>
      <td style="padding:10px;border:1px solid #e5e7eb;font-size:13px;color:#4b5563;">${r.notes}</td>
      <td style="padding:10px;border:1px solid #e5e7eb;"><a href="${r.url}" style="color:#2563eb;text-decoration:none;font-weight:500;" target="_blank">View Job</a></td>
    </tr>
  `).join('');

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #1e293b; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 20px;">QA/SDET Auto-Apply Agent Daily Report</h2>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Candidate: <b>${profile.personal_info.full_name}</b> | Location Focus: Bengaluru, Hyderabad, India</p>
      </div>

      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; background: #ffffff;">
        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
          <div style="padding: 10px 15px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
            <span style="font-size: 12px; color: #64748b; display: block;">Total Processed</span>
            <b style="font-size: 18px; color: #0f172a;">${results.length}</b>
          </div>
          <div style="padding: 10px 15px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
            <span style="font-size: 12px; color: #166534; display: block;">Successful / Dry-run</span>
            <b style="font-size: 18px; color: #15803d;">${results.filter(r => r.status === 'APPLIED' || r.status === 'DRY_RUN_COMPLETED').length}</b>
          </div>
          <div style="padding: 10px 15px; background: #fffbeb; border-radius: 6px; border: 1px solid #fde68a;">
            <span style="font-size: 12px; color: #92400e; display: block;">Manual Action / CAPTCHA</span>
            <b style="font-size: 18px; color: #b45309;">${results.filter(r => r.status === 'MANUAL_ACTION_REQUIRED').length}</b>
          </div>
        </div>

        <table style="border-collapse: collapse; width: 100%; font-size: 13px; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9; color: #334155;">
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Company</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Role</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Location</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Status</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Notes</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="padding: 15px; text-align: center; color: #6b7280;">No new matching jobs were processed in this run.</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          Generated by GitLab CI/CD AI Job Applier Agent • Powered by Playwright & Gemini AI
        </div>
      </div>
    </div>
  `;

  if (!smtpUser || !smtpPass) {
    console.log('[Email Reporter] SMTP credentials not set (SMTP_USER / SMTP_PASS).');
    console.log('[Email Reporter] Outputting report summary preview below:');
    console.table(
      results.map(r => ({
        Company: r.company,
        Title: r.title,
        Location: r.location,
        Status: r.status,
        ATS: r.ats
      }))
    );
    console.log('\nTo receive automatic email reports, add SMTP_USER and SMTP_PASS to your .env or GitLab CI/CD Variables.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const attachments: any[] = [];
  if (fs.existsSync(csvReportPath)) {
    attachments.push({
      filename: `applied_jobs_report_${new Date().toISOString().slice(0, 10)}.csv`,
      path: csvReportPath
    });
  }

  try {
    const info = await transporter.sendMail({
      from: `"SDET Auto-Apply Agent" <${smtpUser}>`,
      to: recipientEmail,
      subject: `[GitLab AI Agent] Daily Job Application Summary (${new Date().toLocaleDateString('en-IN')})`,
      html: htmlBody,
      attachments
    });
    console.log(`[Email Reporter] Consolidated email report successfully sent to ${recipientEmail} (ID: ${info.messageId})`);
  } catch (err: any) {
    console.error(`[Email Reporter] Failed to send email: ${err.message}`);
  }
}

if (require.main === module) {
  sendEmailReport().catch(console.error);
}
