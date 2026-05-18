import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Trash2, PenLine } from 'lucide-react';

interface Props {
  onSignature: (dataUrl: string) => void;
  value?: string;
}

export default function SignaturePad({ onSignature, value }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getCanvas = () => canvasRef.current;
  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  const getPoint = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const setupCanvas = useCallback(() => {
    const canvas = getCanvas();
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    setupCanvas();
    if (value) {
      const canvas = getCanvas();
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
        setIsEmpty(false);
      };
      img.src = value;
    }
  }, []);

  const startDraw = (x: number, y: number) => {
    const ctx = getCtx();
    if (!ctx) return;
    isDrawing.current = true;
    lastPoint.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (x: number, y: number) => {
    const ctx = getCtx();
    if (!isDrawing.current || !ctx || !lastPoint.current) return;
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPoint.current = { x, y };
    setIsEmpty(false);
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPoint.current = null;
    const canvas = getCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setHasSignature(true);
    onSignature(dataUrl);
  };

  // Mouse events
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = getCanvas();
    if (!canvas) return;
    e.preventDefault();
    const pt = getPoint(e.clientX, e.clientY, canvas);
    startDraw(pt.x, pt.y);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = getCanvas();
    if (!canvas) return;
    e.preventDefault();
    const pt = getPoint(e.clientX, e.clientY, canvas);
    draw(pt.x, pt.y);
  };

  const onMouseUp = () => endDraw();

  // Touch events
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = getCanvas();
    if (!canvas) return;
    e.preventDefault();
    const touch = e.touches[0];
    const pt = getPoint(touch.clientX, touch.clientY, canvas);
    startDraw(pt.x, pt.y);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = getCanvas();
    if (!canvas) return;
    e.preventDefault();
    const touch = e.touches[0];
    const pt = getPoint(touch.clientX, touch.clientY, canvas);
    draw(pt.x, pt.y);
  };

  const onTouchEnd = () => endDraw();

  const clear = () => {
    const canvas = getCanvas();
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setIsEmpty(true);
    onSignature('');
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-white touch-none"
        style={{ cursor: 'crosshair' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full block"
          style={{ touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <PenLine size={28} className="text-slate-200 mb-2" />
            <p className="text-slate-300 text-sm">Sign here</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Draw your signature above using your finger or mouse</p>
        {hasSignature && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
