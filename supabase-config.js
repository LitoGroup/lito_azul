/* Gerado no deploy por build-config.mjs — não editar, não commitar. */
window.LAZ_CONFIG = {
  url:     "https://forgottenperch-supabase.cloudfy.live",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcxOTQ0NjM1LCJleHAiOjE4MDM0ODA2MzV9.tMNCQmsGQLgCKKFlY8Px1IMslg0858FDa1VkvebyzKs",
  tabela:  "candidaturasLAZ",
  bucket:  "curriculosLAZ",
};

window.sb = window.supabase.createClient(
  window.LAZ_CONFIG.url,
  window.LAZ_CONFIG.anonKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
