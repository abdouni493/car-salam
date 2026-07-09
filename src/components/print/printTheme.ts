import { Language } from '../../types';

/**
 * Design system d'impression, extrait de `ReportPrintTemplate.ts` (fichier de
 * référence). Tous les documents imprimés — contrat, conditions, rapports —
 * partagent ce CSS et ces helpers, pour une identité visuelle unique.
 */

/** Raccourci de traduction : `T('Départ', 'المغادرة', lang)`. */
export const T = (fr: string, ar: string, lang: Language) => (lang === 'fr' ? fr : ar);

/**
 * Force une valeur latine (téléphone, immatriculation, VIN, montant) à
 * s'afficher strictement de gauche à droite, même dans un document arabe.
 * Sans cela, une plaque « 01234-116-16 » s'imprime inversée en RTL.
 */
export const ltr = (value: unknown): string =>
  `<span dir="ltr" style="unicode-bidi:bidi-override;direction:ltr;display:inline-block">${value ?? ''}</span>`;

/** Échappe le HTML d'une valeur saisie par l'utilisateur. */
export const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const fmtAmount = (n: unknown) => Math.round(Number(n) || 0).toLocaleString('fr-DZ');

export const fmtDate = (d: unknown, lang: Language) => {
  if (!d) return '';
  const date = new Date(String(d));
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ');
};

/**
 * CSS de base des documents A4. `dir` pilote l'alignement des blocs latéraux.
 * Le contenu latin reste en LTR grâce à {@link ltr}.
 */
