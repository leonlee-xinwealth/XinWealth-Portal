// api/sign.js
// PDF e-signature requests: advisor uploads a PDF + signature box position,
// client signs via a one-time token link (/sign/:token), server stamps the
// signature onto the PDF with pdf-lib and stores it in the private
// 'signatures' storage bucket.
//
// Routing (single function to stay within the Vercel Hobby 12-function limit):
//   POST { action:'create', fileName, clientName?, pdfBase64, sig }  advisor auth
//   POST { action:'submit', token, signaturePng }                    public
//   POST { action:'cancel', id }                                     advisor auth
//   GET  ?token=                                                     public
//   GET  ?action=list                                                advisor auth
//   GET  ?action=download&id=                                        advisor auth
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';

const BUCKET = 'signatures';
const MAX_PDF_BYTES = 3 * 1024 * 1024;   // keeps base64 body under Vercel's 4.5MB limit
const MAX_SIG_BYTES = 1 * 1024 * 1024;
const MIN_SIG_BYTES = 200;               // reject empty/near-empty signature images
const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;

async function getAdvisor(req) {
  const { user, error } = await getAuthUser(req);
  if (error || !user) return { status: 401, error: `Unauthorized: ${error || 'Invalid token'}` };
  const { data: advisor, error: advErr } = await supabaseAdmin
    .from('advisors').select('id').eq('user_id', user.id).maybeSingle();
  if (advErr) return { status: 500, error: advErr.message };
  if (!advisor) return { status: 403, error: 'Not an advisor account' };
  return { advisor };
}

async function findValidRequest(token) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return { error: 404 };
  const { data: row } = await supabaseAdmin
    .from('signature_requests').select('*').eq('token', token).maybeSingle();
  if (!row) return { error: 404 };
  if (row.status !== 'pending') return { error: 410 };
  if (row.token_expires_at && new Date(row.token_expires_at) < new Date()) return { error: 410 };
  return { row };
}

const tokenError = (res, error) =>
  res.status(error).json({ error: error === 404 ? 'INVALID_TOKEN' : 'LINK_EXPIRED' });

