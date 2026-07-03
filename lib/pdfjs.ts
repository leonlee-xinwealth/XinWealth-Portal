// Single place for pdf.js worker wiring. Import loadPdf/renderPageToCanvas
// from here instead of importing 'pdfjs-dist' directly, so the worker is
// always configured. pdfjs-dist is pinned to v3 (v4 needs ES2022
// top-level-await, which Vite 4's default build target rejects).
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite ?url import
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy, PDFPageProxy };

export async function loadPdf(src: string | ArrayBuffer): Promise<PDFDocumentProxy> {
  const params = typeof src === 'string' ? { url: src } : { data: src };
  return pdfjsLib.getDocument(params).promise;
}

/**
 * Renders a page into the given canvas scaled to fit containerWidth
 * (backing store scaled by devicePixelRatio for sharpness).
 * Returns the CSS size the canvas was given.
 */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  containerWidth: number
): Promise<{ cssWidth: number; cssHeight: number }> {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = containerWidth / baseViewport.width;
  const ratio = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * ratio });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const cssWidth = Math.floor(viewport.width / ratio);
  const cssHeight = Math.floor(viewport.height / ratio);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { cssWidth, cssHeight };
}
