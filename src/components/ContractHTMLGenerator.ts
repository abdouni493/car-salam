import { Language, ReservationDetails } from '../types';
import {
  PrintAgencySettings,
  T,
  esc,
  fmtAmount,
  fmtDate,
  ltr,
  renderPrintDocument,
  renderPrintHeader,
  renderSignatures,
} from './print/printTheme';

/** Champs société saisis dans le modal de personnalisation. */
export interface SocieteData {
  conducteur?: string;
  rc?: string;
  art?: string;
  nis?: string;
  nif?: string;
  email?: string;
}

/**
 * CONTRAT DE LOCATION — implémentation unique, partagée par le planificateur et
 * la page Contrats. Utilise le design system d'impression (`print/printTheme`) :
 * en-tête dégradé, carte véhicule, sections, tables, signatures.
 *
 * ⚠️ Document remis au client : aucune donnée du propriétaire d'un véhicule en
 * conciergerie (nom, téléphone, commission, réf. interne) n'y figure.
 */
export const generateContractHTML = (
  reservation: ReservationDetails | null,
  agencySettings: PrintAgencySettings | null | undefined,
  secondConductor: any,
  templateLang: Language,
  societe?: SocieteData | null
): string => {
  const L = templateLang;
  const tr = (fr: string, ar: string) => T(fr, ar, L);
  const d = (value: unknown) => (value ? ltr(fmtDate(value, L)) : '—');
  const money = (n: unknown) => `${ltr(fmtAmount(n))} DA`;

  const client = reservation?.client;
  const car = reservation?.car;
  const totalDays = reservation?.totalDays || 0;
  const totalPrice = Number(reservation?.totalPrice) || 0;
  const pricePerDay = Number(car?.priceDay) || 0;

  // Le total enregistré inclut déjà la TVA (ajoutée à l'étape de tarification) :
  // on l'affiche donc en « dont TVA » plutôt que de la rajouter une seconde fois.
  const tvaIncluded = reservation?.tvaApplied ? Math.round(totalPrice - totalPrice / 1.19) : 0;

  const paid = (reservation?.payments && reservation.payments.length > 0)
    ? reservation.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
    : (Number(reservation?.advancePayment) || 0);
  const remaining = Math.max(0, totalPrice - paid);

  const deliveryFee = Number(reservation?.deliveryFee) || 0;
  const deliveryPaidByOwner = reservation?.deliveryFeePayer === 'owner';

  const assuranceName = reservation?.protectionAssurance?.name || reservation?.protectionAssuranceName;
  const assuranceTotal = Math.round((Number(reservation?.protectionAssurancePrice) || 0) * totalDays);
  const discount = Number(reservation?.discountAmount) || 0;
  const caution = Number((reservation as any)?.cautionAmountDzd) || Number(reservation?.deposit) || 0;

  const carImage = car?.images?.[0];
  const contractRef = reservation?.id ? reservation.id.toString().substring(0, 8).toUpperCase() : '—';

  /** Une paire label / valeur du tableau à deux colonnes. */
  const row = (label: string, value: string) =>
    `<tr><td style="width:38%;font-weight:600;color:#4b5563">${label}</td><td>${value || '—'}</td></tr>`;

  const carDetail = (label: string, value: unknown) => `
    <div class="car-detail-item">
      <span class="car-detail-label">${label}</span>
      <span class="car-detail-value">${value ? ltr(esc(value)) : '—'}</span>
    </div>`;

  // ── Conditions : celles saisies sur la réservation, sinon la liste par défaut
  const defaultConditions = L === 'fr'
    ? ['Permis de conduire valide', 'Assurance tous risques', 'Caution dépôt', 'Carburant plein', 'État du véhicule accepté', 'Pas de dégâts supplémentaires']
    : ['رخصة قيادة سارية', 'تأمين شامل', 'ضمان الإيداع', 'خزان ممتلئ', 'حالة المركبة مقبولة', 'لا توجد أضرار إضافية'];

  const conditionsHtml = reservation?.conditions?.trim()
    ? `<div class="conditions-text">${esc(reservation.conditions)}</div>`
    : `<ul class="conditions-list">${defaultConditions.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;

  const secondName = secondConductor
    ? `${secondConductor.first_name || secondConductor.firstName || ''} ${secondConductor.last_name || secondConductor.lastName || ''}`.trim()
    : '';

  const body = `
    ${renderPrintHeader(agencySettings, { fr: 'CONTRAT DE LOCATION', ar: 'عقد كراء السيارة' }, L, contractRef)}

    <div class="content">
      <!-- Véhicule -->
      <div class="car-info-card">
        ${carImage ? `<div class="car-image"><img src="${esc(carImage)}" alt="" /></div>` : '<div></div>'}
        <div class="car-details">
          ${carDetail(tr('Marque', 'العلامة'), car?.brand)}
          ${carDetail(tr('Modèle', 'الموديل'), car?.model)}
          ${carDetail(tr('Immatriculation', 'التسجيل'), car?.registration)}
          ${carDetail(tr('Année', 'السنة'), car?.year)}
          ${carDetail(tr('Couleur', 'اللون'), car?.color)}
          ${carDetail(tr('Carburant', 'الوقود'), car?.energy)}
          ${carDetail('VIN', car?.vin)}
          ${carDetail(tr('Kilométrage départ', 'كيلومتراج البداية'), `${reservation?.departureInspection?.mileage ?? car?.mileage ?? 0} km`)}
        </div>
      </div>

      <!-- Conducteur principal -->
      <div class="section-title">👤 ${tr('Conducteur principal', 'السائق الرئيسي')}</div>
      <table>
        <tbody>
          ${row(tr('Nom', 'اللقب'), esc(client?.lastName))}
          ${row(tr('Prénom', 'الاسم'), esc(client?.firstName))}
          ${row(tr('Téléphone', 'الهاتف'), client?.phone ? ltr(esc(client.phone)) : '—')}
          ${row(tr('Date de naissance', 'تاريخ الميلاد'), d(client?.dateOfBirth))}
          ${row(tr('Lieu de naissance', 'مكان الميلاد'), esc(client?.placeOfBirth))}
          ${row(tr('Permis n°', 'رقم الرخصة'), client?.licenseNumber ? ltr(esc(client.licenseNumber)) : '—')}
          ${row(tr('Délivrance du permis', 'تاريخ إصدار الرخصة'), d(client?.licenseDelivery || (client as any)?.licenseDeliveryDate))}
          ${row(tr('Expiration du permis', 'تاريخ انتهاء الرخصة'), d(client?.licenseExpiration || (client as any)?.licenseExpirationDate))}
          ${row(tr('Lieu de délivrance', 'مكان الإصدار'), esc(client?.licenseDeliveryPlace))}
          ${row(tr('Adresse', 'العنوان'), esc(client?.completeAddress))}
          ${row(tr('Wilaya', 'الولاية'), esc(client?.wilaya))}
          ${row(tr("Pièce d'identité", 'وثيقة الهوية'), client?.idCardNumber
            ? ltr(esc(client.idCardNumber))
            : (client?.additionalDocNumber ? ltr(esc(client.additionalDocNumber)) : '—'))}
        </tbody>
      </table>

      ${secondConductor ? `
      <!-- Conducteur secondaire -->
      <div class="section-title">👥 ${tr('Conducteur secondaire', 'السائق الثانوي')}</div>
      <table>
        <tbody>
          ${row(tr('Nom complet', 'الاسم الكامل'), esc(secondName))}
          ${row(tr('Permis n°', 'رقم الرخصة'), ltr(esc(secondConductor.license_number || secondConductor.licenseNumber || '')))}
          ${row(tr('Téléphone', 'الهاتف'), secondConductor.phone ? ltr(esc(secondConductor.phone)) : '—')}
          ${row(tr('Date de naissance', 'تاريخ الميلاد'), d(secondConductor.date_of_birth || secondConductor.dateOfBirth))}
          ${row(tr('Lieu de naissance', 'مكان الميلاد'), esc(secondConductor.place_of_birth || secondConductor.placeOfBirth || ''))}
        </tbody>
      </table>` : ''}

      ${societe ? `
      <!-- Société -->
      <div class="section-title">🏢 ${tr('Société', 'الشركة')}</div>
      <table>
        <tbody>
          ${row(tr('Conducteur désigné', 'السائق المعيّن'), esc(societe.conducteur))}
          ${row('RC',  ltr(esc(societe.rc)))}
          ${row('ART', ltr(esc(societe.art)))}
          ${row('NIS', ltr(esc(societe.nis)))}
          ${row('NIF', ltr(esc(societe.nif)))}
          ${row(tr('Email', 'البريد الإلكتروني'), societe.email ? ltr(esc(societe.email)) : '—')}
        </tbody>
      </table>` : ''}

      <!-- Période -->
      <div class="section-title">📅 ${tr('Période de location', 'فترة الإيجار')}</div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>${tr('Date', 'التاريخ')}</th>
            <th>${tr('Heure', 'الساعة')}</th>
            <th>${tr('Agence', 'الوكالة')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight:600">${tr('Départ', 'المغادرة')}</td>
            <td>${d(reservation?.step1?.departureDate)}</td>
            <td>${ltr(esc(reservation?.step1?.departureTime || '—'))}</td>
            <td>${esc((reservation as any)?.departure_agency?.name || reservation?.step1?.departureAgency || '—')}</td>
          </tr>
          <tr>
            <td style="font-weight:600">${tr('Retour', 'العودة')}</td>
            <td>${d(reservation?.step1?.returnDate)}</td>
            <td>${ltr(esc(reservation?.step1?.returnTime || '—'))}</td>
            <td>${esc((reservation as any)?.return_agency?.name || reservation?.step1?.returnAgency || '—')}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">${tr('Durée totale', 'المدة الإجمالية')}</td>
            <td class="amount-cell">${ltr(totalDays)} ${tr('jours', 'أيام')}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Tarification -->
      <div class="section-title">💰 ${tr('Tarification', 'التسعير')}</div>
      <table>
        <thead>
          <tr>
            <th>${tr('Désignation', 'البيان')}</th>
            <th class="amount-cell">${tr('Montant', 'المبلغ')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${tr('Location', 'الإيجار')} — ${money(pricePerDay)} × ${ltr(totalDays)} ${tr('jours', 'أيام')}</td>
            <td class="amount-cell">${money(pricePerDay * totalDays)}</td>
          </tr>
          ${(reservation?.additionalServices || []).map((s: any) => `
          <tr>
            <td>🛎️ ${esc(s.name || s.service_name)}</td>
            <td class="amount-cell">${money(s.price)}</td>
          </tr>`).join('')}
          ${assuranceName ? `
          <tr>
            <td>🛡️ ${esc(assuranceName)}</td>
            <td class="amount-cell">${money(assuranceTotal)}</td>
          </tr>` : ''}
          ${discount > 0 ? `
          <tr>
            <td>${tr('Remise', 'تخفيض')}</td>
            <td class="amount-cell">− ${money(discount)}</td>
          </tr>` : ''}
          ${deliveryFee > 0 ? `
          <tr${deliveryPaidByOwner ? ' class="muted-row"' : ''}>
            <td>🚚 ${tr('Frais de livraison', 'رسوم التوصيل')} — ${deliveryPaidByOwner
              ? tr('à la charge du propriétaire du véhicule (non facturés)', 'على عاتق مالك المركبة (غير مفوترة)')
              : tr('à la charge du client', 'على عاتق العميل')}</td>
            <td class="amount-cell">${deliveryPaidByOwner ? '—' : money(deliveryFee)}</td>
          </tr>` : ''}
          ${tvaIncluded > 0 ? `
          <tr>
            <td>${tr('Dont TVA (19%)', 'منها الضريبة (19%)')}</td>
            <td class="amount-cell">${money(tvaIncluded)}</td>
          </tr>` : ''}
          ${caution > 0 ? `
          <tr>
            <td>${tr('Caution (restituée en fin de location)', 'الضمان (يُعاد عند نهاية الإيجار)')}</td>
            <td class="amount-cell">${money(caution)}</td>
          </tr>` : ''}
        </tbody>
        <tfoot>
          <tr>
            <td>${tr('TOTAL', 'الإجمالي')}</td>
            <td class="amount-cell">${money(totalPrice)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="summary-section" style="grid-template-columns: 1fr 1fr 1fr;">
        <div class="summary-item">
          <div class="summary-label">${tr('Total', 'الإجمالي')}</div>
          <div class="summary-value">${money(totalPrice)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">${tr('Avance', 'الدفعة الأولى')}</div>
          <div class="summary-value">${money(paid)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">${tr('Reste à payer', 'المتبقي')}</div>
          <div class="summary-value">${money(remaining)}</div>
        </div>
      </div>

      <!-- Conditions -->
      <div class="section-title">📋 ${tr('Conditions de location', 'شروط الإيجار')}</div>
      ${conditionsHtml}
    </div>

    ${renderSignatures(L)}
  `;

  return renderPrintDocument(L, tr('Contrat de location', 'عقد كراء السيارة'), body);
};
