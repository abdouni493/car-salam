import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PenTool } from 'lucide-react';
import { Language } from '../types';

interface SignaturePadProps {
  lang: Language;
  onSignatureChange: (signature: string) => void;
  /** Signature déjà enregistrée (édition d'une inspection existante). */
  initialSignature?: string;
  /** Hauteur du cadre de signature (classe Tailwind). */
  heightClass?: string;
  /** Couleur d'accent du cadre et des libellés. */
  accent?: 'indigo' | 'purple';
}

const ACCENTS = {
  indigo: { border: 'border-indigo-300', placeholder: 'text-indigo-400', label: 'text-indigo-700' },
  purple: { border: 'border-purple-300', placeholder: 'text-purple-400', label: 'text-purple-700' },
} as const;

/**
 * Pad de signature manuscrite.
 *
 * Fonctionne à la souris, au doigt et au stylet : on utilise les Pointer Events
 * (unifiés) plutôt que les seuls événements souris, ce qui rend le tracé possible
 * sur tablette. Les coordonnées sont calculées en fraction de la boîte affichée
 * puis projetées sur la résolution interne du canvas : le tracé reste donc juste
 * même quand le canvas est mis à l'échelle (animation d'ouverture d'une modale)
 * ou sur écran haute densité (Retina / tablettes).
 */
export const SignaturePad: React.FC<SignaturePadProps> = ({
  lang,
  onSignatureChange,
  initialSignature,
  heightClass = 'h-56 sm:h-64',
  accent = 'indigo',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  /** Dernier tracé émis, pour éviter de recharger notre propre signature en boucle. */
  const dataRef = useRef<string>('');
  const [hasSignature, setHasSignature] = useState(false);
  const colors = ACCENTS[accent];

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  const applyStyle = useCallback((ctx: CanvasRenderingContext2D, backingWidth: number, cssWidth: number) => {
    ctx.strokeStyle = '#111827';
    // Épaisseur exprimée en pixels d'affichage puis convertie en pixels internes.
    const scale = cssWidth > 0 ? backingWidth / cssWidth : 1;
    ctx.lineWidth = Math.max(1.5, 2.4 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const drawDataUrl = useCallback((url: string) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const img = new Image();
    // Une signature stockée en URL distante doit rester exportable (toDataURL) :
    // on demande le CORS. Inutile — mais sans effet — pour une data URL.
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = url;
  }, []);

  /** Adapte la résolution interne du canvas à sa taille CSS et restaure le tracé. */
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    applyStyle(ctx, canvas.width, rect.width);
    if (dataRef.current) drawDataUrl(dataRef.current);
  }, [applyStyle, drawDataUrl]);

  /** Coordonnées du pointeur dans le repère interne du canvas (invariant à l'échelle). */
  const posOf = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = getCtx();
    if (!ctx) return;
    e.preventDefault();
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* non supporté : ignoré */ }
    drawingRef.current = true;
    const { x, y } = posOf(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    e.preventDefault();
    const { x, y } = posOf(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
    const url = canvas.toDataURL('image/png');
    dataRef.current = url;
    onSignatureChange(url);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dataRef.current = '';
    setHasSignature(false);
    onSignatureChange('');
  };

  // Dimensionne le canvas au montage et le réajuste (rotation tablette, resize).
  useEffect(() => {
    fitCanvas();
    // Certaines modales s'ouvrent avec une animation : on refait un passage une fois posées.
    const raf = requestAnimationFrame(fitCanvas);
    const onResize = () => fitCanvas();
    window.addEventListener('resize', onResize);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvasRef.current) {
      observer = new ResizeObserver(() => fitCanvas());
      observer.observe(canvasRef.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charge une signature initiale (et ignore le retour de notre propre tracé).
  useEffect(() => {
    if (initialSignature && initialSignature !== dataRef.current) {
      dataRef.current = initialSignature;
      setHasSignature(true);
      drawDataUrl(initialSignature);
    }
  }, [initialSignature, drawDataUrl]);

  return (
    <div className="space-y-2 w-full">
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          className={`w-full ${heightClass} border ${colors.border} rounded-lg cursor-crosshair bg-white`}
          style={{ touchAction: 'none', userSelect: 'none' }}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`text-center ${colors.placeholder}`}>
              <PenTool className="w-6 h-6 mx-auto mb-1" />
              <p className="text-xs font-bold">
                {lang === 'fr' ? 'Signez ici' : 'وقع هنا'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <p className={`text-xs font-bold ${colors.label}`}>
          {lang === 'fr' ? 'Signature numérique' : 'التوقيع الرقمي'}
        </p>
        <button
          type="button"
          onClick={clearSignature}
          className="text-red-600 hover:text-red-800 font-bold text-xs underline"
        >
          {lang === 'fr' ? 'Effacer' : 'مسح'}
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
