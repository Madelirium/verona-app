// Only public browser configuration belongs in the generated HTML.
export function authConfig(env = process.env) {
  const url = (env.SUPABASE_URL || '').trim();
  const key = (env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Configurare SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY insieme.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) {
    throw new Error('SUPABASE_URL deve essere un’origine HTTPS.');
  }
  // Refuse secret/service_role keys rather than accidentally publishing them.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('Usare esclusivamente la chiave pubblica sb_publishable_, mai una chiave segreta.');
  if (env.SUPABASE_AUTH_METHOD === 'google') return { provider: 'supabase', url: parsed.origin, key, method: 'google', enabled: env.SUPABASE_AUTH_ENABLED === 'true' };
  if (env.SUPABASE_AUTH_ENABLED === 'false') return null;
  return { provider: 'supabase', url: parsed.origin, key };
}