export const PRINT_BASE_CSS = (lang: Language): string => {
  const textDir = lang === 'fr' ? 'ltr' : 'rtl';
  const sideAlign = textDir === 'ltr' ? 'right' : 'left';
  const startAlign = textDir === 'ltr' ? 'left' : 'right';

  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, sans-serif;
      line-height: 1.4;
      color: #333;
      background: white;
      direction: ${textDir};
      font-size: 11px;
      padding: 15px;
    }
    .page {
      width: 210mm;
      margin: 0 auto;
      padding: 12px;
      background: white;
      display: flex;
      flex-direction: column;
      min-height: 297mm;
    }

    /* Header */
    .header-section {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background: linear-gradient(135deg, #003399 0%, #0047b2 100%);
      color: white;
      border-radius: 6px;
      margin-bottom: 12px;
      border: 2px solid #003399;
      page-break-inside: avoid;
    }
    .agency-logo {
      width: 50px; height: 50px;
      border-radius: 6px;
      background: white;
      display: flex; align-items: center; justify-content: center;
      padding: 2px;
      flex-shrink: 0;
    }
    .agency-logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 4px; }
    .agency-info { flex: 1; }
    .agency-info h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .agency-info p { font-size: 10px; line-height: 1.4; opacity: 0.95; margin: 2px 0; }
    .report-date {
      text-align: ${sideAlign};
      font-size: 10px;
      font-weight: bold;
      white-space: nowrap;
    }
    .report-date .doc-title { font-size: 12px; letter-spacing: 0.4px; }

    /* Car Info Card */
    .car-info-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      background: #f8f9fa;
      border: 2px solid #667eea;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .car-image {
      width: 70px; height: 52px;
      border-radius: 4px;
      overflow: hidden;
      background: white;
      border: 1px solid #ddd;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .car-image img { width: 100%; height: 100%; object-fit: cover; }
    .car-details { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .car-detail-item { display: flex; flex-direction: column; }
    .car-detail-label {
      font-size: 8px; font-weight: bold; color: #667eea;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .car-detail-value { font-size: 10px; font-weight: 600; color: #333; margin-top: 1px; }

    /* Section Titles */
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: white;
      background: #667eea;
      padding: 6px 10px;
      border-radius: 4px;
      margin: 10px 0 6px 0;
      page-break-after: avoid;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 9px;
      page-break-inside: avoid;
    }
    table th {
      background: #667eea;
      color: white;
      padding: 5px 4px;
      text-align: ${startAlign};
      font-weight: 600;
      border: 1px solid #667eea;
    }
    table td { padding: 4px; border-bottom: 1px solid #e0e0e0; }
    table tbody tr:nth-child(even) { background: #f8f9fa; }
    table tfoot tr { background: #e8eaf6; font-weight: bold; border-top: 2px solid #667eea; }
    .amount-cell { text-align: ${sideAlign}; white-space: nowrap; }
    .muted-row td { color: #6b7280; font-style: italic; }

    /* Summary Grid */
    .summary-section {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 6px;
      margin: 10px 0;
      page-break-inside: avoid;
    }
    .summary-item {
      background: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 6px;
      text-align: center;
    }
    .summary-label {
      font-size: 8px; font-weight: bold; color: #667eea;
      text-transform: uppercase; margin-bottom: 3px;
    }
    .summary-value { font-size: 11px; font-weight: 700; color: #333; }
    .benefit-item {
      grid-column: 1 / -1;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 10px;
      border-radius: 4px;
    }
    .benefit-item .summary-label { color: rgba(255,255,255,0.9); }
    .benefit-item .summary-value { color: white; font-size: 13px; }

    /* Content Area */
    .content { flex: 1; }

    /* Conditions */
    .conditions-list { font-size: 9.5px; line-height: 1.6; padding-inline-start: 18px; }
    .conditions-list li { margin-bottom: 3px; }
    .conditions-text { font-size: 9.5px; line-height: 1.6; white-space: pre-line; }

    /* Signature Section */
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-top: 15px;
      padding-top: 12px;
      border-top: 2px solid #ddd;
      page-break-inside: avoid;
    }
    .signature-block { text-align: center; }
    .signature-label {
      font-size: 9px; font-weight: bold; color: #667eea;
      margin-bottom: 15px; text-transform: uppercase;
    }
    .signature-line { border-top: 2px solid #333; height: 35px; margin-bottom: 6px; }
    .signature-date { font-size: 8px; color: #666; margin-top: 6px; }
    .signature-note { font-size: 8px; color: #666; margin-bottom: 6px; }

    @media print {
      body { padding: 0; }
      .page { margin: 0; box-shadow: none; }
    }
  `;
};

export interface PrintAgencySettings {
  name?: string;
  agencyName?: string;
  logo?: string;
  address?: string;
  phone?: string;
  phone_number_2?: string;
  email?: string;
  bank_number?: string;
}

/**
 * Bandeau d'en-tête : logo + coordonnées de l'agence à gauche,
 * titre du document + numéro + date à droite.
 */
export const renderPrintHeader = (
  agencySettings: PrintAgencySettings | null | undefined,
  title: { fr: string; ar: string },
  lang: Language,
  reference?: string
): string => {
  const a = agencySettings || {};
  const name = a.name || a.agencyName || 'AUTO LOCATION';

  return `
    <div class="header-section">
      <div class="agency-logo">
        ${a.logo
          ? `<img src="${esc(a.logo)}" alt="Logo" />`
          : '<span style="font-size: 28px; font-weight: bold; color: #003399;">🚗</span>'}
      </div>
      <div class="agency-info">
        <h1>${esc(name)}</h1>
        ${a.address ? `<p><strong>${T('Adresse', 'العنوان', lang)}</strong>: ${esc(a.address)}</p>` : ''}
        ${a.phone ? `<p>📞 ${T('Téléphone', 'الهاتف', lang)}: ${ltr(esc(a.phone))}</p>` : ''}
        ${a.phone_number_2 ? `<p>📱 ${T('Deuxième téléphone', 'الهاتف الثاني', lang)}: ${ltr(esc(a.phone_number_2))}</p>` : ''}
        ${a.email ? `<p>✉️ ${T('Email', 'البريد الإلكتروني', lang)}: ${ltr(esc(a.email))}</p>` : ''}
        ${a.bank_number ? `<p>🏦 ${T('N° Bancaire', 'الرقم البنكي', lang)}: ${ltr(esc(a.bank_number))}</p>` : ''}
      </div>
      <div class="report-date">
        <div class="doc-title"><strong>${T(title.fr, title.ar, lang)}</strong></div>
        ${reference ? `<div>N° ${ltr(esc(reference))}</div>` : ''}
        <div>${T('Date:', 'التاريخ:', lang)} ${ltr(fmtDate(new Date().toISOString(), lang))}</div>
      </div>
    </div>
  `;
};

/** Deux blocs de signature (client / agence) séparés par une ligne. */
export const renderSignatures = (
  lang: Language,
  labels?: { left?: { fr: string; ar: string }; right?: { fr: string; ar: string }; note?: { fr: string; ar: string } }
): string => {
  const left = labels?.left || { fr: 'Signature du Client', ar: 'توقيع العميل' };
  const right = labels?.right || { fr: "Signature de l'Agence", ar: 'توقيع الوكالة' };

  return `
    <div class="signature-section">
      <div class="signature-block">
        <div class="signature-label">${T(left.fr, left.ar, lang)}</div>
        ${labels?.note ? `<div class="signature-note">${T(labels.note.fr, labels.note.ar, lang)}</div>` : ''}
        <div class="signature-line"></div>
        <div class="signature-date">${T('Date:', 'التاريخ:', lang)} _________________</div>
      </div>
      <div class="signature-block">
        <div class="signature-label">${T(right.fr, right.ar, lang)}</div>
        ${labels?.note ? `<div class="signature-note">&nbsp;</div>` : ''}
        <div class="signature-line"></div>
        <div class="signature-date">${T('Cachet de l’agence', 'ختم الوكالة', lang)}</div>
      </div>
    </div>
  `;
};

/** Squelette complet d'un document A4 prêt à imprimer. */
export const renderPrintDocument = (
  lang: Language,
  title: string,
  bodyHtml: string
): string => `<!DOCTYPE html>
<html dir="${lang === 'fr' ? 'ltr' : 'rtl'}" lang="${lang === 'fr' ? 'fr' : 'ar'}">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <style>${PRINT_BASE_CSS(lang)}</style>
</head>
<body>
  <div class="page">
${bodyHtml}
  </div>
</body>
</html>`;
