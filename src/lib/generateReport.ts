// ============================================================
// TRACEPOINT — Client-side PDF Report Generator
// Generates investigation summary reports as downloadable text/HTML
// that can be printed to PDF from the browser.
// ============================================================

import type { Investigation, AIAssessment } from '@/lib/types';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

function scoreColor(score: number): string {
  if (score >= 80) return '#2d7a3a';
  if (score >= 50) return '#8a6b2a';
  return '#8a3a3a';
}

function verificationColor(status: string): string {
  switch (status) {
    case 'verified': return '#2d7a3a';
    case 'strongly_corroborated': return '#2d7a3a';
    case 'possible': return '#8a6b2a';
    case 'conflicting': return '#8a3a3a';
    default: return '#666';
  }
}

export function generateInvestigationReport(inv: Investigation, ai: AIAssessment | null): string {
  const now = new Date().toISOString();
  const primaryCandidate = inv.candidates[0];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Tracepoint Investigation Report — ${inv.inputPhone || inv.inputEmail || inv.id.slice(0, 8)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; background: #fff; font-size: 12px; line-height: 1.6; }
  .page { max-width: 800px; margin: 0 auto; padding: 48px 40px; }
  .header { border-bottom: 3px solid #c8a24e; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 20px; color: #0c0e0d; margin-bottom: 4px; }
  .header .meta { color: #666; font-size: 11px; }
  .header .badge { display: inline-block; background: #f5f0e0; color: #8a6b2a; font-size: 9px; font-weight: 600; padding: 2px 8px; border-radius: 3px; letter-spacing: 0.05em; text-transform: uppercase; margin-left: 8px; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 13px; color: #0c0e0d; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e0e0e0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .stat { background: #f8f8f6; border: 1px solid #e4e4e0; border-radius: 6px; padding: 12px; text-align: center; }
  .stat .value { font-size: 22px; font-weight: 700; color: #0c0e0d; }
  .stat .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px; }
  .confidence-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin: 8px 0; }
  .confidence-fill { height: 100%; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; padding: 8px 10px; background: #f5f5f3; border-bottom: 1px solid #ddd; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  .candidate-card { border: 1px solid #e4e4e0; border-radius: 6px; padding: 16px; margin-bottom: 12px; background: #fafaf8; }
  .candidate-card .name { font-size: 14px; font-weight: 600; color: #0c0e0d; }
  .ai-box { background: #f8f8f6; border: 1px solid #e4e4e0; border-left: 3px solid #c8a24e; border-radius: 0 6px 6px 0; padding: 16px; }
  .ai-box .conclusion { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  .ai-box .summary { color: #444; margin-bottom: 12px; }
  .recommendation { padding: 4px 0; color: #444; }
  .recommendation::before { content: '→ '; color: #c8a24e; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0e0e0; color: #999; font-size: 9px; display: flex; justify-content: space-between; }
  .demo-watermark { color: #c8a24e; font-weight: 600; font-size: 10px; background: #fef9e7; padding: 2px 8px; border-radius: 3px; }
  .score-bar { display: inline-block; width: 60px; height: 6px; background: #e0e0e0; border-radius: 3px; vertical-align: middle; margin-right: 6px; }
  .score-bar-fill { height: 100%; border-radius: 3px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { padding: 24px; } }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <h1>
      Investigation Report
      ${inv.isDemoData ? '<span class="demo-watermark">DEMO DATA — NOT REAL</span>' : ''}
    </h1>
    <div class="meta">
      Target: <strong>${inv.inputName || inv.inputPhone || inv.inputEmail || 'Unknown'}</strong>
      &nbsp;·&nbsp; ${formatDate(inv.completedAt)}
      &nbsp;·&nbsp; Report generated ${formatDate(now)}
    </div>
    <div class="meta" style="margin-top:4px">
      ${inv.inputPhone ? `Phone: ${inv.inputPhoneNormalized || inv.inputPhone}` : ''}
      ${inv.inputEmail ? `${inv.inputPhone ? ' · ' : ''}Email: ${inv.inputEmail}` : ''}
      ${inv.inputCountry ? ` · Country: ${inv.inputCountry}` : ''}
    </div>
  </div>

  <!-- Stats Grid -->
  <div class="grid">
    <div class="stat">
      <div class="value">${inv.identityCount}</div>
      <div class="label">Identities</div>
    </div>
    <div class="stat">
      <div class="value">${inv.evidenceCount}</div>
      <div class="label">Evidence</div>
    </div>
    <div class="stat">
      <div class="value">${inv.sourceCount}</div>
      <div class="label">Sources</div>
    </div>
    <div class="stat">
      <div class="value" style="color:${scoreColor(inv.confidence || 0)}">${inv.confidence || 0}%</div>
      <div class="label">Confidence</div>
    </div>
  </div>

  <!-- Overall Confidence -->
  <div class="section">
    <h2>Overall Confidence</h2>
    <div class="confidence-bar">
      <div class="confidence-fill" style="width:${inv.confidence || 0}%; background:${scoreColor(inv.confidence || 0)}"></div>
    </div>
    <p style="color:#666; font-size:11px">${inv.summary || 'No summary available.'}</p>
  </div>

  <!-- Identity Candidates -->
  ${inv.candidates.length > 0 ? `
  <div class="section">
    <h2>Identity Candidates</h2>
    ${inv.candidates.map(c => `
      <div class="candidate-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
          <div>
            <div class="name">${c.name || 'Unknown'}</div>
            <div style="color:#666; font-size:11px">
              ${c.phone || ''}${c.phone && c.email ? ' · ' : ''}${c.email || ''}
              ${c.location ? ` · ${c.location}` : ''}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px; font-weight:700; color:${scoreColor(c.confidence)}">${Math.round(c.confidence)}%</div>
            <div style="font-size:9px; color:${verificationColor(c.verifiedStatus)}; text-transform:uppercase; font-weight:600">${c.verifiedStatus.replace('_', ' ')}</div>
          </div>
        </div>
        ${c.business ? `<div style="color:#666; font-size:11px; margin-bottom:4px">Business: ${c.business}${c.website ? ` (${c.website})` : ''}</div>` : ''}
        ${c.matchFields.length > 0 ? `<div style="margin-top:6px">${c.matchFields.map(f => `<span style="display:inline-block; background:#f0ece0; color:#8a6b2a; font-size:9px; padding:1px 6px; border-radius:3px; margin-right:4px; text-transform:uppercase">${f}</span>`).join('')}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- Evidence Table -->
  ${inv.evidence.length > 0 ? `
  <div class="section">
    <h2>Evidence (${inv.evidence.length} items)</h2>
    <table>
      <thead>
        <tr>
          <th>Source</th>
          <th>Claim / Finding</th>
          <th>Reliability</th>
          <th>Relevance</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${inv.evidence.map(e => `
          <tr>
            <td><strong>${e.sourceName}</strong>${e.sourceUrl ? `<br><a href="${e.sourceUrl}" style="color:#c8a24e; font-size:10px; text-decoration:none">${e.sourceUrl.substring(0, 50)}...</a>` : ''}</td>
            <td>${e.claim || e.excerpt || '—'}</td>
            <td>
              <span class="score-bar"><span class="score-bar-fill" style="width:${e.reliabilityScore}%; background:${scoreColor(e.reliabilityScore)}"></span></span>
              ${Math.round(e.reliabilityScore)}
            </td>
            <td>
              <span class="score-bar"><span class="score-bar-fill" style="width:${e.relevanceScore}%; background:${scoreColor(e.relevanceScore)}"></span></span>
              ${Math.round(e.relevanceScore)}
            </td>
            <td style="color:${verificationColor(e.verificationStatus)}; font-weight:600; font-size:10px; text-transform:uppercase">${e.verificationStatus.replace('_', ' ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- AI Assessment -->
  ${ai ? `
  <div class="section">
    <h2>AI Assessment</h2>
    <div class="ai-box">
      <div class="conclusion" style="color:${scoreColor(ai.confidence.score)}">${ai.conclusion}</div>
      <div class="summary">${ai.summary}</div>
      <div style="margin-bottom:8px">
        <div style="font-size:10px; color:#666; text-transform:uppercase; margin-bottom:4px">Confidence Explanation</div>
        <div style="font-size:11px; color:#444">${ai.confidence.explanation}</div>
      </div>
      ${ai.recommendations.length > 0 ? `
        <div style="margin-top:12px">
          <div style="font-size:10px; color:#666; text-transform:uppercase; margin-bottom:4px">Recommendations</div>
          ${ai.recommendations.map(r => `<div class="recommendation">${r}</div>`).join('')}
        </div>
      ` : ''}
      ${ai.missingEvidence.length > 0 ? `
        <div style="margin-top:8px">
          <div style="font-size:10px; color:#666; text-transform:uppercase; margin-bottom:4px">Missing Evidence</div>
          ${ai.missingEvidence.map(m => `<div class="recommendation" style="color:#999">${m}</div>`).join('')}
        </div>
      ` : ''}
    </div>
  </div>
  ` : ''}

  <!-- Timeline -->
  ${inv.timeline.length > 0 ? `
  <div class="section">
    <h2>Investigation Timeline</h2>
    <table>
      <thead>
        <tr><th>Time</th><th>Event</th></tr>
      </thead>
      <tbody>
        ${inv.timeline.map(t => `
          <tr>
            <td style="white-space:nowrap; color:#666">${formatDate(t.timestamp)}</td>
            <td>${t.description}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <span>Tracepoint Intelligence Platform — Investigation Report</span>
    <span>Confidential — For authorized use only</span>
  </div>
</div>
</body>
</html>`;
}

export function downloadReport(inv: Investigation, ai: AIAssessment | null) {
  const html = generateInvestigationReport(inv, ai);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    // Trigger print dialog after content loads
    win.onload = () => {
      win.print();
    };
  }
  URL.revokeObjectURL(url);
}
