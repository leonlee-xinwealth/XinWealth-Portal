// Thin wrapper around signature_pad with devicePixelRatio-correct sizing.
// Exposes clear/isEmpty/toDataURL through a ref.
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import SignaturePad from 'signature_pad';

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

interface Props {
  heightPx?: number;
}

const SignaturePadCanvas = forwardRef<SignaturePadHandle, Props>(({ heightPx = 200 }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const width = canvas.parentElement?.clientWidth || 300;
      canvas.width = width * ratio;
      canvas.height = heightPx * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${heightPx}px`;
      canvas.getContext('2d')?.scale(ratio, ratio);
      padRef.current?.clear(); // resizing invalidates the drawing
    };

    padRef.current = new SignaturePad(canvas, {
      backgroundColor: 'rgba(0,0,0,0)', // transparent so only ink is stamped
      penColor: '#1a2b4a',
    });
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      padRef.current?.off();
      padRef.current = null;
    };
  }, [heightPx]);

  useImperativeHandle(ref, () => ({
    clear: () => padRef.current?.clear(),
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    toDataURL: () => padRef.current?.toDataURL('image/png') ?? '',
  }));

  return <canvas ref={canvasRef} className="block touch-none rounded-xl border border-slate-200 bg-slate-50" />;
});

SignaturePadCanvas.displayName = 'SignaturePadCanvas';
export default SignaturePadCanvas;
