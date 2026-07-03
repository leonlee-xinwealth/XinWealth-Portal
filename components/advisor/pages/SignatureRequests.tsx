// components/advisor/pages/SignatureRequests.tsx
// Advisor e-signature dashboard: create signature requests (upload PDF, mark
// where the client signs, get a one-time 7-day link) and track/download them.
import React, { useEffect, useRef, useState } from 'react';
import { Plus, FileSignature, Download, Link2, XCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import PdfPositionPicker from '../sign/PdfPositionPicker';
import {
  cancelSignatureRequest,
  createSignatureRequest,
  getDownloadUrl,
  listSignatureRequests,
  type SigBox,
  type SignatureRequestRow,
} from '../../../services/signatureService';

const MAX_PDF_BYTES = 3 * 1024 * 1024;

const STATUS_BADGES: Record<string, { en: string; zh: string; cls: string }> = {
  pending:   { en: 'Awaiting Signature', zh: '待签署', cls: 'bg-blue-50 text-blue-700' },
  signed:    { en: 'Signed',             zh: '已签署', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { en: 'Cancelled',          zh: '已取消', cls: 'bg-rose-50 text-rose-600' },
  expired:   { en: 'Expired',            zh: '已过期', cls: 'bg-slate-100 text-slate-500' },
};

type CreateStep = 'closed' | 'pick-file' | 'position' | 'done';

function displayStatus(row: SignatureRequestRow): string {
  if (row.status === 'pending' && row.token_expires_at && new Date(row.token_expires_at) < new Date()) {
    return 'expired';
  }
  return row.status;
}

export default function SignatureRequests() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  const [rows, setRows] = useState<SignatureRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  // create flow
  const [step, setStep] = useState<CreateStep>('closed');
  const [fileBuf, setFileBuf] = useState<ArrayBuffer | null>(null);
  const [fileBase64, setFileBase64] = useState('');
  const [fileName, setFileName] = useState('');
  const [clientName, setClientName] = useState('');
  const [fileError, setFileError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState('');
  const [copied, setCopied] = useState<'link' | 'wa' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setRows(await listSignatureRequests());
      setListError('');
    } catch (e: any) {
      setListError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    if (file.size > MAX_PDF_BYTES) {
      setFileError(t('File is too large (max 3MB).', '文件太大（最大 3MB）。'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const comma = dataUrl.indexOf(',');
      setFileBase64(dataUrl.slice(comma + 1));
      setFileName(file.name);
      file.arrayBuffer().then((buf) => {
        setFileBuf(buf);
        setStep('position');
      });
    };
    reader.readAsDataURL(file);
  }

  async function onConfirmPosition(sig: SigBox) {
    if (!fileBase64) return;
    setCreating(true);
    try {
      const { token } = await createSignatureRequest({
        fileName,
        clientName: clientName.trim() || undefined,
        pdfBase64: fileBase64,
        sig,
      });
      setCreatedLink(`${window.location.origin}/sign/${token}`);
      setStep('done');
      load();
    } catch (e: any) {
      setFileError(e.message || t('Failed to create request.', '创建失败。'));
      setStep('pick-file');
    } finally {
      setCreating(false);
    }
  }

  function resetCreate() {
    setStep('closed');
    setFileBuf(null);
    setFileBase64('');
    setFileName('');
    setClientName('');
    setFileError('');
    setCreatedLink('');
    setCopied(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function copyText(text: string, which: 'link' | 'wa') {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  async function onDownload(id: string) {
    try {
      const { url } = await getDownloadUrl(id);
      window.open(url, '_blank');
    } catch (e: any) {
      alert(e.message || 'Download failed');
    }
  }

  async function onCancel(row: SignatureRequestRow) {
    if (!window.confirm(t('Cancel this signature link? The client will no longer be able to sign.',
                          '取消这个签名链接？客户将无法再签署。'))) return;
    try {
      await cancelSignatureRequest(row.id);
      load();
    } catch (e: any) {
      alert(e.message || 'Cancel failed');
    }
  }

  const waTemplate = (link: string, name: string) => language === 'zh'
    ? `${name} 您好，请通过以下链接在文件上签名（7 天内有效，签署一次后失效）：${link}`
    : `Hi ${name}, please sign the document via this link (valid 7 days, single use): ${link}`;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('E-Signatures', '电子签名')}</h1>
        {step === 'closed' && (
          <button onClick={() => setStep('pick-file')}
            className="flex items-center gap-1.5 bg-xin-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blueLight transition-colors">
            <Plus size={15} /> {t('New Request', '新建签名请求')}
          </button>
        )}
      </div>

      {/* ---- Create flow ---- */}
      {step !== 'closed' && (
        <div className="mb-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          {step === 'pick-file' && (
            <div>
              <p className="text-sm font-semibold text-xin-blue mb-3">{t('1 · Choose a PDF', '1 · 选择 PDF 文件')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onFileChange}
                className="block w-full text-sm text-slate-500 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-xin-blue file:text-white file:text-sm file:font-semibold hover:file:bg-xin-blueLight file:cursor-pointer"
              />
              <label className="block mt-4 text-xs font-semibold text-slate-500">
                {t('Client name (optional, for your list)', '客户姓名（可选，仅用于列表显示）')}
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal"
                  placeholder={t('e.g. Tan Ah Kow', '如：陈亚九')}
                />
              </label>
              {fileError && <p className="mt-3 text-xs text-rose-600">{fileError}</p>}
              <button onClick={resetCreate}
                className="mt-4 px-4 py-2 text-sm font-semibold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                {t('Cancel', '取消')}
              </button>
            </div>
          )}

          {step === 'position' && fileBuf && (
            <div>
              <p className="text-sm font-semibold text-xin-blue mb-3">{t('2 · Mark the signature position', '2 · 标记签名位置')}</p>
              <PdfPositionPicker
                file={fileBuf}
                busy={creating}
                onBack={() => setStep('pick-file')}
                onConfirm={onConfirmPosition}
                confirmLabel={t('Create signing link', '生成签名链接')}
              />
            </div>
          )}

          {step === 'done' && (
            <div>
              <div className="flex items-center gap-2 text-emerald-600 mb-3">
                <CheckCircle2 size={18} />
                <p className="text-sm font-semibold">{t('Signing link created', '签名链接已生成')}</p>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                {t('Send this link to your client. It is valid for 7 days and becomes invalid once signed.',
                   '把链接发给客户。链接 7 天内有效，签署一次后即失效。')}
              </p>
              <div className="flex items-center gap-2 mb-3">
                <input readOnly value={createdLink}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono truncate" />
                <button onClick={() => copyText(createdLink, 'link')}
                  className="px-3 py-1.5 text-xs font-semibold bg-xin-blue text-white rounded-lg hover:bg-xin-blueLight transition-colors shrink-0">
                  {copied === 'link' ? t('Copied!', '已复制！') : t('Copy', '复制')}
                </button>
              </div>
              <button onClick={() => copyText(waTemplate(createdLink, clientName.trim()), 'wa')}
                className="w-full py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                {copied === 'wa' ? t('Copied!', '已复制！') : t('Copy WhatsApp message', '复制 WhatsApp 话术')}
              </button>
              <button onClick={resetCreate}
                className="mt-3 w-full py-2 text-sm font-semibold text-white bg-xin-blue rounded-xl hover:bg-xin-blueLight transition-colors">
                {t('Done', '完成')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---- List ---- */}
      {loading ? (
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue mx-auto mt-16" />
      ) : listError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-600">{listError}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
          <FileSignature size={32} className="mx-auto mb-3 text-slate-300" />
          {t('No signature requests yet. Upload a PDF to send your first signing link.',
             '还没有签名请求。上传 PDF 发出第一个签名链接。')}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {rows.map((row) => {
            const status = displayStatus(row);
            const b = STATUS_BADGES[status] ?? STATUS_BADGES.pending;
            const linkActive = status === 'pending' && row.token;
            return (
              <div key={row.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-xin-blue truncate">
                    {row.client_name || t('(No name)', '（未命名）')}
                    <span className="ml-2 font-normal text-slate-400">{row.file_name}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {row.status === 'signed' && row.signed_at
                      ? `${t('Signed', '签署于')} ${new Date(row.signed_at).toLocaleString(language === 'zh' ? 'zh-MY' : 'en-MY')}`
                      : `${t('Created', '创建于')} ${new Date(row.created_at).toLocaleString(language === 'zh' ? 'zh-MY' : 'en-MY')}`}
                  </p>
                </div>
                <span className={`${b.cls} text-xs font-semibold px-2.5 py-1 rounded-full shrink-0`}>
                  {language === 'zh' ? b.zh : b.en}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {linkActive && (
                    <>
                      <button
                        title={t('Copy link', '复制链接')}
                        onClick={() => copyText(`${window.location.origin}/sign/${row.token}`, 'link')}
                        className="p-2 text-slate-400 hover:text-xin-blue transition-colors">
                        <Link2 size={16} />
                      </button>
                      <button
                        title={t('Cancel link', '取消链接')}
                        onClick={() => onCancel(row)}
                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                  <button
                    title={row.status === 'signed' ? t('Download signed PDF', '下载已签署 PDF') : t('Download original PDF', '下载原始 PDF')}
                    onClick={() => onDownload(row.id)}
                    className={`p-2 transition-colors ${row.status === 'signed' ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-400 hover:text-xin-blue'}`}>
                    <Download size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
