// ============================================================
// TRACEPOINT — PDF Report Generator
// Opens a new window with a styled, print-ready HTML investigation
// report that can be saved as PDF via the browser's print dialog.
// ============================================================

import type { Investigation, AIAssessment } from '@/lib/types';

// --- Helpers ---

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function confidenceColor(score: number): string {
  if (score >= 80) return '#2d7a3a';
  if (score >= 60) return '#5a8a2a';
  if (score >= 40) return '#8a6b2a';
  return '#8a3a3a';
}

function confidenceLabel(score: number): string {
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MODERATE';
  if (score >= 40) return 'LOW';
  return 'INSUFFICIENT';
}

function verificationColor(status: string): string {
  switch (status) {
    case 'verified':
    case 'strongly_corroborated':
      return '#2d7a3a';
    case 'possible':
      return '#8a6b2a';
    case 'conflicting':
      return '#8a3a3a';
    default:
      return '#666666';
  }
}

function scoreBarHtml(score: number, width: number = 60): string {
  const color = confidenceColor(score);
  return `<span style="display:inline-block;width:${width}px;height:6px;background:#e0e0e0;border-radius:3px;vertical-align:middle;margin-right:6px">
    <span style="display:block;height:100%;width:${score}%;background:${color};border-radius:3px"></span>
  </span>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Main Report Generator ---

export function generatePdfReport(
  investigation: Investigation,
  aiAssessment: AIAssessment | null
): void {
  const inv = investigation;
  const ai = aiAssessment;
  const now = new Date().toISOString();
  const primary = inv.candidates[0] || null;
  const confScore = inv.confidence || 0;

  const identifiers: string[] = [];
  if (inv.inputPhone) identifiers.push(`Phone: ${escapeHtml(inv.inputPhoneNormalized || inv.inputPhone)}`);
  if (inv.inputEmail) identifiers.push(`Email: ${escapeHtml(inv.inputEmail)}`);
  if (inv.inputCountry) identifiers.push(`Country: ${escapeHtml(inv.inputCountry)}`);
  if (inv.inputCity) identifiers.push(`City: ${escapeHtml(inv.inputCity)}`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tracepoint Report — ${escapeHtml(inv.inputPhone || inv.inputEmail || inv.id.slice(0, 8))}</title>
<style>
  /* ---------- Reset & Base ---------- */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #1a1a1a;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.6;
  }

  /* ---------- Page Layout ---------- */
  .page {
    max-width: 780px;
    margin: 0 auto;
    padding: 40px 48px;
  }

  /* ---------- Header ---------- */
  .report-header {
    border-bottom: 3px solid #c8a24e;
    padding-bottom: 20px;
    margin-bottom: 28px;
  }
  .brand {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #c8a24e;
    margin-bottom: 6px;
  }
  .report-title {
    font-size: 22px;
    font-weight: 700;
    color: #0c0e0d;
    margin-bottom: 4px;
  }
  .report-meta {
    color: #666666;
    font-size: 10px;
  }
  .report-meta strong { color: #333; }
  .identifiers {
    margin-top: 6px;
    color: #666;
    font-size: 10px;
  }

  /* ---------- No-Print Controls ---------- */
  .no-print {
    margin-bottom: 20px;
    padding: 12px 16px;
    background: #f8f7f3;
    border: 1px solid #e4e4e0;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .no-print p {
    flex: 1;
    font-size: 11px;
    color: #555;
    margin: 0;
  }
  .btn-download {
    display: inline-block;
    padding: 8px 20px;
    background: #0c0e0d;
    color: #ffffff;
    font-size: 11px;
    font-weight: 600;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
  }
  .btn-download:hover { background: #2a2d2c; }

  /* ---------- Stats Grid ---------- */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
    margin-bottom: 24px;
  }
  .stat-box {
    background: #f8f8f6;
    border: 1px solid #e8e8e4;
    border-radius: 6px;
    padding: 14px 10px;
    text-align: center;
  }
  .stat-value {
    font-size: 22px;
    font-weight: 700;
    color: #0c0e0d;
    line-height: 1.2;
  }
  .stat-label {
    font-size: 8px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 2px;
  }

  /* ---------- Sections ---------- */
  .section {
    margin-bottom: 24px;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: #0c0e0d;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e0e0e0;
  }

  /* ---------- Confidence ---------- */
  .confidence-bar {
    height: 10px;
    background: #e8e8e4;
    border-radius: 5px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .confidence-fill {
    height: 100%;
    border-radius: 5px;
    transition: width 0.3s;
  }
  .confidence-label {
    font-size: 10px;
    color: #666;
  }

  /* ---------- Candidate Cards ---------- */
  .candidate-card {
    border: 1px solid #e4e4e0;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 10px;
    background: #fafaf8;
  }
  .candidate-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .candidate-name {
    font-size: 14px;
    font-weight: 600;
    color: #0c0e0d;
  }
  .candidate-detail {
    color: #666;
    font-size: 10px;
  }
  .candidate-score {
    text-align: right;
  }
  .candidate-score-value {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.2;
  }
  .candidate-score-status {
    font-size: 9px;
    text-transform: uppercase;
    font-weight: 600;
  }
  .match-tag {
    display: inline-block;
    background: #f0ece0;
    color: #8a6b2a;
    font-size: 8px;
    padding: 2px 7px;
    border-radius: 3px;
    margin-right: 4px;
    margin-top: 6px;
    text-transform: uppercase;
    font-weight: 600;
  }

  /* ---------- Evidence Table ---------- */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  th {
    text-align: left;
    padding: 7px 8px;
    background: #f5f5f3;
    border-bottom: 1px solid #ddd;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #888;
    font-weight: 600;
  }
  td {
    padding: 7px 8px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
  }
  tr:last-child td { border-bottom: none; }

  /* ---------- AI Assessment Box ---------- */
  .ai-box {
    background: #f8f8f6;
    border: 1px solid #e4e4e0;
    border-left: 3px solid #c8a24e;
    border-radius: 0 6px 6px 0;
    padding: 16px;
  }
  .ai-conclusion {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .ai-summary {
    color: #444;
    margin-bottom: 12px;
    font-size: 11px;
  }
  .ai-subsection-title {
    font-size: 9px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
    font-weight: 600;
  }
  .ai-text { color: #444; font-size: 11px; }
  .ai-recommendation {
    padding: 3px 0;
    color: #444;
    font-size: 11px;
  }
  .ai-recommendation::before { content: '\u2192  '; color: #c8a24e; font-weight: 700; }
  .ai-missing {
    padding: 2px 0;
    color: #999;
    font-size: 11px;
  }
  .ai-missing::before { content: '\u25CB  '; color: #ccc; }

  /* ---------- Timeline ---------- */
  .timeline-table td:first-child {
    white-space: nowrap;
    color: #888;
    font-size: 9px;
    width: 160px;
  }

  /* ---------- Locations ---------- */
  .location-row {
    padding: 8px 0;
    border-bottom: 1px solid #f0f0ee;
  }
  .location-row:last-child { border-bottom: none; }
  .location-provider {
    font-size: 9px;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .location-address {
    font-size: 11px;
    color: #333;
  font-weight: 500;
  }
  .location-coords {
    font-size: 9px;
    color: #aaa;
    font-family: 'Courier New', monospace;
  }
  .location-status-badge {
    display: inline-block;
    font-size: 8px;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .status-live { background: #e6f4ea; color: #2d7a3a; }
  .status-last_known { background: #fef7e0; color: #8a6b2a; }
  .status-historical { background: #f0f0f0; color: #666; }

  /* ---------- Footer ---------- */
  .report-footer {
    margin-top: 40px;
    padding-top: 14px;
    border-top: 1px solid #e0e0e0;
    color: #999;
    font-size: 8px;
    display: flex;
    justify-content: space-between;
  }
  .demo-badge {
    display: inline-block;
    background: #fef9e7;
    color: #c8a24e;
    font-weight: 700;
    font-size: 9px;
    padding: 2px 10px;
    border-radius: 3px;
    border: 1px solid #f0e6c0;
    margin-left: 8px;
    vertical-align: middle;
  }

  /* ---------- Print Styles ---------- */
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-size: 10px; }
    .page { padding: 20px 30px; max-width: 100%; }
    .no-print { display: none !important; }
    .section { page-break-inside: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="report-header">
    <div class="brand">Tracepoint Intelligence Platform</div>
    <div class="report-title">
      Investigation Report
      ${inv.isDemoData ? '<span class="demo-badge">DEMO DATA — NOT REAL</span>' : ''}
    </div>
    <div class="report-meta">
      <strong>Case ID:</strong> ${escapeHtml(inv.id)} &nbsp;&middot;&nbsp;
      <strong>Depth:</strong> ${escapeHtml(inv.depth)} &nbsp;&middot;&nbsp;
      Completed: ${formatDate(inv.completedAt)}
    </div>
    <div class="identifiers">
      ${identifiers.map((i) => `<span>${i}</span>`).join(' &nbsp;&middot;&nbsp; ')}
    </div>
  </div>

  <!-- Download Button (hidden in print) -->
  <div class="no-print">
    <p>This report is ready for printing or saving as PDF. Click below or use Ctrl+P / Cmd+P.</p>
    <button class="btn-download" onclick="window.print()">⬇ Download PDF</button>
  </div>

  <!-- Stats Grid -->
  <div class="stats-grid">
    <div class="stat-box">
      <div class="stat-value">${inv.identityCount}</div>
      <div class="stat-label">Identities</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${inv.evidenceCount}</div>
      <div class="stat-label">Evidence</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${inv.sourceCount}</div>
      <div class="stat-label">Sources</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color:${confidenceColor(confScore)}">${confScore}%</div>
      <div class="stat-label">Confidence</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color:${confidenceColor(confScore)}; font-size:14px; font-weight:700; padding-top:4px;">${confidenceLabel(confScore)}</div>
      <div class="stat-label">Assessment</div>
    </div>
  </div>

  <!-- Confidence Section -->
  <div class="section">
    <div class="section-title">Overall Confidence</div>
    <div class="confidence-bar">
      <div class="confidence-fill" style="width:${confScore}%; background:${confidenceColor(confScore)}"></div>
    </div>
    <p class="confidence-label">${escapeHtml(inv.summary || 'No summary available.')}</p>
  </div>

  <!-- Identity Candidates -->
  ${inv.candidates.length > 0
    ? `<div class="section">
        <div class="section-title">Identity Candidates (${inv.candidates.length})</div>
        ${inv.candidates
          .map(
            (c) => `
          <div class="candidate-card">
            <div class="candidate-header">
              <div>
                <div class="candidate-name">${escapeHtml(c.name || 'Unknown')}</div>
                <div class="candidate-detail">
                  ${c.phone ? escapeHtml(c.phone) : ''}${c.phone && c.email ? ' &middot; ' : ''}${c.email ? escapeHtml(c.email) : ''}
                  ${c.location ? ' &middot; ' + escapeHtml(c.location) : ''}
                </div>
                ${c.business ? `<div class="candidate-detail">Business: ${escapeHtml(c.business)}${c.website ? ' (' + escapeHtml(c.website) + ')' : ''}</div>` : ''}
              </div>
              <div class="candidate-score">
                <div class="candidate-score-value" style="color:${confidenceColor(c.confidence)}">${Math.round(c.confidence)}%</div>
                <div class="candidate-score-status" style="color:${verificationColor(c.verifiedStatus)}">${c.verifiedStatus.replace(/_/g, ' ')}</div>
              </div>
            </div>
            ${c.matchFields.length > 0 ? `<div>${c.matchFields.map((f) => `<span class="match-tag">${escapeHtml(f)}</span>`).join('')}</div>` : ''}
          </div>`
          )
          .join('')}
      </div>`
    : ''}

  <!-- Evidence Table -->
  ${inv.evidence.length > 0
    ? `<div class="section">
        <div class="section-title">Evidence (${inv.evidence.length} items)</div>
        <table>
          <thead>
            <tr>
              <th style="width:120px">Source</th>
              <th>Claim / Finding</th>
              <th style="width:70px">Reliability</th>
              <th style="width:65px">Relevance</th>
              <th style="width:80px">Status</th>
            </tr>
          </thead>
          <tbody>
            ${inv.evidence
              .map(
                (e) => `
            <tr>
              <td><strong>${escapeHtml(e.sourceName)}</strong>${e.sourceUrl ? `<br><span style="color:#c8a24e; font-size:9px; word-break:break-all">${escapeHtml(e.sourceUrl.length > 60 ? e.sourceUrl.substring(0, 60) + '...' : e.sourceUrl)}</span>` : ''}</td>
              <td>${escapeHtml(e.claim || e.excerpt || '\u2014')}</td>
              <td>${scoreBarHtml(e.reliabilityScore)} ${Math.round(e.reliabilityScore)}</td>
              <td>${scoreBarHtml(e.relevanceScore)} ${Math.round(e.relevanceScore)}</td>
              <td style="color:${verificationColor(e.verificationStatus)}; font-weight:600; font-size:9px; text-transform:uppercase">${e.verificationStatus.replace(/_/g, ' ')}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    : ''}

  <!-- AI Assessment -->
  ${ai
    ? `<div class="section">
        <div class="section-title">AI Assessment</div>
        <div class="ai-box">
          <div class="ai-conclusion" style="color:${confidenceColor(ai.confidence.score)}">${escapeHtml(ai.conclusion)}</div>
          <div class="ai-summary">${escapeHtml(ai.summary)}</div>
          <div style="margin-bottom:10px">
            <div class="ai-subsection-title">Confidence Explanation</div>
            <div class="ai-text">${escapeHtml(ai.confidence.explanation)}</div>
          </div>
          ${ai.recommendations.length > 0
            ? `<div style="margin-top:12px">
                <div class="ai-subsection-title">Recommendations</div>
                ${ai.recommendations.map((r) => `<div class="ai-recommendation">${escapeHtml(r)}</div>`).join('')}
              </div>`
            : ''}
          ${ai.missingEvidence.length > 0
            ? `<div style="margin-top:8px">
                <div class="ai-subsection-title">Missing Evidence</div>
                ${ai.missingEvidence.map((m) => `<div class="ai-missing">${escapeHtml(m)}</div>`).join('')}
              </div>`
            : ''}
        </div>
      </div>`
    : ''}

  <!-- Location Data -->
  ${inv.locations.length > 0
    ? `<div class="section">
        <div class="section-title">Location Data (${inv.locations.length})</div>
        ${inv.locations
          .map(
            (loc) => `
          <div class="location-row">
            <div style="display:flex; justify-content:space-between; align-items:center">
              <div>
                <div class="location-address">${escapeHtml(loc.address || 'Unknown location')}</div>
                <div class="location-provider">${escapeHtml(loc.provider)}</div>
              </div>
              <div style="text-align:right">
                <span class="location-status-badge status-${loc.status}">${loc.status.replace(/_/g, ' ')}</span>
                <div class="location-coords">${loc.latitude != null && loc.longitude != null ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : 'N/A'}</div>
              </div>
            </div>
          </div>`
          )
          .join('')}
      </div>`
    : ''}

  <!-- Timeline -->
  ${inv.timeline.length > 0
    ? `<div class="section">
        <div class="section-title">Investigation Timeline (${inv.timeline.length} events)</div>
        <table class="timeline-table">
          <thead>
            <tr><th>Timestamp</th><th>Event</th></tr>
          </thead>
          <tbody>
            ${inv.timeline
              .map(
                (t) => `
            <tr>
              <td>${formatDate(t.timestamp)}</td>
              <td>${escapeHtml(t.description)}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    : ''}

  <!-- Footer -->
  <div class="report-footer">
    <span>Tracepoint Intelligence Platform &mdash; Investigation Report &mdash; ${formatDate(now)}</span>
    <span>Confidential &mdash; For authorized use only</span>
  </div>
</div>
</body>
</html>`;

  // Open in a new window
  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
