/**
 * Conditions Templates - Arabic and French
 * Used for printing rental conditions without database connection
 * Language: Both Arabic (RTL) and French (LTR)
 */

export interface ConditionItem {
  title: string;
  bullets: string[];
}

export interface ConditionsTemplate {
  language: 'ar' | 'fr';
  title: string;
  subtitle: string;
  conditions: ConditionItem[];
  /** Closing statement: taking the vehicle means accepting these conditions. */
  acceptance: string;
  thanks: string;
  clientSignatureLabel: string;
  agencySignatureLabel: string;
}

/**
 * ARABIC CONDITIONS TEMPLATE
 * Complete rental agreement conditions in Arabic
 */
export const ARABIC_CONDITIONS_TEMPLATE: ConditionsTemplate = {
  language: 'ar',
  title: 'الشروط العامة لإيجار المركبة',
  subtitle: 'يمكنكم قراءة شروط الإيجار، وهي تظهر في عقد الإيجار',
  conditions: [
    {
      title: 'وضع المركبة تحت التصرف',
      bullets: [
        'توضع المركبة تحت تصرفكم طيلة المدة المتفق عليها.',
        'يجب أن يكون المستأجر حاملاً لرخصة قيادة سارية المفعول.'
      ]
    },
    {
      title: 'حالة المركبة',
      bullets: [
        'تُسلَّم المركبة في حالة جيدة من حيث التشغيل والنظافة.',
        'يجب إرجاعها في نفس الحالة (باستثناء الاستعمال العادي).',
        'كل تلف أو ضياع أو ضرر يكون على عاتق المستأجر.',
        'يجب إرجاع المركبة نظيفة من الداخل ومن الخارج.'
      ]
    },
    {
      title: 'التسعيرة',
      bullets: [
        'يُتفق على السعر قبل بداية الإيجار.',
        'يشمل السعر 250 كلم في اليوم.',
        'كل كيلومتر إضافي يُفوتر بـ 40 دج/كلم.'
      ]
    },
    {
      title: 'الضمان (الكفالة)',
      bullets: [
        'يُشترط دفع ضمان قدره 200 أورو قبل تسليم المركبة.',
        'يُسترجع الضمان بعد فحص المركبة، شريطة عدم بقاء أي مبلغ مستحق.',
        'لا يشكّل الضمان حدًّا للمسؤولية. وإذا تجاوزت الأضرار قيمته، يبقى المستأجر ملزمًا بدفع الفارق.'
      ]
    },
    {
      title: 'الوثائق الإلزامية',
      bullets: [
        'تقديم رخصة قيادة سارية المفعول إلزامي.',
        'يمكن طلب نسخة من رخصة القيادة ومن وثيقة الهوية.'
      ]
    },
    {
      title: 'استعمال المركبة',
      bullets: [
        'لا يُسمح بقيادة المركبة إلا للسائق المذكور في العقد.',
        'يُمنع تأجير المركبة من الباطن.',
        'يُمنع التدخين داخل المركبة.',
        'يُمنع استعمال المركبة في أنشطة غير قانونية أو في السباقات أو في أي استعمال غير مرخَّص.',
        'يُمنع الخروج من التراب الجزائري دون إذن كتابي من CAR SALAM.',
        'احترام قانون المرور إلزامي.',
        'جميع الغرامات والمخالفات تبقى على عاتق المستأجر.'
      ]
    },
    {
      title: 'الوقود',
      bullets: [
        'يجب إرجاع المركبة بنفس مستوى الوقود الذي سُلِّمت به.'
      ]
    },
    {
      title: 'التأخر في الإرجاع',
      bullets: [
        'يجب الإبلاغ عن أي تأخر في أقرب وقت.',
        'قد يؤدي التأخر الكبير إلى فوترة يوم إيجار إضافي.'
      ]
    },
    {
      title: 'الحادث أو العطب أو السرقة',
      bullets: [
        'في حالة حادث أو عطب أو سرقة أو ضرر، يجب على المستأجر إعلام CAR SALAM فورًا.',
        'لا يجوز إجراء أي إصلاح دون موافقة مسبقة من المؤجِّر.'
      ]
    },
    {
      title: 'المفاتيح والملحقات',
      bullets: [
        'ضياع المفاتيح أو وثائق المركبة أو الملحقات يُفوتر على المستأجر.'
      ]
    },
    {
      title: 'المسؤولية',
      bullets: [
        'يتحمل المستأجر مسؤولية المركبة طيلة مدة الإيجار وإلى غاية إرجاعها.',
        'تكاليف الإصلاح أو إعادة المركبة إلى حالتها الأصلية على عاتق المستأجر، إلا إذا ثبتت قانونًا مسؤولية المؤجِّر أو الغير.'
      ]
    }
  ],
  acceptance: 'إن الحجز أو استلام المركبة يُعدّ قبولاً للشروط العامة للإيجار المذكورة أعلاه.',
  thanks: 'نشكركم على ثقتكم.',
  clientSignatureLabel: 'امضاء وبصمة الزبون',
  agencySignatureLabel: 'امضاء صاحب وكالة'
};

