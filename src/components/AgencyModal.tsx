import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Agency, Language } from '../types';
import { X } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-saas-border"
      >
        <div className="p-6 border-b border-saas-border flex items-center justify-between bg-linear-to-r from-saas-primary-start via-saas-primary-via to-saas-primary-end text-white">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              {agency ? '✏️ ' : '🏢 '} 
              {agency 
                ? (lang === 'fr' ? 'Modifier Agence' : 'تعديل الوكالة')
                : (lang === 'fr' ? 'Nouvelle Agence' : 'وكالة جديدة')}
            </h2>
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-1">
              {lang === 'fr' ? 'Informations d\'agence' : 'معلومات الوكالة'}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Name */}
          <div className="space-y-2">
            <label className="label-saas">
              {lang === 'fr' ? '🏢 Nom de l\'Agence *' : '🏢 اسم الوكالة *'}
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

          {/* Address */}
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

          {/* City */}
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

          {/* Delivery prices */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-black text-sky-900">
                🚚 {lang === 'fr' ? 'Prix de livraison' : 'سعر التوصيل'}
              </p>
              <p className="text-[11px] font-medium text-sky-700 mt-1">
                {lang === 'fr'
                  ? "Appliqués automatiquement aux réservations : « aller » quand l'agence est l'agence de départ, « retour » quand elle est l'agence de retour. 0 = gratuit."
                  : 'تُطبَّق تلقائيًا على الحجوزات: «ذهاب» عندما تكون الوكالة وكالة الانطلاق، و«إياب» عندما تكون وكالة الإرجاع. 0 = مجاني.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="label-saas">
                  {lang === 'fr' ? '➡️ Livraison aller (DA)' : '➡️ توصيل ذهاب (دج)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  name="deliveryPriceAller"
                  value={formData.deliveryPriceAller as any}
                  onChange={handleChange}
                  placeholder="0"
                  className="input-saas"
                />
              </div>
              <div className="space-y-2">
                <label className="label-saas">
                  {lang === 'fr' ? '⬅️ Livraison retour (DA)' : '⬅️ توصيل إياب (دج)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  name="deliveryPriceRetour"
                  value={formData.deliveryPriceRetour as any}
                  onChange={handleChange}
                  placeholder="0"
                  className="input-saas"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Actions */}
        <div className="p-6 border-t border-saas-border flex items-center gap-4 bg-saas-bg">
          <button 
            onClick={onClose} 
            className="flex-1 btn-saas-outline py-3"
          >
            {lang === 'fr' ? 'Annuler' : 'إلغاء'}
          </button>
          <button 
            onClick={handleSubmit}
            className="flex-1 btn-saas-primary py-3"
          >
            {lang === 'fr' ? 'Enregistrer' : 'حفظ'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
