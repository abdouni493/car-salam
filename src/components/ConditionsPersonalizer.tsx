import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Printer, FileText, Globe } from 'lucide-react';
import { generateConditionsPrintHTML, getConditionsTemplate } from '../constants/ConditionsTemplates';

interface ConditionsPersonalizerProps {
  lang: 'fr' | 'ar';
  reservationId?: string;
  onClose: () => void;
  onSave?: (conditions: string) => void;
  agencyId?: string;
}

export const ConditionsPersonalizer: React.FC<ConditionsPersonalizerProps> = ({
  lang,
  reservationId,
  onClose,
  onSave,
  agencyId
}) => {
  const [conditionsLanguage, setConditionsLanguage] = useState<'ar' | 'fr'>('ar');
  const [isPrinting, setIsPrinting] = useState(false);
  const template = getConditionsTemplate(conditionsLanguage);
  const isArabic = conditionsLanguage === 'ar';
  const dir = isArabic ? 'rtl' : 'ltr';
  const textAlign = isArabic ? 'right' : 'left';

  const handlePrint = () => {
    setIsPrinting(true);
    const content = generateConditionsPrintHTML(conditionsLanguage);
    setTimeout(() => {
      const printWindow = window.open('', '', 'height=900,width=800');
      if (printWindow) {
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        setTimeout(() => setIsPrinting(false), 100);
      }
    }, 300);
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 24 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          style={{
            width: '100%',
            maxWidth: '1100px',
            maxHeight: '96vh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,30,100,0.35)',
            background: '#fff',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              background: 'linear-gradient(135deg, #003399 0%, #0047b2 100%)',
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: '10px',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <FileText size={22} color="#fff" />
              </div>
              <div>
                <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '20px', margin: 0 }}>
                  {isArabic ? 'شروط التأجير' : 'Conditions de Location'}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', margin: '3px 0 0' }}>
                  {template.subtitle}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Language selector */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  padding: '3px',
                  gap: '3px',
                }}
              >
                {(['fr', 'ar'] as const).map((lng) => (
                  <button
                    key={lng}
                    onClick={() => setConditionsLanguage(lng)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '13px',
                      transition: 'all 0.2s',
                      background: conditionsLanguage === lng ? '#fff' : 'transparent',
                      color: conditionsLanguage === lng ? '#003399' : 'rgba(255,255,255,0.85)',
                    }}
                  >
                    {lng === 'fr' ? '🇫🇷 FR' : '🇸🇦 AR'}
                  </button>
                ))}
              </div>

              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
              >
                <X size={20} color="#fff" />
              </button>
            </div>
          </div>

          {/* ── Document Preview Area ── */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              background: '#e8ecf4',
              padding: '28px 32px',
            }}
          >
            {/* A4 Document Card */}
            <div
              dir={dir}
              style={{
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0 4px 32px rgba(0,30,100,0.18)',
                maxWidth: '100%',
                margin: '0 auto',
                padding: '44px 56px',
                fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
                position: 'relative',
                border: '2px solid #003399',
              }}
            >
              {/* Document Title */}
              <div
                style={{
                  textAlign: 'center',
                  borderBottom: '3px solid #003399',
                  paddingBottom: '14px',
                  marginBottom: '22px',
                }}
              >
                <h1
                  style={{
                    color: '#003399',
                    fontSize: '24px',
                    fontWeight: 800,
                    margin: '0 0 8px',
                    letterSpacing: '0.3px',
                  }}
                >
                  {template.title}
                </h1>
                <p style={{ color: '#555', fontSize: '14px', margin: 0, fontStyle: 'italic' }}>
                  {template.subtitle}
                </p>
              </div>

              {/* Conditions List — two columns, mirrors the printed sheet */}
              <div style={{ columnCount: 2, columnGap: '30px' }}>
                {template.conditions.map((condition, index) => (
                  <section
                    key={index}
                    style={{
                      breakInside: 'avoid',
                      marginBottom: '14px',
                    }}
                  >
                    <h3
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        margin: '0 0 5px',
                        fontSize: '13.5px',
                        fontWeight: 800,
                        color: '#003399',
                        textAlign: textAlign as 'left' | 'right',
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: '19px',
                          height: '19px',
                          borderRadius: '5px',
                          background: 'linear-gradient(135deg, #003399 0%, #0047b2 100%)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {index + 1}
                      </span>
                      {condition.title}
                    </h3>
                    <ul style={{ listStyle: 'none', margin: 0, paddingInlineStart: '26px' }}>
                      {condition.bullets.map((bullet, bulletIndex) => (
                        <li
                          key={bulletIndex}
                          style={{
                            position: 'relative',
                            paddingInlineStart: '12px',
                            marginBottom: '3px',
                            fontSize: '12.5px',
                            color: '#111',
                            fontWeight: 600,
                            lineHeight: '1.55',
                            textAlign: textAlign as 'left' | 'right',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              insetInlineStart: 0,
                              top: '7px',
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: '#003399',
                            }}
                          />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>

              {/* Acceptance Statement */}
              <div
                style={{
                  marginTop: '8px',
                  padding: '10px 14px',
                  background: '#f0f4ff',
                  borderRadius: '6px',
                  border: '1px solid #b8ccee',
                  color: '#003399',
                  textAlign: textAlign as 'left' | 'right',
                }}
              >
                <p style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>
                  <span style={{ fontWeight: 800, marginInlineEnd: '6px' }}>✓</span>
                  {template.acceptance}
                </p>
                <p
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    fontStyle: 'italic',
                    margin: '5px 0 0',
                    opacity: 0.85,
                  }}
                >
                  {template.thanks}
                </p>
              </div>

              {/* Signatures — simple empty rectangles */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '32px',
                  marginTop: '28px',
                }}
              >
                {[
                  { label: template.agencySignatureLabel, icon: '🏢' },
                  { label: template.clientSignatureLabel, icon: '✍️' },
                ].map((sig, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        border: '2px solid #003399',
                        height: '64px',
                        marginBottom: '10px',
                        background: '#fff',
                        borderRadius: '4px',
                      }}
                    />
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#003399',
                        margin: 0,
                        letterSpacing: '0.2px',
                      }}
                    >
                      {sig.icon} {sig.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              padding: '14px 24px',
              background: '#f5f7ff',
              borderTop: '1px solid #dde3f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={15} color="#6b7acc" />
              <span style={{ fontSize: '12px', color: '#6b7acc' }}>
                {isArabic
                  ? 'نموذج قياسي محسّن للطباعة على صفحة A4 واحدة'
                  : 'Modèle standard optimisé pour impression A4 sur une seule page'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1.5px solid #ccd3e8',
                  background: '#fff',
                  color: '#444',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f2fa')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                {isArabic ? 'إغلاق' : 'Fermer'}
              </button>
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                style={{
                  padding: '8px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isPrinting
                    ? '#aab5d8'
                    : 'linear-gradient(135deg, #003399 0%, #0047b2 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: isPrinting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  transition: 'opacity 0.2s',
                  boxShadow: '0 4px 14px rgba(0,51,153,0.3)',
                }}
              >
                <Printer size={16} />
                {isPrinting
                  ? isArabic ? 'جاري الطباعة...' : 'Impression...'
                  : isArabic ? 'طباعة' : 'Imprimer'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};
