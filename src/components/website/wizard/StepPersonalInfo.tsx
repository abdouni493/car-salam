import React, { useState } from 'react';
import { Upload, FileText, Loader2, X, Info, AlertTriangle } from 'lucide-react';
import { useWizard, MIN_DRIVER_AGE } from './WizardContext';
import { uploadClientProfilePhoto, uploadClientDocument } from '../../../services/uploadClientImage';
import { SectionCard, SectionTitle, FieldLabel, inputClass, inputStyle, focusInput, blurInput, C, ALGERIAN_WILAYAS } from './wizardUi';

/**
 * Étape 4 — Informations personnelles.
 *
 * Toutes les informations sont FACULTATIVES : le client les complète à l'agence
 * au moment de récupérer le véhicule. Seule exception, la date de naissance :
 * elle est exigée parce qu'elle sert à vérifier l'âge minimum légal (18 ans),
 * et une date sous cet âge bloque la réservation.
 */
export const StepPersonalInfo: React.FC = () => {
  const { lang, personal, setPersonal, clientAge, isUnderage } = useWizard();

  // Borne haute du sélecteur de date : la date de naissance d'une personne qui
  // atteint tout juste 18 ans aujourd'hui.
  const maxBirthDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - MIN_DRIVER_AGE);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPersonal(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingProfile(true);
    try {
      const result = await uploadClientProfilePhoto(file);
      if (result.success && result.url) {
        setPersonal(prev => ({ ...prev, photo: result.url }));
      } else {
        setUploadError(result.error || 'Upload failed');
      }
    } catch {
      setUploadError('Upload error');
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    setUploadError(null);
    for (const file of Array.from(fileList) as File[]) {
      setUploadingDocument(true);
      try {
        const result = await uploadClientDocument(file);
        if (result.success && result.url) {
          setPersonal(prev => ({ ...prev, scannedDocuments: [...(prev.scannedDocuments || []), result.url] }));
        } else {
          setUploadError(result.error || 'Upload failed');
        }
      } catch {
        setUploadError('Upload error');
      } finally {
        setUploadingDocument(false);
      }
    }
  };

  const removeDocument = (index: number) => {
    setPersonal(prev => ({ ...prev, scannedDocuments: prev.scannedDocuments?.filter((_, i) => i !== index) || [] }));
  };

  return (
    <div className="space-y-6">
      {/* Photo */}
      <SectionCard>
        <SectionTitle>📸 {{ fr: 'Photo (optionnelle)', ar: 'صورة (اختياري)' }[lang]}</SectionTitle>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.16)' }}>
            {personal.photo
              ? <img src={personal.photo} alt="Photo" className="w-full h-full object-cover" />
              : <span className="text-3xl">📷</span>
            }
          </div>
          <label>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingProfile} />
            <span className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${uploadingProfile ? 'opacity-50' : ''}`}
              style={{ background: 'rgba(234, 88, 12, 0.08)', border: '1px solid rgba(234, 88, 12, 0.25)', color: C.accent, fontFamily: 'var(--font-display)' }}>
              {uploadingProfile ? <><Loader2 size={16} className="animate-spin" /> {lang === 'fr' ? 'Envoi…' : 'جاري…'}</> : <><Upload size={16} /> {lang === 'fr' ? 'Charger' : 'تحميل'}</>}
            </span>
          </label>
        </div>
        {uploadError && <p className="text-vel-gold-dark text-sm">{uploadError}</p>}
      </SectionCard>

      {/* Personal info — tout est facultatif sauf la date de naissance */}
      <SectionCard>
        <SectionTitle>👤 {{ fr: 'Informations Personnelles', ar: 'معلومات شخصية' }[lang]}</SectionTitle>

        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.16)' }}>
          <Info size={17} style={{ color: C.accent }} className="flex-shrink-0 mt-0.5" />
          <p className="text-vel-slate text-sm leading-relaxed">
            {{ fr: 'Ces informations sont facultatives : vous pouvez les compléter à l\u2019agence lors de la récupération du véhicule. Seule la date de naissance est demandée maintenant, pour vérifier l\u2019âge minimum de conduite.',
               ar: 'هذه المعلومات اختيارية: يمكنك إكمالها في الوكالة عند استلام السيارة. تاريخ الميلاد وحده مطلوب الآن للتحقق من السن الأدنى للقيادة.' }[lang]}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: { fr: 'Nom de famille', ar: 'الاسم الأخير' }, name: 'lastName', type: 'text' },
            { label: { fr: 'Prénom', ar: 'الاسم الأول' }, name: 'firstName', type: 'text' },
            { label: { fr: 'Téléphone', ar: 'الهاتف' }, name: 'phone', type: 'tel' },
            { label: { fr: 'Email', ar: 'البريد الإلكتروني' }, name: 'email', type: 'email' },
            { label: { fr: 'Lieu de naissance', ar: 'مكان الميلاد' }, name: 'placeOfBirth', type: 'text' },
          ].map(f => (
            <div key={f.name}>
              <FieldLabel>{f.label[lang]}</FieldLabel>
              <input type={f.type} name={f.name} value={(personal as any)[f.name]}
                onChange={handleChange} className={inputClass} style={inputStyle}
                onFocus={focusInput} onBlur={blurInput} />
            </div>
          ))}

          {/* Date de naissance — seul champ obligatoire (contrôle des 18 ans) */}
          <div>
            <FieldLabel>{{ fr: 'Date de naissance *', ar: 'تاريخ الميلاد *' }[lang]}</FieldLabel>
            <input
              type="date"
              name="dateOfBirth"
              value={personal.dateOfBirth}
              max={maxBirthDate}
              onChange={handleChange}
              className={inputClass}
              style={{ ...inputStyle, ...(isUnderage ? { borderColor: 'var(--color-vel-cta)' } : {}) }}
              onFocus={focusInput}
              onBlur={blurInput}
              aria-invalid={isUnderage}
            />
            {!personal.dateOfBirth && (
              <p className="text-vel-muted text-xs mt-2">
                {{ fr: `Obligatoire — la location est réservée aux personnes de ${MIN_DRIVER_AGE} ans et plus.`,
                   ar: `مطلوب — الإيجار مخصص لمن بلغوا ${MIN_DRIVER_AGE} سنة فأكثر.` }[lang]}
              </p>
            )}
            {personal.dateOfBirth && !isUnderage && clientAge !== null && (
              <p className="text-vel-muted text-xs mt-2">
                {{ fr: `${clientAge} ans — âge minimum respecté ✅`, ar: `${clientAge} سنة — السن الأدنى مستوفى ✅` }[lang]}
              </p>
            )}
          </div>
        </div>

        {/* Blocage explicite des mineurs */}
        {isUnderage && (
          <p className="flex items-start gap-2 text-sm font-bold px-4 py-3 rounded-xl"
            style={{ color: 'var(--color-vel-cta-bright)', background: 'rgba(234, 88, 12, 0.08)', border: '1px solid rgba(234, 88, 12, 0.3)' }}>
            <AlertTriangle size={17} className="flex-shrink-0 mt-0.5" />
            {{ fr: `Vous avez ${clientAge} ans. La location est interdite aux moins de ${MIN_DRIVER_AGE} ans : la réservation ne peut pas être poursuivie.`,
               ar: `عمرك ${clientAge} سنة. الإيجار ممنوع لمن هم دون ${MIN_DRIVER_AGE} سنة: لا يمكن متابعة الحجز.` }[lang]}
          </p>
        )}
      </SectionCard>

      {/* License */}
      <SectionCard>
        <SectionTitle>🪪 {{ fr: 'Permis de conduire', ar: 'رخصة القيادة' }[lang]}</SectionTitle>

        {/* Le permis n'est plus exigé en ligne, mais il l'est au comptoir. */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(234, 88, 12, 0.08)', border: '1px solid rgba(234, 88, 12, 0.3)' }}>
          <AlertTriangle size={17} style={{ color: C.accent }} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed font-bold" style={{ color: 'var(--color-vel-cta-bright)' }}>
            {{ fr: 'Le permis de conduire est OBLIGATOIRE au moment de récupérer la voiture. Vous pouvez laisser ces champs vides ici, mais présentez-vous à l\u2019agence avec votre permis original en cours de validité.',
               ar: 'رخصة القيادة إلزامية عند استلام السيارة. يمكنك ترك هذه الحقول فارغة هنا، لكن احضر إلى الوكالة برخصتك الأصلية سارية المفعول.' }[lang]}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: { fr: 'N° Permis', ar: 'رقم الرخصة' }, name: 'licenseNumber', type: 'text' },
            { label: { fr: 'Expiration', ar: 'انتهاء الصلاحية' }, name: 'licenseExpiration', type: 'date' },
            { label: { fr: 'Date de délivrance', ar: 'تاريخ الإصدار' }, name: 'licenseDelivery', type: 'date' },
            { label: { fr: 'Lieu de délivrance', ar: 'مكان الإصدار' }, name: 'licenseDeliveryPlace', type: 'text' },
          ].map(f => (
            <div key={f.name}>
              <FieldLabel>{f.label[lang]}</FieldLabel>
              <input type={f.type} name={f.name} value={(personal as any)[f.name]}
                onChange={handleChange} className={inputClass} style={inputStyle}
                onFocus={focusInput} onBlur={blurInput} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Additional document */}
      <SectionCard>
        <SectionTitle>🎫 {{ fr: 'Document additionnel', ar: 'وثيقة إضافية' }[lang]}</SectionTitle>
        <div>
          <FieldLabel>{{ fr: 'Type de document', ar: 'نوع الوثيقة' }[lang]}</FieldLabel>
          <select name="additionalDocType" value={personal.additionalDocType}
            onChange={handleChange} className={inputClass} style={{ ...inputStyle, cursor: 'pointer' }}
            onFocus={focusInput} onBlur={blurInput}>
            <option value="none">{{ fr: 'Aucun', ar: 'بدون' }[lang]}</option>
            <option value="id_card">{{ fr: "Carte d'identité", ar: 'بطاقة الهوية' }[lang]}</option>
            <option value="passport">{{ fr: 'Passeport', ar: 'جواز سفر' }[lang]}</option>
          </select>
        </div>
        {personal.additionalDocType !== 'none' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: { fr: 'N° Document', ar: 'رقم الوثيقة' }, name: 'additionalDocNumber', type: 'text' },
              { label: { fr: 'Date délivrance', ar: 'تاريخ الإصدار' }, name: 'additionalDocDelivery', type: 'date' },
              { label: { fr: 'Expiration', ar: 'الانتهاء' }, name: 'additionalDocExpiration', type: 'date' },
              { label: { fr: 'Adresse délivrance', ar: 'عنوان الإصدار' }, name: 'additionalDocDeliveryAddress', type: 'text' },
            ].map(f => (
              <div key={f.name}>
                <FieldLabel>{f.label[lang]}</FieldLabel>
                <input type={f.type} name={f.name} value={(personal as any)[f.name]}
                  onChange={handleChange} className={inputClass} style={inputStyle}
                  onFocus={focusInput} onBlur={blurInput} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Scanned docs */}
      <SectionCard>
        <SectionTitle>📄 {{ fr: 'Documents scannés', ar: 'الوثائق الممسوحة' }[lang]}</SectionTitle>
        <p className="text-vel-muted text-sm -mt-2">
          {{ fr: "Permis de conduire, carte d'identité, etc.", ar: 'رخصة القيادة، بطاقة الهوية، إلخ' }[lang]}
        </p>
        <label>
          <input type="file" multiple accept="image/*,.pdf" onChange={handleDocumentUpload} className="hidden" disabled={uploadingDocument} />
          <span className={`cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${uploadingDocument ? 'opacity-50' : ''}`}
            style={{ background: 'rgba(234, 88, 12, 0.1)', border: '1px solid rgba(234, 88, 12, 0.28)', color: C.amber, fontFamily: 'var(--font-display)' }}>
            {uploadingDocument ? <><Loader2 size={16} className="animate-spin" /> {lang === 'fr' ? 'Envoi…' : 'جاري…'}</> : <><Upload size={16} /> {{ fr: 'Télécharger', ar: 'تحميل' }[lang]}</>}
          </span>
        </label>
        {uploadError && <p className="text-vel-gold-dark text-sm">{uploadError}</p>}

        {personal.scannedDocuments && personal.scannedDocuments.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {personal.scannedDocuments.map((docUrl, index) => (
              <div key={index} className="relative group aspect-square rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(234, 88, 12, 0.28)' }}>
                {docUrl.includes('data:application/pdf') ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: 'rgba(234, 88, 12, 0.08)' }}>
                    <FileText size={28} style={{ color: C.amber }} />
                    <p className="text-xs font-bold" style={{ color: C.amber }}>PDF</p>
                  </div>
                ) : (
                  <img src={docUrl} alt={`Doc ${index + 1}`} className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(docUrl, '_blank')} />
                )}
                <button onClick={() => removeDocument(index)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'var(--color-vel-cta)' }}>
                  <X size={12} color="#FFFFFF" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-vel-dim">
            <FileText size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{{ fr: 'Aucun document téléchargé', ar: 'لم يتم تحميل أي وثيقة' }[lang]}</p>
          </div>
        )}
      </SectionCard>

      {/* Address */}
      <SectionCard>
        <SectionTitle>🏠 {{ fr: 'Adresse & Localisation', ar: 'العنوان والموقع' }[lang]}</SectionTitle>
        <div>
          <FieldLabel>{{ fr: 'Wilaya', ar: 'الولاية' }[lang]}</FieldLabel>
          <select name="wilaya" value={personal.wilaya} onChange={handleChange}
            className={inputClass} style={{ ...inputStyle, cursor: 'pointer' }}
            onFocus={focusInput} onBlur={blurInput}>
            {ALGERIAN_WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>{{ fr: 'Adresse complète', ar: 'العنوان الكامل' }[lang]}</FieldLabel>
          <textarea name="completeAddress" value={personal.completeAddress} onChange={handleChange}
            rows={3} className={`${inputClass} resize-none`} style={inputStyle}
            placeholder={lang === 'fr' ? 'Rue, N°, Quartier…' : 'الشارع، الرقم، المنطقة…'}
            onFocus={focusInput} onBlur={blurInput} />
        </div>
      </SectionCard>
    </div>
  );
};
