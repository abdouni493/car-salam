/**
 * Conditions Templates - Arabic and French
 * Used for printing rental conditions without database connection
 * Language: Both Arabic (RTL) and French (LTR)
 */

import {
  PrintAgencySettings,
  T,
  esc,
  fmtDate,
  ltr,
  renderPrintDocument,
  renderPrintHeader,
  renderSignatures,
} from '../components/print/printTheme';

export interface ConditionItem {
  title: string;
  content: string;
}

export interface ConditionsTemplate {
  language: 'ar' | 'fr';
  title: string;
  subtitle: string;
  conditions: ConditionItem[];
  clientSignatureLabel: string;
  agencySignatureLabel: string;
}

/**
 * ARABIC CONDITIONS TEMPLATE
 * Complete rental agreement conditions in Arabic
 */
export const ARABIC_CONDITIONS_TEMPLATE: ConditionsTemplate = {
  language: 'ar',
  title: 'شروط الإيجار',
  subtitle: 'يمكنك قراءة شروط العقد في الأسفل ومصادقة عليها',
  conditions: [
    {
      title: 'السن',
      content: 'يجب أن يكون السائق يبلغ من العمر 20 عامًا على الأقل، وأن يكون حاصلًا على رخصة قيادة منذ سنتين على الأقل'
    },
    {
      title: 'جواز السفر',
      content: 'إيداع جواز السفر البيومتري إلزامي، بالإضافة إلى دفع تأمين ابتدائي يبدأ من 30.000,00 دج حسب فئة المركبة، ويُعدّ هذا بمثابة ضمان تطلبه'
    },
    {
      title: 'الوقود',
      content: 'الوقود يكون على نفقة الزبون'
    },
    {
      title: 'قانون ونظام',
      content: 'يتم الدفع نقدًا عند تسليم السيارة'
    },
    {
      title: 'النظافة',
      content: 'تسلم السيارة نظيفة ويجب إرجاعها في نفس الحالة، وفي حال عدم ذلك، سيتم احتساب تكلفة الغسيل بمبلغ 1000 دج'
    },
    {
      title: 'مكان التسليم',
      content: 'يتم تسليم السيارات في موقف السيارات التابع لوكالاتنا'
    },
    {
      title: 'جدول المواعيد',
      content: 'يجب على الزبون احترام المواعيد المحددة عند الحجز. يجب الإبلاغ مسبقًا عن أي تغيير. لا يمكن للزبون تمديد مدة الإيجار إلا بعد الحصول على إذن من وكالتنا للإيجار، وذلك بإشعار مسبق لا يقل عن 48 ساعة'
    },
    {
      title: 'الأضرار والخسائر',
      content: 'في حالة السرقة أو تضرر المركبة، يجب تقديم تصريح لدى مصالح الشرطة أو الدرك الوطني. قبل أي تصريح، يجب على الزبون إبلاغ وكالة الكراء بشكل إلزامي'
    },
    {
      title: 'حد السرقة',
      content: 'في حالة السرقة أو تضرر المركبة، يجب تقديم تصريح لدى مصالح الشرطة أو الدرك الوطني. قبل أي تصريح، يجب على الزبون إبلاغ وكالة الكراء بشكل إلزامي'
    },
    {
      title: 'تأمين',
      content: 'يستفيد من التأمين فقط السائقون المذكورون في عقد الكراء. يُمنع منعًا باتًّا إعارة أو تأجير المركبة من الباطن. وتكون جميع الأضرار الناتجة عن مثل هذه الحالات على عاتق الزبون بالكامل'
    },
    {
      title: 'عطل ميكانيكي',
      content: 'خلال فترة الإيجار، وبناء على عدد الكيلومترات المقطوعة، يجب على الزبون إجراء الفحوصات اللازمة مثل مستوى الزيت، حالة المحرك، ضغط الإطارات، وغيرها. في حال حدوث عطل ميكانيكي بسبب إهمال الزبون في إجراء هذه الفحوصات أو لأي سبب آخر ناتج عن مسؤولية الزبون (مثلاً: كسر حوض الزيت، العارضة السفلية، القفل أو غيرها)، فإن تكاليف الإصلاح والصيانة تكون على عاتق الزبون بالكامل'
    },
    {
      title: 'خسائر إضافية',
      content: 'الأضرار التي تلحق بالعجلات والإطارات، القيادة بالإطارات المفرغة من الهواء، التدهور، السرقة، نهب الملحقات، أعمال التخريب، الأضرار الميكانيكية الناتجة عن سوء استخدام المركبة، المخالفات المرورية، الأضرار التي تحدث أسفل المركبة (الصدام الأمامي، الجوانب، حوض الزيت، العادم) والأضرار الناتجة عن الاضطرابات والشغب، كلها سيتم تحميل تكلفتها على الزبون'
    },
    {
      title: 'ضريبة التأخر',
      content: 'مدة الإيجار تُحتسب على فترات كاملة مدتها 24 ساعة غير قابلة للتقسيم، ابتداءً من وقت حجز المركبة وحتى الوقت المذكور في العقد. يجب على الزبون إعادة المركبة في نفس الوقت، وإلا سيتم احتساب تكلفة تأخير مقدارها 800 دينار لكل ساعة تأخير'
    },
    {
      title: 'عدد الأميال',
      content: 'عدد الكيلومترات محدود لجميع مركباتنا بـ 300 كم يوميًا، ويُفرض غرامة قدرها 30 دج عن كل كيلومتر زائد'
    },
    {
      title: 'شروط',
      content: 'يُقرّ الزبون بأنه اطّلع على شروط الإيجار هذه وقبلها دون أي تحفظ، ويتعهد بتوقيع هذا العقد'
    }
  ],
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
  subtitle: 'Vous pouvez lire les conditions de location, elles apparaîtront sur le contra de location',
  conditions: [
    {
      title: 'Age',
      content: 'Le conducteur doit être âgé au minimum de 20 ans et être titulaire d\'un permis de conduire d\'au moins 2 ans.'
    },
    {
      title: 'Passeport',
      content: 'Dépôt obligatoire du passeport biométrique et le consionnement a partir de 30.000,00Da selon la catégorie du vhécule qui constitue une garantie que nous de mandons.'
    },
    {
      title: 'Carburant',
      content: 'Le carburant est à la charge du client.'
    },
    {
      title: 'Règlement',
      content: 'Le paiement se fait à la livraison de la voiture en espèces.'
    },
    {
      title: 'Propreté',
      content: 'Le véhicule est livré propre et doit être restitué dans le même état, faute de quoi le lavage sera facturé au prix de 1000 Da.'
    },
    {
      title: 'Lieux de livraisons',
      content: 'La livraison des voitures s\'effectue sur le parking de nos agences.'
    },
    {
      title: 'Horaire',
      content: 'Le client doit respecter les horaires établit à la réservation. Tout changement doit être signalé à l\'avance. Le client ne peut prolonger sa location que sur autorisation de notre agence location avec un préavis de 48 heures.'
    },
    {
      title: 'Cas de sinistre',
      content: 'Assurance de base : Le client s\'engage à payer tout dégât occasionné sur le véhicule qu\'il soit fautif ou non fautif. Toutes dégats sur le véhicule feras l\'objet d\'un ponctionnement sur la contion de garantie'
    },
    {
      title: 'Cas de vol',
      content: 'Avant toute déclaration au préalable le client doit obligatoirement informé l\'agence de location Le vol ou la dégradation du véhicule doivent faire lobjet d\'une déclaration auprès des services de police ou de la gendarmerie.'
    },
    {
      title: 'Assurances',
      content: 'Seuls les conducteurs mentionnés sur le contrat de location bénéficient de l\'assurance. Le prêt et la sous-location du véhicule sont strictement interdits. L\'intégralité des dommages survenus dans ces circonstances est à la charge du client.'
    },
    {
      title: 'Panne mécanique',
      content: 'Au cours de la location en fonction du kilométrage parcourus le client doit effectuer les contrôles d\'usage (niveau d\'huile, moteur, pression des pneus, etc....). En cas de panne mécanique due à la négligence du client pour ne pas avoir effectué les contrôles d\'usage ou pour tout autre raisons due à la responsabilité du client (ex: casse carter d\'huile, triangle inférieur, serrure ou autres etc.), la prise en charge du dépannage et de la réparation sont à la charge totale du client.'
    },
    {
      title: 'Dégâts supplémentaire',
      content: 'Les dégâts aux jantes et pneumatiques, le roulage à plat des pneumatiques, la détérioration, les vols, les pillages d\'accessoires, les actes de vandalisme, les dégâts mécaniques dus à une mauvaise utilisation du véhicule, les procès verbaux, les dégâts survenus en dessous du véhicule (jupe, bas de caisse, carter d\'huile, échappement) et les dommages causés par les troubles et émeutes seront facturés au client.'
    },
    {
      title: 'Pénalité de retard',
      content: 'La durée de location se calcul par tranche de 24 heure non fractionnable depuis l\'heure de la réservation du véhicule et l\'heure mentionnée sur le contrat. Le client doit restituer le véhicule à la même heure autrement chaque heure de retard sera facturée au prix de 800 dinars/heure.'
    },
    {
      title: 'Kilométrage',
      content: 'Le kilométrage est limité pour tous nos véhicules a 300Km/Jour.'
    },
    {
      title: 'Acceptation',
      content: 'Le client déclare avoir pris connaissance et accepter sans réserve les présentes conditions de location.et s engage a signé ce contrat.'
    }
  ],
  clientSignatureLabel: 'Signature et empreinte du client',
  agencySignatureLabel: 'Signature et scellés de l\'Agence'
};