function decodeBase64(input, expectedPrefix) {
  const str = String(input || '');
  let b64 = str;
  if (str.startsWith('data:')) {
    if (expectedPrefix && !str.startsWith(expectedPrefix)) return null;
    const comma = str.indexOf(',');
    if (comma === -1) return null;
    b64 = str.slice(comma + 1);
  }
  try {
    return Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
}

function validSigBox(sig) {
  if (!sig || typeof sig !== 'object') return false;
  const { page, x, y, w, h } = sig;
  if (!Number.isInteger(page) || page < 1) return false;
  const nums = [x, y, w, h];
  if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return false;
  if (x < 0 || y < 0 || w <= 0 || h <= 0) return false;
  if (x + w > 1.0001 || y + h > 1.0001) return false;
  return true;
}

// ---------- actions ----------

async function handleCreate(req, res) {
  const auth = await getAdvisor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { fileName, clientName, pdfBase64, sig } = req.body || {};
  if (!String(fileName || '').trim()) return res.status(400).json({ error: 'fileName required' });
  if (!validSigBox(sig)) return res.status(400).json({ error: 'INVALID_SIG_BOX' });

  const pdfBuf = decodeBase64(pdfBase64, 'data:application/pdf');
  if (!pdfBuf || pdfBuf.length === 0) return res.status(400).json({ error: 'INVALID_PDF' });
  if (pdfBuf.length > MAX_PDF_BYTES) return res.status(413).json({ error: 'PDF_TOO_LARGE' });
  if (pdfBuf.subarray(0, 5).toString('latin1').indexOf('%PDF') !== 0) {
    return res.status(400).json({ error: 'INVALID_PDF' });
  }

  let pageCount;
  try {
    const doc = await PDFDocument.load(pdfBuf, { ignoreEncryption: false });
    pageCount = doc.getPageCount();
  } catch {
    return res.status(400).json({ error: 'INVALID_PDF' });
  }
  if (sig.page > pageCount) return res.status(400).json({ error: 'PAGE_OUT_OF_RANGE' });

  const id = randomUUID();
  const originalPath = `original/${id}.pdf`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(originalPath, pdfBuf, { contentType: 'application/pdf' });
  if (upErr) return res.status(500).json({ error: `Upload failed: ${upErr.message}` });

  const token = randomUUID();
  const { error: insErr } = await supabaseAdmin.from('signature_requests').insert({
    id,
    advisor_id: auth.advisor.id,
    client_name: String(clientName || '').trim() || null,
    file_name: String(fileName).trim(),
    original_path: originalPath,
    token,
    token_expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    sig_page: sig.page,
    sig_x: sig.x,
    sig_y: sig.y,
    sig_w: sig.w,
    sig_h: sig.h,
  });
  if (insErr) {
    await supabaseAdmin.storage.from(BUCKET).remove([originalPath]).catch(() => {});
    return res.status(500).json({ error: `Failed to create request: ${insErr.message}` });
  }

  return res.status(200).json({ id, token });
}

async function handleGetByToken(req, res) {
  const { row, error } = await findValidRequest(req.query.token);
  if (error) return tokenError(res, error);

  const { data: signed, error: urlErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(row.original_path, 600);
  if (urlErr || !signed?.signedUrl) {
    return res.status(500).json({ error: 'Failed to prepare document' });
  }

  return res.status(200).json({
    fileName: row.file_name,
    clientName: row.client_name,
    sig: {
      page: row.sig_page,
      x: Number(row.sig_x),
      y: Number(row.sig_y),
      w: Number(row.sig_w),
      h: Number(row.sig_h),
    },
    pdfUrl: signed.signedUrl,
  });
}

async function handleSubmit(req, res) {
  const { token, signaturePng } = req.body || {};
  const { row, error } = await findValidRequest(token);
  if (error) return tokenError(res, error);

  if (!String(signaturePng || '').startsWith('data:image/png;base64,')) {
    return res.status(400).json({ error: 'INVALID_SIGNATURE' });
  }
  const sigBuf = decodeBase64(signaturePng, 'data:image/png');
  if (!sigBuf || sigBuf.length < MIN_SIG_BYTES) return res.status(400).json({ error: 'INVALID_SIGNATURE' });
  if (sigBuf.length > MAX_SIG_BYTES) return res.status(413).json({ error: 'SIGNATURE_TOO_LARGE' });

  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(row.original_path);
  if (dlErr || !blob) return res.status(500).json({ error: 'Failed to load document' });
  const originalBuf = Buffer.from(await blob.arrayBuffer());

  let signedBytes;
  try {
    const pdfDoc = await PDFDocument.load(originalBuf);
    const png = await pdfDoc.embedPng(sigBuf);
    const page = pdfDoc.getPage(row.sig_page - 1);
    const { width: pw, height: ph } = page.getSize();

    // Normalized top-left box -> PDF points (bottom-left origin),
    // contain-fit the signature's aspect ratio inside the box, centered.
    const boxX = Number(row.sig_x) * pw;
    const boxW = Number(row.sig_w) * pw;
    const boxH = Number(row.sig_h) * ph;
    const boxY = ph - Number(row.sig_y) * ph - boxH;
    const scale = Math.min(boxW / png.width, boxH / png.height);
    const w = png.width * scale;
    const h = png.height * scale;
    page.drawImage(png, {
      x: boxX + (boxW - w) / 2,
      y: boxY + (boxH - h) / 2,
      width: w,
      height: h,
    });
    signedBytes = await pdfDoc.save();
  } catch (e) {
    console.error('sign stamp error:', e);
    return res.status(500).json({ error: 'Failed to stamp signature' });
  }

  const signedPath = `signed/${row.id}.pdf`;
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(signedPath, Buffer.from(signedBytes), { contentType: 'application/pdf', upsert: true });
  if (upErr) return res.status(500).json({ error: `Failed to store signed document: ${upErr.message}` });

  // Single-use claim: only flips if still pending, so a concurrent double
  // submit loses the race and gets 410. Stamping happens before this so a
  // failure above leaves the row pending and the link retryable.
  const { data: claimed, error: clErr } = await supabaseAdmin
    .from('signature_requests')
    .update({ status: 'signed', signed_at: new Date().toISOString(), signed_path: signedPath })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id');
  if (clErr) return res.status(500).json({ error: clErr.message });
  if (!claimed || claimed.length === 0) return res.status(410).json({ error: 'LINK_EXPIRED' });

  return res.status(200).json({ success: true });
}

async function handleList(req, res) {
  const auth = await getAdvisor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { data, error } = await supabaseAdmin
    .from('signature_requests')
    .select('id, client_name, file_name, status, token, token_expires_at, created_at, signed_at')
    .eq('advisor_id', auth.advisor.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ requests: data || [] });
}

async function handleDownload(req, res) {
  const auth = await getAdvisor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const id = String(req.query.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: 'NOT_FOUND' });

  const { data: row } = await supabaseAdmin
    .from('signature_requests').select('*').eq('id', id).maybeSingle();
  if (!row || row.advisor_id !== auth.advisor.id) return res.status(404).json({ error: 'NOT_FOUND' });

  const path = row.signed_path || row.original_path;
  const downloadName = row.signed_path
    ? row.file_name.replace(/\.pdf$/i, '') + '-signed.pdf'
    : row.file_name;
  const { data: signed, error: urlErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, 300, { download: downloadName });
  if (urlErr || !signed?.signedUrl) return res.status(500).json({ error: 'Failed to create download link' });

  return res.status(200).json({ url: signed.signedUrl, signed: Boolean(row.signed_path) });
}

async function handleCancel(req, res) {
  const auth = await getAdvisor(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const id = String(req.body?.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: 'NOT_FOUND' });

  const { data: cancelled, error } = await supabaseAdmin
    .from('signature_requests')
    .update({ status: 'cancelled', token: null, token_expires_at: null })
    .eq('id', id)
    .eq('advisor_id', auth.advisor.id)
    .eq('status', 'pending')
    .select('id');
  if (error) return res.status(500).json({ error: error.message });
  if (!cancelled || cancelled.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });

  return res.status(200).json({ success: true });
}

// ---------- handler ----------

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabaseAdmin) return configError(res);

  try {
    if (req.method === 'GET') {
      const action = req.query.action;
      if (action === 'list') return await handleList(req, res);
      if (action === 'download') return await handleDownload(req, res);
      if (req.query.token) return await handleGetByToken(req, res);
      return res.status(400).json({ error: 'Missing token or action' });
    }

    if (req.method === 'POST') {
      const action = req.body?.action;
      if (action === 'create') return await handleCreate(req, res);
      if (action === 'submit') return await handleSubmit(req, res);
      if (action === 'cancel') return await handleCancel(req, res);
      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('sign API error:', e);
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
