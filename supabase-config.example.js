/* =========================================================
   MODELO de configuração — copie para "supabase-config.js"
   e preencha com os valores do seu projeto Supabase.
   O arquivo real (supabase-config.js) NÃO vai para o Git:
   está no .gitignore e é gerado no deploy (build-config.mjs)
   a partir das variáveis de ambiente da Vercel.
   ========================================================= */
window.LAZ_CONFIG = {
  url:     "https://SEU-PROJETO.exemplo.com",
  anonKey: "SUA_CHAVE_ANON_AQUI",
  tabela:  "candidaturasLAZ",
  bucket:  "curriculosLAZ",
};

window.sb = window.supabase.createClient(
  window.LAZ_CONFIG.url,
  window.LAZ_CONFIG.anonKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
