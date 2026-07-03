// components/sign/SignPublicPage.tsx
// Public client-facing signing page, accessed via a one-time token link
// (/sign/:token). Mirrors PrsPublicPage's structure: bilingual header,
// invalid/expired/success cards, sticky bottom action.
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, PenLine } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { loadPdf, renderPageToCanvas, type PDFDocumentProxy, type PDFPageProxy } from '../../lib/pdfjs';
import SignaturePadCanvas, { type SignaturePadHandle } from './SignaturePadCanvas';
import { fetchSignRequest, submitSignature, type SignRequestPublic } from '../../services/signatureService';

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'invalid' | 'expired' | 'error';

function PdfPage({ page, width }: { page: PDFPageProxy; width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && width > 0) {
      renderPageToCanvas(page, canvasRef.current, width);
    }
  }, [page, width]);
  return <canvas ref={canvasRef} className="block" />;
}

export default function SignPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { language, setLanguage } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  const [state, setState] = useState<PageState>('loading');
  const [request, setRequest] = useState<SignRequestPublic | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [pageWidth, setPageWidth] = useState(0);
  const [signature, setSignature] = useState('');   // PNG data URL after client confirms
  const [padOpen, setPadOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const mainRef = useRef<HTMLDivElement>(null);
  const sigBoxRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<SignaturePadHandle>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const req = await fetchSignRequest(token || '');
        if (cancelled) return;
        const pdfRes = await fetch(req.pdfUrl);
        if (!pdfRes.ok) throw new Error('PDF_FETCH_FAILED');
        const buf = await pdfRes.arrayBuffer();
        const doc = await loadPdf(buf);
        if (cancelled) { doc.destroy(); return; }
        docRef.current = doc;
        const loaded: PDFPageProxy[] = [];
        for (let i = 1; i <= doc.numPages; i++) loaded.push(await doc.getPage(i));
        if (cancelled) return;
        setRequest(req);
        setPages(loaded);
        setState('ready');
      } catch (e: any) {
        if (cancelled) return;
        if (e?.status === 410) setState('expired');
        else if (e?.status === 404) setState('invalid');
        else setState('error');
      }
    })();
    return () => { cancelled = true; docRef.current?.destroy(); docRef.current = null; };
  }, [token]);

  // Measure available width once the document area is on screen.
  useEffect(() => {
    if (state !== 'ready') return;
    const measure = () => setPageWidth(mainRef.current?.clientWidth || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [state]);

  function scrollToSignature() {
    sigBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function confirmSignature() {
    if (!padRef.current || padRef.current.isEmpty()) return;
    setSignature(padRef.current.toDataURL());
    setPadOpen(false);
    setTimeout(scrollToSignature, 100);
  }

  async function submit() {
    if (!signature) return;
    setState('submitting');
    setSubmitError('');
    try {
      await submitSignature(token || '', signature);
      setState('success');
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      if (e?.status === 410) { setState('expired'); return; }
      setSubmitError(e.message || t('Submission failed, please try again.', '提交失败，请重试。'));
      setState('ready');
    }
  }

  // ── Header (logo + language toggle) ────────────────────────────────────────
  const Header = (
    <header className="bg-white shadow-sm border-b border-gray-100 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-xin-blue to-xin-blueLight rounded-xl flex items-center justify-center shadow-sm border border-xin-blueLight/30">
          <span className="text-xin-gold font-bold font-serif text-lg tracking-wider">X</span>
        </div>
        <span className="font-serif font-bold text-xin-blue leading-none text-xl tracking-tight">
          Xin<span className="text-xin-gold">Wealth</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-400 hidden sm:block">
          {t('Document Signing', '文件签署')}
        </span>
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button onClick={() => setLanguage('en')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${language === 'en' ? 'bg-white text-xin-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            EN
          </button>
          <button onClick={() => setLanguage('zh')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${language === 'zh' ? 'bg-white text-xin-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            中文
          </button>
        </div>
      </div>
    </header>
  );

  const StatusCard = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
    <div className="min-h-screen bg-[#f4f7f9] flex flex-col">
      {Header}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          {icon}
          <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-sm text-gray-500">{body}</p>
        </div>
      </div>
    </div>
  );

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#f4f7f9] flex flex-col">
        {Header}
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-xin-blue animate-spin" />
        </div>
      </div>
    );
  }

  if (state === 'invalid' || state === 'error') {
    return <StatusCard
      icon={<AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />}
      title={t('Invalid Link', '无效链接')}
      body={t('This link is not valid. Please contact your advisor for a new link.',
              '此链接无效，请联系您的理财顾问以获取新的链接。')} />;
  }

  if (state === 'expired') {
    return <StatusCard
      icon={<AlertCircle className="w-14 h-14 text-amber-500 mx-auto mb-4" />}
      title={t('Link Expired', '链接已失效')}
      body={t('This link has expired or was already used. Please contact your advisor for a new link.',
              '此链接已过期或已被使用，请联系您的理财顾问以获取新的链接。')} />;
  }

  if (state === 'success') {
    return <StatusCard
      icon={<CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />}
      title={t('Signed!', '签署完成！')}
      body={t('Thank you. The signed document has been sent to your advisor.',
              '感谢您的签署，已签署的文件已送达您的理财顾问。')} />;
  }

  const isSubmitting = state === 'submitting';
  const sig = request!.sig;

  return (
    <div className="min-h-screen bg-[#f4f7f9] font-sans selection:bg-xin-gold selection:text-white pb-28">
      {Header}

      <main className="max-w-3xl mx-auto pt-6 px-4 md:px-6">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-sm text-blue-700 flex items-center gap-3">
          <span className="flex-1">
            {t('Please review the document and sign in the marked area.',
               '请阅读文件，并在标记的位置签名。')}
          </span>
          <button onClick={scrollToSignature} className="text-xs font-bold underline shrink-0">
            {t('Go to signature', '跳到签名处')}
          </button>
        </div>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <p className="text-xs text-slate-400 mb-2 truncate">{request!.fileName}</p>

        <div ref={mainRef} className="space-y-3">
          {pages.map((page, idx) => (
            <div key={idx} className="relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {pageWidth > 0 && <PdfPage page={page} width={pageWidth - 2} />}
              {idx + 1 === sig.page && (
                <div
                  ref={sigBoxRef}
                  className={`absolute border-2 border-dashed border-xin-gold rounded ${signature ? 'bg-white/60' : 'bg-xin-gold/10'}`}
                  style={{
                    left: `${sig.x * 100}%`,
                    top: `${sig.y * 100}%`,
                    width: `${sig.w * 100}%`,
                    height: `${sig.h * 100}%`,
                  }}
                >
                  {signature ? (
                    <img src={signature} alt="signature" className="w-full h-full object-contain" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-bold text-xin-gold whitespace-nowrap">
                      {t('Sign here', '在此签名')}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {signature && (
            <button
              onClick={() => setPadOpen(true)}
              disabled={isSubmitting}
              className="px-4 py-3.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-colors disabled:opacity-60 shrink-0">
              {t('Redo', '重签')}
            </button>
          )}
          <button
            onClick={() => (signature ? submit() : setPadOpen(true))}
            disabled={isSubmitting}
            className="flex-1 py-3.5 rounded-xl bg-xin-blue text-white font-bold text-base tracking-wide hover:bg-xin-blueLight transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isSubmitting
              ? (<><Loader2 className="w-4 h-4 animate-spin" /> {t('Submitting…', '提交中…')}</>)
              : signature
                ? t('Submit Signature', '提交签名')
                : (<><PenLine className="w-4 h-4" /> {t('Sign', '签名')}</>)}
          </button>
        </div>
      </div>

      {/* Signature pad bottom sheet */}
      {padOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center"
          onClick={() => setPadOpen(false)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5"
            onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-xin-blue mb-1">{t('Draw your signature', '请手写您的签名')}</p>
            <p className="text-xs text-slate-400 mb-3">{t('Use your finger or stylus in the box below.', '在下方框内用手指或触控笔签名。')}</p>
            <SignaturePadCanvas ref={padRef} heightPx={200} />
            <div className="flex items-center gap-2 mt-4">
              <button onClick={() => padRef.current?.clear()}
                className="px-4 py-2.5 text-sm font-semibold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                {t('Clear', '清除')}
              </button>
              <button onClick={confirmSignature}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-xin-blue rounded-xl hover:bg-xin-blueLight transition-colors">
                {t('Use this signature', '使用此签名')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
