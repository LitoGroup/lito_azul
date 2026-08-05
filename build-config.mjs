/* =========================================================
   Gera o supabase-config.js no DEPLOY a partir das variáveis
   de ambiente (Vercel → Settings → Environment Variables):

     SUPABASE_URL       ex.: https://seu-projeto.dominio.com
     SUPABASE_ANON_KEY  chave anon (publishable)

   Assim nenhuma credencial fica no repositório Git.
   ========================================================= */
import { writeFileSync } from "node:fs";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "ERRO: defina SUPABASE_URL e SUPABASE_ANON_KEY nas variáveis de ambiente do deploy."
  );
  process.exit(1);
}

// Chave colada mascarada (••••) ou com caracteres inválidos? Falha já no build.
if (!/^[A-Za-z0-9._-]+$/.test(anonKey)) {
  console.error(
    "ERRO: SUPABASE_ANON_KEY contém caracteres inválidos (ex.: '•' de campo mascarado).\n" +
    "Copie a chave REAL (começa com 'eyJ' e tem só letras, números, '.', '_' e '-')."
  );
  process.exit(1);
}

// Nunca aceite a chave privada aqui por engano.
try {
  const payload = JSON.parse(
    Buffer.from(anonKey.split(".")[1], "base64url").toString("utf8")
  );
  if (payload.role && payload.role !== "anon") {
    console.error(
      "ERRO: SUPABASE_ANON_KEY contém uma chave com role '" + payload.role +
      "'. Use APENAS a chave anon (publishable) — a service_role nunca pode ir para o site."
    );
    process.exit(1);
  }
} catch (_) { /* chave em formato não-JWT: segue */ }

const conteudo = `/* Gerado no deploy por build-config.mjs — não editar, não commitar. */
window.LAZ_CONFIG = {
  url:     ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)},
  tabela:  "candidaturasLAZ",
  bucket:  "curriculosLAZ",
};

window.sb = window.supabase.createClient(
  window.LAZ_CONFIG.url,
  window.LAZ_CONFIG.anonKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
`;

writeFileSync(new URL("./supabase-config.js", import.meta.url), conteudo);
console.log("supabase-config.js gerado com sucesso.");
