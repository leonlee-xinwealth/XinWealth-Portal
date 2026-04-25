import { supabase } from './_supabase.js';

// Serves files from Supabase Storage.
// Query params:
//   file_path  — path within the storage bucket (e.g. "policies/abc123.pdf")
//   url        — a direct public/signed URL to proxy (fallback)
//
// Set the SUPABASE_STORAGE_BUCKET env var to the bucket that holds policy documents.
// Default bucket name: "documents"

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { file_path, url } = req.query;

  if (!file_path && !url) return res.status(400).json({ error: 'file_path or url is required' });

  try {
    // If a direct URL is provided, proxy it
    if (url) {
      const fileRes = await fetch(url);
      if (!fileRes.ok) {
        return res.status(fileRes.status).json({ error: 'Failed to download file from URL' });
      }
      const contentType = fileRes.headers.get('content-type') || 'application/pdf';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="document.pdf"`);
      return res.send(Buffer.from(await fileRes.arrayBuffer()));
    }

    // Download from Supabase Storage
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documents';
    const { data, error } = await supabase.storage.from(bucket).download(file_path);

    if (error) {
      console.error('Supabase Storage download error:', error);
      return res.status(404).json({ error: `File not found: ${error.message}` });
    }

    const filename = file_path.split('/').pop() || 'document.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(Buffer.from(await data.arrayBuffer()));

  } catch (error) {
    console.error('Download API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
