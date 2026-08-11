// ============================================================
// TRACEPOINT — Real PDF Report Generator (jsPDF)
// Generates professional investigation reports as actual PDF files.
// Client-side — no server needed.
// ============================================================

import { jsPDF } from 'jspdf';
import type { Investigation, AIAssessment, EvidenceItem, IdentityCandidate } from '@/lib/types';

// Colors
const GOLD = [200, 162, 78] as const;
const DARK = [12, 14, 13] as const;
const GRAY = [102, 102, 102] as const;
const LIGHT_BG = [248, 248, 246] as const;
const GREEN = [45, 122, 58] as const;
const AMBER = [138, 107, 42] as const;
const RED = [138, 58, 58] as const;
const BORDER = [228, 228, 224] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

function scoreColor(score: number): readonly number[] {
  if (score >= 80) return GREEN;
  if (score >= 50) return AMBER;
  return RED;
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  const lines = doc.splitTextToSize(text, maxWidth);
  return lines[0] || '';
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 4.5): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  let curY = y;
  for (const line of lines) {
    if (curY > 275) {
      doc.addPage();
      curY = 20;
    }
    doc.text(line, x, curY);
    curY += lineHeight;
  }
  return curY;
}

export function generatePdfReport(inv: Investigation, ai: AIAssessment | null): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 20;

  // ---- HEADER ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  doc.text('Investigation Report', marginL, y);

  if (inv.isDemoData) {
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text('DEMO DATA - NOT REAL', marginL + 85, y);
  }

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(
    `Target: ${inv.inputName || inv.inputPhone || inv.inputEmail || 'Unknown'}`,
    marginL, y
  );
  y += 5;
  doc.text(
    `${formatDate(inv.completedAt)}  |  Report generated ${formatDate(new Date().toISOString())}`,
    marginL, y
  );

  if (inv.inputPhone || inv.inputEmail || inv.inputCountry) {
    y += 5;
    const parts: string[] = [];
    if (inv.inputPhone) parts.push(`Phone: ${inv.inputPhoneNormalized || inv.inputPhone}`);
    if (inv.inputEmail) parts.push(`Email: ${inv.inputEmail}`);
    if (inv.inputCountry) parts.push(`Country: ${inv.inputCountry}`);
    doc.text(parts.join('  |  '), marginL, y);
  }

  y += 4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(marginL, y, pageW - marginR, y);
  y += 10;

  // ---- STATS GRID ----
  const stats = [
    { label: 'Identities', value: String(inv.identityCount) },
    { label: 'Evidence', value: String(inv.evidenceCount) },
    { label: 'Sources', value: String(inv.sourceCount) },
    { label: 'Confidence', value: `${inv.confidence || 0}%` },
  ];

  const statW = contentW / 4 - 3;
  const statX0 = marginL;
  for (let i = 0; i < stats.length; i++) {
    const sx = statX0 + i * (statW + 4);
    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(sx, y, statW, 18, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...(i === 3 ? scoreColor(inv.confidence || 0) : DARK));
    doc.text(stats[i].value, sx + statW / 2, y + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(stats[i].label.toUpperCase(), sx + statW / 2, y + 15, { align: 'center' });
  }
  y += 26;

  // ---- CONFIDENCE BAR ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text('Overall Confidence', marginL, y);
  y += 5;

  const barW = contentW;
  const barH = 4;
  doc.setFillColor(224, 224, 224);
  doc.roundedRect(marginL, y, barW, barH, 2, 2, 'F');
  const fillW = Math.max(2, (barW * (inv.confidence || 0)) / 100);
  doc.setFillColor(...scoreColor(inv.confidence || 0));
  doc.roundedRect(marginL, y, fillW, barH, 2, 2, 'F');
  y += 7;

  if (inv.summary) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    y = addWrappedText(doc, inv.summary, marginL, y, contentW, 4.5);
  }
  y += 6;

  // ---- IDENTITY CANDIDATES ----
  if (inv.candidates.length > 0) {
    if (y > 245) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text('IDENTITY CANDIDATES', marginL, y);
    y += 2;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(marginL, y, pageW - marginR, y);
    y += 6;

    for (const c of inv.candidates) {
      if (y > 250) { doc.addPage(); y = 20; }

      // Candidate card background
      doc.setFillColor(250, 250, 248);
      doc.setDrawColor(...BORDER);
      const cardH = 28;
      doc.roundedRect(marginL, y, contentW, cardH, 2, 2, 'FD');

      // Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...DARK);
      doc.text(c.name || 'Unknown', marginL + 6, y + 8);

      // Contact info
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      const contactParts: string[] = [];
      if (c.phone) contactParts.push(c.phone);
      if (c.email) contactParts.push(c.email);
      if (c.location) contactParts.push(c.location);
      if (contactParts.length > 0) {
        doc.text(contactParts.join('  |  '), marginL + 6, y + 13);
      }

      // Match fields
      if (c.matchFields.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(...AMBER);
        doc.text(c.matchFields.map(f => f.toUpperCase()).join('  '), marginL + 6, y + 17);
      }

      // Confidence score (right side)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...scoreColor(c.confidence));
      doc.text(`${Math.round(c.confidence)}%`, pageW - marginR - 6, y + 10, { align: 'right' });

      // Verification status
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      const statusColor = c.verifiedStatus === 'verified' || c.verifiedStatus === 'strongly_corroborated' ? GREEN : c.verifiedStatus === 'possible' ? AMBER : GRAY;
      doc.setTextColor(...statusColor);
      doc.text(c.verifiedStatus.replace(/_/g, ' ').toUpperCase(), pageW - marginR - 6, y + 16, { align: 'right' });

      y += cardH + 4;
    }
  }

  // ---- EVIDENCE TABLE ----
  if (inv.evidence.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(`EVIDENCE (${inv.evidence.length} items)`, marginL, y);
    y += 2;
    doc.setDrawColor(...BORDER);
    doc.line(marginL, y, pageW - marginR, y);
    y += 5;

    // Table header
    const colWidths = [35, 70, 25, 25, 25];
    const headers = ['Source', 'Finding', 'Reliab.', 'Relev.', 'Status'];
    doc.setFillColor(245, 245, 243);
    doc.rect(marginL, y, contentW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    let cx = marginL + 3;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i].toUpperCase(), cx, y + 4.2);
      cx += colWidths[i];
    }
    y += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    for (const e of inv.evidence.slice(0, 50)) { // Cap at 50 for PDF
      if (y > 270) { doc.addPage(); y = 20; }

      const rowH = 10;
      doc.setDrawColor(238, 238, 238);
      doc.setLineWidth(0.15);
      doc.line(marginL, y + rowH, pageW - marginR, y + rowH);

      cx = marginL + 3;
      doc.setFontSize(7);
      doc.setTextColor(...DARK);
      doc.text(truncateText(doc, e.sourceName, colWidths[0] - 4), cx, y + 4);
      cx += colWidths[0];

      doc.setTextColor(80, 80, 80);
      doc.text(truncateText(doc, e.claim || e.excerpt || '-', colWidths[1] - 4), cx, y + 4);
      cx += colWidths[1];

      doc.text(`${Math.round(e.reliabilityScore)}`, cx + 8, y + 4);
      cx += colWidths[2];

      doc.text(`${Math.round(e.relevanceScore)}`, cx + 8, y + 4);
      cx += colWidths[3];

      // Status with color
      const stColor = e.verificationStatus === 'verified' || e.verificationStatus === 'strongly_corroborated' ? GREEN : e.verificationStatus === 'possible' ? AMBER : e.verificationStatus === 'conflicting' ? RED : GRAY;
      doc.setTextColor(...stColor);
      doc.setFont('helvetica', 'bold');
      doc.text(e.verificationStatus.replace(/_/g, ' ').toUpperCase(), cx + 4, y + 4);

      y += rowH;
    }
    if (inv.evidence.length > 50) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(`... and ${inv.evidence.length - 50} more evidence items (see full report online)`, marginL, y + 4);
      y += 8;
    }
    y += 4;
  }

  // ---- AI ASSESSMENT ----
  if (ai) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text('AI ASSESSMENT', marginL, y);
    y += 2;
    doc.setDrawColor(...BORDER);
    doc.line(marginL, y, pageW - marginR, y);
    y += 6;

    // AI box background
    const aiBoxH = 50;
    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(...BORDER);
    doc.rect(marginL, y, contentW, aiBoxH, 'FD');
    // Gold left border
    doc.setFillColor(...GOLD);
    doc.rect(marginL, y, 1.5, aiBoxH, 'F');

    // Conclusion
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...scoreColor(ai.confidence.score));
    y = addWrappedText(doc, ai.conclusion, marginL + 6, y + 6, contentW - 12, 4.5);
    y += 2;

    // Summary
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(68, 68, 68);
    y = addWrappedText(doc, ai.summary, marginL + 6, y, contentW - 12, 4.2);

    // Explanation
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('CONFIDENCE EXPLANATION', marginL + 6, y + 2);
    y += 4;
    y = addWrappedText(doc, ai.confidence.explanation, marginL + 6, y, contentW - 12, 4);

    y += 4;

    // Recommendations
    if (ai.recommendations.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text('RECOMMENDATIONS', marginL + 6, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(68, 68, 68);
      for (const r of ai.recommendations.slice(0, 8)) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`  > ${r}`, marginL + 6, y);
        y += 4;
      }
      y += 2;
    }

    // Missing evidence
    if (ai.missingEvidence.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text('MISSING EVIDENCE', marginL + 6, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      for (const m of ai.missingEvidence.slice(0, 5)) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`  - ${m}`, marginL + 6, y);
        y += 4;
      }
    }
    y += 8;
  }

  // ---- TIMELINE ----
  if (inv.timeline.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text('INVESTIGATION TIMELINE', marginL, y);
    y += 2;
    doc.setDrawColor(...BORDER);
    doc.line(marginL, y, pageW - marginR, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const t of inv.timeline) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GRAY);
      doc.text(formatDate(t.timestamp), marginL, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DARK);
      y = addWrappedText(doc, t.description, marginL + 42, y, contentW - 42, 4);
      y += 2;
    }
  }

  // ---- FOOTER ----
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('Tracepoint Intelligence Platform - Investigation Report', marginL, 290);
    doc.text('Confidential - For authorized use only', pageW - marginR, 290, { align: 'right' });
    doc.text(`Page ${p} of ${totalPages}`, pageW / 2, 290, { align: 'center' });
  }

  return doc;
}

/**
 * Generate PDF and trigger browser download.
 */
export function downloadPdfReport(inv: Investigation, ai: AIAssessment | null): void {
  const doc = generatePdfReport(inv, ai);
  const targetName = inv.inputName || inv.inputPhone || inv.inputEmail || inv.id.slice(0, 8);
  const safeName = targetName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  doc.save(`Tracepoint_Report_${safeName}.pdf`);
}