/**
 * FRENCH CONDITIONS TEMPLATE
 * Complete rental agreement conditions in French
 */
export const FRENCH_CONDITIONS_TEMPLATE: ConditionsTemplate = {
  language: 'fr',
  title: 'Les Conditions Générales de location véhicule',
  subtitle: 'Vous pouvez lire les conditions de location, elles apparaîtront sur le contrat de location',
  conditions: [
    {
      title: 'Mise à disposition du véhicule',
      bullets: [
        'Le véhicule est mis à votre disposition pour la durée convenue.',
        'Le locataire doit être titulaire d\'un permis de conduire valide.'
      ]
    },
    {
      title: 'État du véhicule',
      bullets: [
        'Le véhicule est remis en bon état de fonctionnement et de propreté.',
        'Il devra être restitué dans le même état (hors usure normale).',
        'Toute dégradation, perte ou dommage sera à la charge du locataire.',
        'Le véhicule doit être rendu propre, à l\'intérieur comme à l\'extérieur.'
      ]
    },
    {
      title: 'Tarification',
      bullets: [
        'Le tarif est convenu avant la location.',
        'Le forfait comprend 250 km par jour.',
        'Chaque kilomètre supplémentaire est facturé 40 DZD/km.'
      ]
    },
    {
      title: 'Caution',
      bullets: [
        'Une caution de 200 € est exigée avant la remise du véhicule.',
        'Elle est restituée après vérification du véhicule, sous réserve qu\'aucune somme ne reste due.',
        'La caution ne constitue pas une limite de responsabilité. Si les dommages dépassent son montant, le locataire reste redevable de la différence.'
      ]
    },
    {
      title: 'Documents obligatoires',
      bullets: [
        'Présentation obligatoire d\'un permis de conduire valide.',
        'Une copie du permis et d\'une pièce d\'identité pourra être demandée.'
      ]
    },
    {
      title: 'Utilisation du véhicule',
      bullets: [
        'Seul le conducteur inscrit sur le contrat est autorisé à conduire le véhicule.',
        'Il est interdit de sous-louer le véhicule.',
        'Il est interdit de fumer à l\'intérieur du véhicule.',
        'Il est interdit d\'utiliser le véhicule pour des activités illégales, des compétitions ou tout usage non autorisé.',
        'Toute sortie du territoire algérien est interdite sans autorisation écrite de CAR SALAM.',
        'Le respect du Code de la route est obligatoire.',
        'Toutes les amendes, contraventions et infractions restent à la charge du locataire.'
      ]
    },
    {
      title: 'Carburant',
      bullets: [
        'Le véhicule doit être restitué avec le même niveau de carburant que lors de sa remise.'
      ]
    },
    {
      title: 'Retard de restitution',
      bullets: [
        'Tout retard doit être signalé au plus tôt.',
        'Un retard important pourra entraîner la facturation d\'une journée supplémentaire.'
      ]
    },
    {
      title: 'Accident, panne ou vol',
      bullets: [
        'En cas d\'accident, de panne, de vol ou de dommage, le locataire doit prévenir immédiatement CAR SALAM.',
        'Aucune réparation ne doit être effectuée sans l\'accord préalable du loueur.'
      ]
    },
    {
      title: 'Clés et accessoires',
      bullets: [
        'La perte des clés, des documents du véhicule ou des accessoires sera facturée au locataire.'
      ]
    },
    {
      title: 'Responsabilité',
      bullets: [
        'Le locataire est responsable du véhicule pendant toute la durée de la location jusqu\'à sa restitution.',
        'Les frais de réparation ou de remise en état sont à la charge du locataire, sauf si la responsabilité du loueur ou d\'un tiers est légalement établie.'
      ]
    }
  ],
  acceptance: 'La réservation ou la prise en charge du véhicule vaut acceptation des présentes conditions générales de location.',
  thanks: 'Nous vous remercions pour votre confiance.',
  clientSignatureLabel: 'Signature et empreinte du client',
  agencySignatureLabel: 'Signature et scellés de l\'Agence'
};

