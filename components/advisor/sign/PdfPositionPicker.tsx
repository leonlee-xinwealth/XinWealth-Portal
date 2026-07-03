// Advisor-side signature placement: renders one PDF page at a time and lets
// the advisor click to place a signature box, drag to move it and resize via
// the bottom-right handle. Emits normalized 0-1 coordinates (top-left origin)
// so the server can stamp at any render size.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { loadPdf, renderPageToCanvas, type PDFDocumentProxy } from '../../../lib/pdfjs';
import { useLanguage } from '../../../context/LanguageContext';
import type { SigBox } from '../../../services/signatureService';

interface Props {
  file: ArrayBuffer;
  onConfirm: (sig: SigBox) => void;
  onBack: () => void;
  confirmLabel?: string;
  busy?: boolean;
}

interface Box { x: number; y: number; w: number; h: number; page: number }

const DEFAULT_W = 0.3;             // 30% of page width
const ASPECT = 3;                  // box width : height

export default function PdfPositionPicker({ file, onConfirm, onBack, confirmLabel, busy }: Props) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; box: Box } | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState<Box | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // pdf.js transfers the buffer to its worker, so hand it a copy.
    loadPdf(file.slice(0))
      .then((doc) => {
        if (cancelled) { doc.destroy(); return; }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPageNum(1);
      })
      .catch(() => setError(t('Could not read this PDF.', '无法读取这个 PDF。')));
    return () => { cancelled = true; docRef.current?.destroy(); docRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!doc || !canvas || !container || numPages === 0) return;
    let cancelled = false;
    doc.getPage(pageNum).then(async (page) => {
      if (cancelled) return;
      const { cssWidth, cssHeight } = await renderPageToCanvas(page, canvas, container.clientWidth);
      if (!cancelled) setCanvasSize({ w: cssWidth, h: cssHeight });
    });
    return () => { cancelled = true; };
  }, [pageNum, numPages]);

  const clampBox = (b: Box): Box => ({
    ...b,
    x: Math.min(Math.max(b.x, 0), 1 - b.w),
    y: Math.min(Math.max(b.y, 0), 1 - b.h),
  });

  function placeBox(e: React.PointerEvent) {
    if (!overlayRef.current || canvasSize.w === 0) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const w = DEFAULT_W;
    const h = (w * canvasSize.w) / ASPECT / canvasSize.h;
    setBox(clampBox({ x: px - w / 2, y: py - h / 2, w, h, page: pageNum }));
  }

  function startDrag(e: React.PointerEvent, mode: 'move' | 'resize') {
    if (!box) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, box };
  }

  function onDrag(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    if (drag.mode === 'move') {
      setBox(clampBox({ ...drag.box, x: drag.box.x + dx, y: drag.box.y + dy }));
    } else {
      const w = Math.min(Math.max(drag.box.w + dx, 0.08), 1 - drag.box.x);
      const h = Math.min(Math.max(drag.box.h + dy, 0.03), 1 - drag.box.y);
      setBox({ ...drag.box, w, h });
    }
  }

  function endDrag() { dragRef.current = null; }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-600">
        {error}
        <button onClick={onBack} className="block mt-2 text-xs font-semibold underline">{t('Back', '返回')}</button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">
        {t('Tap where the client should sign. Drag to move, use the corner handle to resize.',
           '点击客户需要签名的位置。拖动可移动，右下角手柄可调整大小。')}
      </p>

      <div ref={containerRef} className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
        <canvas ref={canvasRef} className="block" />
        <div
          ref={overlayRef}
          className="absolute top-0 left-0 cursor-crosshair touch-none"
          style={{ width: canvasSize.w, height: canvasSize.h }}
          onPointerDown={placeBox}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
        >
          {box && box.page === pageNum && (
            <div
              className="absolute border-2 border-xin-gold bg-xin-gold/10 cursor-move touch-none"
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
              }}
              onPointerDown={(e) => startDrag(e, 'move')}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
            >
              <span className="absolute -top-5 left-0 text-[10px] font-semibold text-xin-gold whitespace-nowrap">
                {t('Signature', '签名位置')}
              </span>
              <div
                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-xin-gold rounded-full cursor-nwse-resize touch-none"
                onPointerDown={(e) => startDrag(e, 'resize')}
                onPointerMove={onDrag}
                onPointerUp={endDrag}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-3">
        <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1}
          className="p-1.5 text-slate-500 disabled:text-slate-200 hover:text-xin-blue transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span className="text-xs text-slate-500">{t('Page', '第')} {pageNum} / {numPages} {language === 'zh' ? '页' : ''}</span>
        <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages}
          className="p-1.5 text-slate-500 disabled:text-slate-200 hover:text-xin-blue transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button onClick={onBack}
          className="px-4 py-2 text-sm font-semibold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
          {t('Back', '返回')}
        </button>
        <button
          onClick={() => box && onConfirm({ page: box.page, x: box.x, y: box.y, w: box.w, h: box.h })}
          disabled={!box || busy}
          className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-xin-blue rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-40">
          {busy ? t('Creating…', '创建中…') : (confirmLabel || t('Confirm position', '确认签名位置'))}
        </button>
      </div>
    </div>
  );
}