/**
 * Get conditions template by language
 */
export const getConditionsTemplate = (language: 'ar' | 'fr'): ConditionsTemplate => {
  return language === 'ar' ? ARABIC_CONDITIONS_TEMPLATE : FRENCH_CONDITIONS_TEMPLATE;
};

/** Contexte optionnel : rappel du client, du véhicule et de la période sur le document. */
export interface ConditionsPrintContext {
  agencySettings?: PrintAgencySettings | null;
  reservation?: {
    id?: string;
    client?: { firstName?: string; lastName?: string; phone?: string };
    car?: { brand?: string; model?: string; registration?: string; year?: number; images?: string[] };
    step1?: { departureDate?: string; returnDate?: string };
    totalDays?: number;
  } | null;
}

/**
 * HTML imprimable des conditions de location, aligné sur le design system
 * d'impression partagé (`components/print/printTheme.ts`) :
 * en-tête dégradé, carte véhicule compacte, sections numérotées, signatures.
 */
export const generateConditionsPrintHTML = (
  language: 'ar' | 'fr',
  context?: ConditionsPrintContext
): string => {
  const template = getConditionsTemplate(language);
  const tr = (fr: string, ar: string) => T(fr, ar, language);

  const reservation = context?.reservation;
  const client = reservation?.client;
  const car = reservation?.car;
  const carImage = car?.images?.[0];

  const carDetail = (label: string, value: unknown) => `
    <div class="car-detail-item">
      <span class="car-detail-label">${label}</span>
      <span class="car-detail-value">${value ? ltr(esc(value)) : '—'}</span>
    </div>`;

  // Rappel client / véhicule / période — omis quand le document est imprimé
  // hors d'une réservation (bouton « Conditions » générique).
  const recapHtml = reservation
    ? `
      <div class="car-info-card">
        ${carImage ? `<div class="car-image"><img src="${esc(carImage)}" alt="" /></div>` : '<div></div>'}
        <div class="car-details">
          ${carDetail(tr('Client', 'العميل'), `${client?.firstName || ''} ${client?.lastName || ''}`.trim())}
          ${carDetail(tr('Téléphone', 'الهاتف'), client?.phone)}
          ${carDetail(tr('Véhicule', 'المركبة'), [car?.brand, car?.model].filter(Boolean).join(' '))}
          ${carDetail(tr('Immatriculation', 'التسجيل'), car?.registration)}
          ${carDetail(tr('Départ', 'المغادرة'), fmtDate(reservation.step1?.departureDate, language))}
          ${carDetail(tr('Retour', 'العودة'), fmtDate(reservation.step1?.returnDate, language))}
        </div>
      </div>`
    : '';

  const conditionsHtml = template.conditions
    .map((condition, index) => `
      <div class="section-title">${index + 1}. ${esc(condition.title)}</div>
      <p class="conditions-text">${esc(condition.content)}</p>`)
    .join('');

  const body = `
    ${renderPrintHeader(
      context?.agencySettings,
      { fr: '📋 Conditions de Location', ar: '📋 شروط الإيجار' },
      language,
      reservation?.id ? reservation.id.toString().substring(0, 8).toUpperCase() : undefined
    )}

    <div class="content">
      ${recapHtml}
      ${conditionsHtml}
    </div>

    ${renderSignatures(language, {
      left: { fr: template.clientSignatureLabel, ar: template.clientSignatureLabel },
      right: { fr: template.agencySignatureLabel, ar: template.agencySignatureLabel },
      note: { fr: 'Lu et approuvé', ar: 'قرئ وصودق عليه' },
    })}
  `;

  return renderPrintDocument(language, template.title, body);
};