/**
 * Get conditions template by language
 */
export const getConditionsTemplate = (language: 'ar' | 'fr'): ConditionsTemplate => {
  return language === 'ar' ? ARABIC_CONDITIONS_TEMPLATE : FRENCH_CONDITIONS_TEMPLATE;
};

/**
 * Generate HTML content for printing conditions.
 * Layout summary:
 *   - Blue gradient header  : linear-gradient(135deg, #003399 → #0047b2)
 *   - Conditions            : 2 columns, one numbered section per block
 *   - Section title         : numbered blue badge + bold #003399 label
 *   - Bullets               : 11.5px / 600, blue dot marker
 *   - Acceptance box        : bg #f0f4ff, border #b8ccee
 *   - Signatures            : simple empty rectangles with the label below
 *   - Page border           : 2px solid #003399
 */
export const generateConditionsPrintHTML = (language: 'ar' | 'fr'): string => {
  const template = getConditionsTemplate(language);
  const isArabic = language === 'ar';
  const dir = isArabic ? 'rtl' : 'ltr';
  const textAlign = isArabic ? 'right' : 'left';

  /**
   * The 11 sections are laid out on two columns so everything (conditions, acceptance box and
   * both signature boxes) still fits on a single A4 sheet. `break-inside: avoid` keeps a section
   * and its bullets together, so a block never splits across the column boundary. The French
   * wording is longer than the Arabic one, so it renders at a slightly reduced scale (fonts +
   * vertical rhythm); horizontal gutters stay fixed so both languages keep the same page frame.
   */
  const scale = isArabic ? 1 : 0.94;
  const u = (n: number): string => `${Math.round(n * scale * 100) / 100}px`;

  const conditionsHTML = template.conditions
    .map(
      (condition, index) => `
      <section class="condition">
        <h2 class="condition-title">
          <span class="condition-num">${index + 1}</span>${condition.title}
        </h2>
        <ul class="condition-bullets">
          ${condition.bullets.map((bullet) => `<li>${bullet}</li>`).join('\n          ')}
        </ul>
      </section>`
    )
    .join('');

  const printDate = new Date().toLocaleDateString(isArabic ? 'en-US' : 'fr-FR');

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${language}">
<head>
  <meta charset="utf-8">
  <title>${template.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      width: 794px;
      margin: 0;
      padding: 0;
      background: white;
    }

    body {
      font-family: 'Arial', 'Helvetica Neue', sans-serif;
      color: #222;
      direction: ${dir};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── PAGE ── */
    .page {
      width: 794px;
      min-height: 1123px;
      padding-bottom: ${u(30)};
      display: flex;
      flex-direction: column;
      background: white;
      border: 2px solid #003399;
    }

    /* ── HEADER ── */
    .header {
      background: linear-gradient(135deg, #003399 0%, #0047b2 100%);
      color: white;
      padding: ${u(18)} 47px ${u(15)};
      text-align: center;
      flex-shrink: 0;
    }

    .header h1 {
      font-size: ${u(22)};
      font-weight: 800;
      margin: 0 0 ${u(7)};
      letter-spacing: 0.3px;
    }

    .header p {
      font-size: ${u(12.5)};
      margin: 0;
      opacity: 0.88;
      font-style: italic;
      color: rgba(255,255,255,0.88);
    }

    /* ── CONTENT ──
       Two columns, no flex-grow: the content takes only the height it needs so the
       acceptance box + signatures sit directly beneath the conditions instead of
       being pushed to the bottom of the A4 page. */
    .content {
      padding: ${u(15)} 47px 0;
      column-count: 2;
      column-gap: 26px;
    }

    /* ── CONDITION BLOCKS ── */
    .condition {
      break-inside: avoid;
      page-break-inside: avoid;
      -webkit-column-break-inside: avoid;
      margin-bottom: ${u(11)};
    }

    .condition-title {
      display: flex;
      align-items: center;
      gap: ${u(6)};
      font-size: ${u(12.5)};
      font-weight: 800;
      color: #003399;
      margin: 0 0 ${u(4)};
      text-align: ${textAlign};
    }

    .condition-num {
      flex-shrink: 0;
      width: ${u(17)};
      height: ${u(17)};
      border-radius: 4px;
      background: linear-gradient(135deg, #003399 0%, #0047b2 100%);
      color: #fff;
      font-size: ${u(10)};
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .condition-bullets {
      list-style: none;
      margin: 0;
      padding-inline-start: ${u(23)};
    }

    .condition-bullets li {
      position: relative;
      padding-inline-start: ${u(10)};
      margin-bottom: ${u(2)};
      font-size: ${u(11.5)};
      color: #111;
      font-weight: 600;
      line-height: 1.5;
      text-align: ${textAlign};
    }

    .condition-bullets li::before {
      content: '';
      position: absolute;
      inset-inline-start: 0;
      top: ${u(7)};
      width: ${u(4)};
      height: ${u(4)};
      border-radius: 50%;
      background: #003399;
    }

    /* ── ACCEPTANCE ── */
    .acceptance {
      margin: ${u(6)} 47px 0;
      padding: ${u(9)} ${u(12)};
      background: #f0f4ff;
      border-radius: 5px;
      border: 1px solid #b8ccee;
      color: #003399;
      text-align: ${textAlign};
    }

    .acceptance-main {
      font-size: ${u(12.5)};
      font-weight: 700;
      margin: 0;
    }

    .acceptance-check {
      font-weight: 800;
      margin-inline-end: ${u(5)};
    }

    .acceptance-thanks {
      font-size: ${u(11.5)};
      font-weight: 600;
      font-style: italic;
      margin: ${u(4)} 0 0;
      opacity: 0.85;
    }

    /* ── SIGNATURES: simple empty rectangles ── */
    .signatures-section {
      margin: ${u(16)} 47px 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 27px;
    }

    .signature-block { text-align: center; }

    .signature-box {
      border: 2px solid #003399;
      border-radius: 4px;
      height: ${u(95)};
      background: #fff;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: ${u(8)};
    }

    .signature-label {
      font-size: ${u(12.5)};
      font-weight: 700;
      color: #003399;
      letter-spacing: 0.2px;
    }

    .print-date {
      text-align: center;
      font-size: ${u(9)};
      color: #888;
      margin: ${u(13)} 47px 0;
      padding-top: ${u(10)};
      border-top: 1px solid #dde3f5;
    }

    @media print {
      @page { size: A4; margin: 0; }
      html, body { width: 794px; }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">

    <div class="header">
      <h1>${template.title}</h1>
      <p>${template.subtitle}</p>
    </div>

    <div class="content">
      ${conditionsHTML}
    </div>

    <div class="acceptance">
      <p class="acceptance-main"><span class="acceptance-check">✓</span>${template.acceptance}</p>
      <p class="acceptance-thanks">${template.thanks}</p>
    </div>

    <div class="signatures-section">
      <div class="signature-block">
        <div class="signature-box">
          <div class="signature-label">${template.agencySignatureLabel}</div>
        </div>
      </div>
      <div class="signature-block">
        <div class="signature-box">
          <div class="signature-label">${template.clientSignatureLabel}</div>
        </div>
      </div>
    </div>

    <div class="print-date">
      ${isArabic ? 'التاريخ: ' : 'Date: '}${printDate}
    </div>

  </div>
</body>
</html>`;
};
