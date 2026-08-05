import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, ArrowRightLeft, Euro } from 'lucide-react';
import { Car, Language } from '../types';
import { DEFAULT_EUR_RATE, roundEur, formatMoney } from '../utils/currency';

interface ExchangeRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Véhicules dont les tarifs euros seront recalculés. */
  cars: Car[];
  /** Applique le taux (DA pour 1 €) à toute la flotte. Résout avec le nb de véhicules mis à jour. */
  onApply: (rate: number) => Promise<void>;
  lang: Language;
  /** Dernier taux utilisé, pour pré-remplir le champ. */
  initialRate?: number;
}

const t = (lang: Language, fr: string, ar: string) => (lang === 'fr' ? fr : ar);

export const ExchangeRateModal: React.FC<ExchangeRateModalProps> = ({
  isOpen, onClose, cars, onApply, lang, initialRate,
}) => {
  const [rateInput, setRateInput] = useState<string>('');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRateInput(String(initialRate ?? DEFAULT_EUR_RATE));
      setError(null);
      setIsApplying(false);
    }
  }, [isOpen, initialRate]);

  if (!isOpen) return null;

  const rate = Number(rateInput);
  const rateValid = Number.isFinite(rate) && rate > 0;

  // Aperçu : conversion du tarif/jour du premier véhicule tarifé.
  const sampleCar = cars.find(c => Number(c.priceDay) > 0);
  const samplePreview = rateValid && sampleCar
    ? { day: Number(sampleCar.priceDay), eur: roundEur(Number(sampleCar.priceDay) / rate) }
    : null;

  const handleApply = async () => {
    if (!rateValid) {
      setError(t(lang, 'Saisissez un taux valide (supérieur à 0).', 'أدخل سعرًا صالحًا (أكبر من 0).'));
      return;
    }
    setError(null);
    setIsApplying(true);
    try {
      await onApply(rate);
      onClose();
    } catch (err) {
      console.error('Erreur application du taux:', err);
      setError(t(lang, 'Échec de la mise à jour des tarifs. Réessayez.', 'فشل تحديث الأسعار. حاول مرة أخرى.'));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-saas-border"
      >
        <div className="p-7 border-b border-saas-border flex items-center justify-between bg-linear-to-r from-amber-500 via-amber-500 to-orange-500 text-white">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-white/20 rounded-xl"><ArrowRightLeft size={22} /></span>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter">
                {t(lang, 'Taux de change', 'سعر الصرف')}
              </h2>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                {t(lang, 'Dinar → Euro · toute la flotte', 'دينار ← يورو · كامل الأسطول')}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={isApplying} className="p-2.5 hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-7 space-y-6 bg-saas-bg">
          <p className="text-sm text-saas-text-muted leading-relaxed">
            {t(lang,
              'Indiquez la valeur de 1 € en dinars. Les tarifs euros (jour, semaine, mois) et la caution de tous les véhicules seront recalculés à partir de leurs tarifs en dinars.',
              'أدخل قيمة 1 يورو بالدينار. سيتم إعادة حساب أسعار اليورو (يوم، أسبوع، شهر) والضمان لجميع المركبات انطلاقًا من أسعارها بالدينار.')}
          </p>

          {/* Champ du taux */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-3">
            <label className="text-[11px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-2">
              <Euro size={14} /> {t(lang, 'Valeur de 1 euro', 'قيمة 1 يورو')}
            </label>
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-amber-700 whitespace-nowrap">1 € =</span>
              <input
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="input-saas flex-1 text-lg font-black"
                placeholder={String(DEFAULT_EUR_RATE)}
                autoFocus
              />
              <span className="text-lg font-black text-saas-text-main whitespace-nowrap">DA</span>
            </div>
          </div>

          {/* Aperçu de conversion */}
          {samplePreview && (
            <div className="rounded-2xl border border-saas-border bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-saas-text-muted mb-2">
                {t(lang, 'Aperçu', 'معاينة')} · {sampleCar?.brand} {sampleCar?.model}
              </p>
              <div className="flex items-center justify-center gap-3 text-lg font-black">
                <span className="text-saas-text-main">{formatMoney(samplePreview.day, 'DZD')}</span>
                <ArrowRightLeft size={18} className="text-amber-500" />
                <span className="text-amber-600">{formatMoney(samplePreview.eur, 'EUR')}</span>
                <span className="text-xs text-saas-text-muted font-bold">/ {t(lang, 'jour', 'يوم')}</span>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-saas-bg border border-saas-border p-4 text-center">
            <p className="text-sm text-saas-text-muted font-medium">
              {t(lang, 'Véhicules concernés', 'المركبات المعنية')} :{' '}
              <span className="font-black text-saas-text-main">{cars.length}</span>
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-300 text-red-800 px-4 py-3 rounded-2xl text-sm font-bold">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-saas-border flex items-center justify-end gap-3 bg-white">
          <button onClick={onClose} disabled={isApplying} className="btn-saas-outline px-7">
            {t(lang, 'Annuler', 'إلغاء')}
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying || !rateValid || cars.length === 0}
            className="btn-saas-primary px-8 flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t(lang, 'Application...', 'جارٍ التطبيق...')}
              </>
            ) : (
              t(lang, 'Appliquer à tous les véhicules', 'تطبيق على كل المركبات')
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ExchangeRateModal;
