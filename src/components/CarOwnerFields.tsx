import React, { useState } from 'react';
import { Loader2, FileText, Upload } from 'lucide-react';
import { CarOwnerInfo, CommissionType, Language, OwnershipType } from '../types';
import { uploadOwnerContract, getOwnerContractUrl } from '../services/uploadOwnerContract';

/** Valeurs par défaut d'un nouveau propriétaire (commission en % par convention). */
export const emptyOwnerInfo = (carId = ''): CarOwnerInfo => ({
  carId,
  ownerName: '',
  ownerPhone: '',
  consignmentDate: new Date().toISOString().substring(0, 10),
  commissionType: 'percentage',
  commissionValue: 0,
  contractUrl: '',
  privateNotes: '',
});

interface OwnershipSelectorProps {
  value: OwnershipType;
  onChange: (value: OwnershipType) => void;
  lang: Language;
}

/** Sélecteur segmenté : véhicule personnel ou véhicule en conciergerie. */
export const OwnershipSelector: React.FC<OwnershipSelectorProps> = ({ value, onChange, lang }) => {
  const options: { key: OwnershipType; label: string }[] = [
    { key: 'personal',    label: lang === 'fr' ? '🚗 Véhicule personnel'       : '🚗 مركبة شخصية' },
    { key: 'consignment', label: lang === 'fr' ? '🤝 Véhicule en conciergerie' : '🤝 مركبة بالوكالة' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-saas-bg border border-saas-border rounded-2xl">
      {options.map(opt => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            value === opt.key
              ? 'bg-white text-saas-primary-via shadow-sm border border-saas-border'
              : 'text-saas-text-muted hover:text-saas-text-main'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

interface CarOwnerFieldsProps {
  value: CarOwnerInfo;
  onChange: (value: CarOwnerInfo) => void;
  lang: Language;
  /** Présent en édition : sert à nommer le contrat téléversé. */
  carId?: string;
}

/**
 * Panneau des données PRIVÉES du propriétaire d'un véhicule en conciergerie.
 * Ces champs vivent dans `car_owners` et ne sont jamais exposés au site public.
 */
export const CarOwnerFields: React.FC<CarOwnerFieldsProps> = ({ value, onChange, lang, carId }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const set = <K extends keyof CarOwnerInfo>(key: K, v: CarOwnerInfo[K]) =>
    onChange({ ...value, [key]: v });

  const handleCommissionType = (type: CommissionType) => {
    // Basculer de type conserve la saisie : seule l'unité change.
    onChange({ ...value, commissionType: type });
  };

  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadOwnerContract(file, carId);
      if (result.success && result.url) {
        set('contractUrl', result.url);
      } else {
        setUploadError(result.error || (lang === 'fr' ? 'Échec du téléversement' : 'فشل الرفع'));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleViewContract = async () => {
    if (!value.contractUrl) return;
    const url = await getOwnerContractUrl(value.contractUrl);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setUploadError(lang === 'fr' ? 'Contrat introuvable' : 'العقد غير موجود');
  };

  const isPercentage = value.commissionType === 'percentage';

  return (
    <section className="space-y-6 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-6">
      <div>
        <h3 className="text-xs font-black text-amber-800 flex items-center gap-3 uppercase tracking-[0.2em]">
          <span className="p-2 bg-amber-200/70 rounded-lg">🔒</span>
          {lang === 'fr'
            ? 'Informations propriétaire — visibles uniquement par l’administrateur'
            : 'معلومات المالك — مرئية للمسؤول فقط'}
        </h3>
        <p className="text-[11px] text-amber-700/80 mt-2 ms-1">
          {lang === 'fr'
            ? 'Ces données ne sont jamais transmises au site public.'
            : 'لا تُرسل هذه البيانات أبدًا إلى الموقع العام.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="label-saas">
            👤 {lang === 'fr' ? 'Nom du propriétaire' : 'اسم المالك'} <span className="text-red-600">*</span>
          </label>
          <input
            value={value.ownerName}
            onChange={e => set('ownerName', e.target.value)}
            className="input-saas"
            required
            placeholder={lang === 'fr' ? 'ex : Mohamed B.' : 'مثال: محمد ب.'}
          />
        </div>

        <div className="space-y-2">
          <label className="label-saas">📞 {lang === 'fr' ? 'Téléphone du propriétaire' : 'هاتف المالك'}</label>
          <input
            value={value.ownerPhone || ''}
            onChange={e => set('ownerPhone', e.target.value)}
            className="input-saas"
            dir="ltr"
            placeholder="0555 00 00 00"
          />
        </div>

        <div className="space-y-2">
          <label className="label-saas">🚗 {lang === 'fr' ? 'Référence interne' : 'المرجع الداخلي'}</label>
          <input
            value={value.internalRef || ''}
            readOnly
            disabled
            dir="ltr"
            className="input-saas bg-white/60 cursor-not-allowed text-saas-text-muted"
            placeholder={lang === 'fr' ? 'Générée automatiquement (CS-001, CS-002…)' : 'تُنشأ تلقائيًا (CS-001، CS-002…)'}
          />
        </div>

        <div className="space-y-2">
          <label className="label-saas">📅 {lang === 'fr' ? 'Date de dépôt' : 'تاريخ الإيداع'}</label>
          <input
            type="date"
            value={value.consignmentDate || ''}
            onChange={e => set('consignmentDate', e.target.value)}
            className="input-saas"
          />
        </div>
      </div>

      {/* 💰 Commission — deux types exclusifs, la saisie est conservée au basculement */}
      <div className="space-y-3">
        <label className="label-saas">💰 {lang === 'fr' ? 'Commission de l’agence' : 'عمولة الوكالة'}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
            !isPercentage ? 'bg-white border-amber-400' : 'bg-white/50 border-saas-border hover:border-amber-300'
          }`}>
            <input
              type="radio"
              name="commissionType"
              checked={!isPercentage}
              onChange={() => handleCommissionType('amount')}
              className="accent-amber-600"
            />
            <span className="text-xs font-bold">
              {lang === 'fr' ? 'Commission en dinars (DA)' : 'عمولة بالدينار (DA)'}
            </span>
          </label>
          <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
            isPercentage ? 'bg-white border-amber-400' : 'bg-white/50 border-saas-border hover:border-amber-300'
          }`}>
            <input
              type="radio"
              name="commissionType"
              checked={isPercentage}
              onChange={() => handleCommissionType('percentage')}
              className="accent-amber-600"
            />
            <span className="text-xs font-bold">
              {lang === 'fr' ? 'Commission en pourcentage (%)' : 'عمولة بالنسبة المئوية (%)'}
            </span>
          </label>
        </div>

        <div className="relative max-w-xs">
          <input
            type="number"
            min={0}
            max={isPercentage ? 100 : undefined}
            step={isPercentage ? 0.5 : 100}
            value={value.commissionValue}
            onChange={e => set('commissionValue', Math.max(0, Number(e.target.value) || 0))}
            className="input-saas pe-16"
            dir="ltr"
          />
          <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-black text-amber-700">
            {isPercentage ? '%' : 'DA'}
          </span>
        </div>
      </div>

      {/* 📄 Contrat scanné */}
      <div className="space-y-2">
        <label className="label-saas">📄 {lang === 'fr' ? 'Contrat de conciergerie' : 'عقد الوكالة'}</label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-saas-secondary px-6 py-3 cursor-pointer flex items-center gap-2">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span className="font-bold uppercase tracking-widest text-[10px]">
              {uploading
                ? (lang === 'fr' ? 'Téléversement…' : 'جارٍ الرفع…')
                : (lang === 'fr' ? 'Téléverser le contrat' : 'رفع العقد')}
            </span>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleContractUpload}
              disabled={uploading}
            />
          </label>

          {value.contractUrl && (
            <button
              type="button"
              onClick={handleViewContract}
              className="flex items-center gap-2 text-xs font-bold text-amber-800 underline underline-offset-4"
            >
              <FileText size={14} />
              {lang === 'fr' ? 'Voir le contrat' : 'عرض العقد'}
            </button>
          )}
        </div>
        {uploadError && <p className="text-xs font-bold text-red-600">{uploadError}</p>}
      </div>

      <div className="space-y-2">
        <label className="label-saas">📝 {lang === 'fr' ? 'Notes privées' : 'ملاحظات خاصة'}</label>
        <textarea
          value={value.privateNotes || ''}
          onChange={e => set('privateNotes', e.target.value)}
          rows={3}
          className="input-saas resize-none"
          placeholder={lang === 'fr' ? 'Visible uniquement par vous…' : 'مرئية لك فقط…'}
        />
      </div>
    </section>
  );
};
