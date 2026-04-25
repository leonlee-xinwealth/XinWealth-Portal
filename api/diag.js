export default function handler(req, res) {
  res.status(200).json({
    has_url: !!process.env.SUPABASE_URL,
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_vite_url: !!process.env.VITE_SUPABASE_URL,
    node_env: process.env.NODE_ENV,
    url_preview: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0, 10) + '...' : 'none'
  });
}
