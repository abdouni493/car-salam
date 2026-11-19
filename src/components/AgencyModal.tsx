import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Agency, Language } from '../types';
import { X } from 'lucide-react';
import { formatAmount } from '../utils/format';

interface AgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agency: Partial<Agency>) => void;
  agency?: Agency;
  lang: Language;
}

export const AgencyModal: React.FC<AgencyModalProps> = ({ isOpen, onClose, onSave, agency, lang }) => {
  const [formData, setFormData] = useState<Partial<Agency>>({
    name: '',
    address: '',
    city: '',
    deliveryPriceAller: 0,
    deliveryPriceRetour: 0,
  });

  useEffect(() => {
    if (agency) {
      setFormData({
        name: agency.name,
        address: agency.address,
        city: agency.city,
        deliveryPriceAller: agency.deliveryPriceAller ?? 0,
        deliveryPriceRetour: agency.deliveryPriceRetour ?? 0,
      });
    } else {
      setFormData({
        name: '',
        address: '',
        city: '',
        deliveryPriceAller: 0,
        deliveryPriceRetour: 0,
      });
    }
  }, [agency, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? ('' as any) : Math.max(0, Number(value))) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.address && formData.city) {
      onSave({
        ...formData,
        deliveryPriceAller: Number(formData.deliveryPriceAller) || 0,
        deliveryPriceRetour: Number(formData.deliveryPriceRetour) || 0,
      });
    }
  };

  const aller = Number(formData.deliveryPriceAller) || 0;
  const retour = Number(formData.deliveryPriceRetour) || 0;
  const da = lang === 'fr' ? 'DA' : 'دج';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-saas-border"
      >
        {/* Header — fixed */}
        <div className="shrink-0 px-6 py-5 flex items-center justify-between gap-4 bg-linear-to-r from-saas-primary-start via-saas-primary-via to-saas-primary-end text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center text-2xl">
              {agency ? '✏️' : '🏢'}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black uppercase tracking-tight truncate">
                {agency
                  ? (lang === 'fr' ? 'Modifier Agence' : 'تعديل الوكالة')
                  : (lang === 'fr' ? 'Nouvelle Agence' : 'وكالة جديدة')}
              </h2>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-0.5 truncate">
                {agency?.name || (lang === 'fr' ? "Informations d'agence" : 'معلومات الوكالة')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 p-2.5 hover:bg-white/20 rounded-xl transition-colors" aria-label={lang === 'fr' ? 'Fermer' : 'إغلاق'}>
            <X size={22} />
          </button>
        </div>

        {/* Body — scrollable */}
        <form
          id="agency-form"
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-5 custom-scrollbar bg-saas-bg"
        >
          {/* Informations */}
          <section className="rounded-2xl border border-saas-border bg-white p-4 sm:p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-saas-text-muted">
              📋 {lang === 'fr' ? 'Informations' : 'المعلومات'}
            </h3>

            <div className="space-y-2">
              <label className="label-saas">
                {lang === 'fr' ? "🏢 Nom de l'Agence *" : '🏢 اسم الوكالة *'}
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={lang === 'fr' ? 'Ex: Agence Centre-Ville' : 'مثال: وكالة وسط المدينة'}
                className="input-saas"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="label-saas">
                {lang === 'fr' ? '📍 Adresse Complète *' : '📍 العنوان الكامل *'}
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder={lang === 'fr' ? 'Ex: 123 Avenue Principale' : 'مثال: 123 شارع رئيسي'}
                className="input-saas"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="label-saas">
                {lang === 'fr' ? '🏙️ Ville *' : '🏙️ المدينة *'}
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder={lang === 'fr' ? 'Ex: Alger' : 'مثال: الجزائر'}
                className="input-saas"
                required
              />
            </div>
          </section>

          {/* Prix de livraison */}
          <section className="rounded-2xl border border-sky-200 bg-white p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-sky-700">
                🚚 {lang === 'fr' ? 'Prix de livraison' : 'سعر التوصيل'}
              </h3>
              <p className="text-[11px] font-medium text-saas-text-muted mt-1.5 leading-relaxed">
                {lang === 'fr'
                  ? "« Aller » s'applique quand l'agence est l'agence de départ, « retour » quand elle est l'agence de retour. 0 = gratuit."
                  : '«ذهاب» يُطبَّق عندما تكون الوكالة وكالة الانطلاق، و«إياب» عندما تكون وكالة الإرجاع. 0 = مجاني.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                ['deliveryPriceAller', lang === 'fr' ? '➡️ Aller' : '➡️ ذهاب'],
                ['deliveryPriceRetour', lang === 'fr' ? '⬅️ Retour' : '⬅️ إياب'],
              ] as const).map(([field, label]) => (
                <div key={field} className="space-y-2">
                  <label className="label-saas">{label}</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={100}
                      name={field}
                      value={formData[field] as any}
                      onChange={handleChange}
                      placeholder="0"
                      className="input-saas pe-12"
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-xs font-black text-saas-text-muted">
                      {da}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-sky-50 border border-sky-200 px-4 py-3">
              <span className="text-xs font-bold text-sky-800">
                {lang === 'fr' ? 'Départ et retour dans cette agence' : 'الانطلاق والإرجاع في هذه الوكالة'}
              </span>
              <span className="text-sm font-black text-sky-900">
                {formatAmount(aller + retour)} {da}
              </span>
            </div>
          </section>
        </form>

        {/* Footer — fixed */}
        <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-saas-border flex items-center gap-3 bg-white">
          <button type="button" onClick={onClose} className="flex-1 btn-saas-outline py-3">
            {lang === 'fr' ? 'Annuler' : 'إلغاء'}
          </button>
          <button type="submit" form="agency-form" className="flex-1 btn-saas-primary py-3">
            {lang === 'fr' ? 'Enregistrer' : 'حفظ'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
