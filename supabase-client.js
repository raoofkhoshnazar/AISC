(() => {
  const config = window.AISC_SUPABASE_CONFIG;
  const isConfigured = config && config.url !== 'YOUR_SUPABASE_URL' && config.anonKey !== 'YOUR_SUPABASE_ANON_KEY';

  window.aiscSupabaseConfigured = isConfigured;
  window.aiscSupabase = isConfigured ? window.supabase.createClient(config.url, config.anonKey) : null;
})();
