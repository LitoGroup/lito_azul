/* =========================================================
   Lito Academy ✈ Azul — lógica da candidatura
   ========================================================= */

/* ---------------------------------------------------------
   BACKEND — Supabase (ponto único de integração).
   O envio faz duas coisas:
     1. sobe o currículo para o Storage (bucket privado);
     2. grava a candidatura na tabela (via chave anon + RLS).
   Se o Supabase não estiver carregado (ex.: abrir o arquivo
   sem os scripts), cai em modo demo: valida e mostra a tela
   de sucesso sem enviar nada.
   --------------------------------------------------------- */
async function enviarCandidatura(formData) {
  const sb = window.sb;
  const cfg = window.LAZ_CONFIG || {};

  // Sem Supabase → modo demo.
  if (!sb) {
    const resumo = {};
    for (const [k, v] of formData.entries()) {
      resumo[k] = v instanceof File ? `${v.name} (${Math.round(v.size / 1024)} KB)` : v;
    }
    console.info("[Lito x Azul] Supabase não configurado. Dados capturados:", resumo);
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true, simulado: true };
  }

  // 1) Upload do currículo para o Storage (bucket privado).
  const file = formData.get("curriculo");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const base =
    file.name
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[^\x00-\x7F]+/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "curriculo";
  const pasta =
    (crypto.randomUUID && crypto.randomUUID()) ||
    Date.now() + "-" + Math.random().toString(16).slice(2);
  const path = `${pasta}/${base}.${ext}`;

  const up = await sb.storage.from(cfg.bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (up.error) throw new Error("Falha ao enviar o currículo: " + up.error.message);

  // 1b) Upload da foto (opcional) — mesmo bucket, subpasta do envio.
  let fotoPath = null;
  const foto = formData.get("foto");
  if (foto && foto instanceof File && foto.size > 0) {
    const fext = (foto.name.split(".").pop() || "jpg").toLowerCase();
    const fup = await sb.storage.from(cfg.bucket).upload(`${pasta}/foto.${fext}`, foto, {
      cacheControl: "3600",
      upsert: false,
      contentType: foto.type || undefined,
    });
    // Foto é opcional: se falhar, segue sem ela (não trava a candidatura).
    if (!fup.error) fotoPath = fup.data.path;
  }

  // 2) Grava a candidatura na tabela.
  const registro = {
    nome: (formData.get("nome") || "").trim(),
    cpf: formData.get("cpf") || "",
    email: (formData.get("email") || "").trim(),
    cursos: formData.getAll("cursos").join(", "),
    vaga: (formData.get("vaga") || "").trim(),
    curriculo_path: up.data.path,
    curriculo_nome: file.name,
    foto_path: fotoPath,
    disponibilidade_mudanca: formData.get("mudancaEstado") || "",
    cv_atualizado: formData.get("cvAtualizado") || "",
    cv_informa_lito: formData.get("cvInformaLito") || "",
    leu_vaga: formData.get("leuVaga") || "",
    autoriza_compartilhar: formData.get("autorizaCompartilhar") || "",
    info_verdadeiras: formData.get("infoVerdadeiras") || "",
    enviado_em: formData.get("enviadoEm") || new Date().toISOString(),
  };

  const ins = await sb.from(cfg.tabela).insert(registro);
  if (ins.error) {
    // Remove o arquivo órfão se a gravação falhar.
    try {
      await sb.storage.from(cfg.bucket).remove([up.data.path]);
    } catch (_) {}
    throw new Error("Falha ao registrar a candidatura: " + ins.error.message);
  }

  return { ok: true };
}

/* ---------------------------------------------------------
   Validação do arquivo de currículo
   --------------------------------------------------------- */
const CURRICULO_MAX_MB = 8;
function validarCurriculo(file) {
  if (!file) return "Anexe seu currículo.";
  if (!/\.(pdf|docx?)$/i.test(file.name)) return "Envie um arquivo PDF, DOC ou DOCX.";
  if (file.size > CURRICULO_MAX_MB * 1024 * 1024)
    return "Arquivo muito grande (máx. " + CURRICULO_MAX_MB + " MB).";
  return "";
}

function formatarTamanho(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/* ---------------------------------------------------------
   Validação de CPF (dígitos verificadores)
   --------------------------------------------------------- */
function cpfValido(valor) {
  const cpf = String(valor).replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
  let d1 = 11 - (soma % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
  let d2 = 11 - (soma % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

function mascaraCPF(v) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

/* ---------------------------------------------------------
   DOM
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("candidaturaForm");
  const cpfInput = document.getElementById("cpf");
  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("submitBtn");

  // Máscara de CPF
  cpfInput.addEventListener("input", (e) => {
    e.target.value = mascaraCPF(e.target.value);
  });

  // Upload de currículo
  const fileInput = document.getElementById("curriculo");
  const dropzone = fileInput.closest(".dropzone");
  const dzText = document.getElementById("dropzoneText");
  const dzPadrao = dzText.innerHTML;

  function resetDropzone() {
    dropzone.classList.remove("has-file");
    dzText.innerHTML = dzPadrao;
  }

  fileInput.addEventListener("change", () => {
    limparErro("curriculo");
    const f = fileInput.files[0];
    if (!f) return resetDropzone();
    const erro = validarCurriculo(f);
    if (erro) {
      mostrarErro("curriculo", erro);
      fileInput.value = "";
      return resetDropzone();
    }
    dropzone.classList.add("has-file");
    dzText.textContent = f.name + " · " + formatarTamanho(f.size);
  });

  ["dragover", "dragenter"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-drag");
    })
  );
  ["dragleave", "dragend"].forEach((ev) =>
    dropzone.addEventListener(ev, () => dropzone.classList.remove("is-drag"))
  );
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-drag");
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event("change"));
    }
  });

  // Foto (opcional): valida, mostra preview circular, permite remover
  const FOTO_MAX_MB = 4;
  const fotoInput = document.getElementById("foto");
  const fotoWrap = fotoInput.closest(".fotoup");
  const fotoPreview = document.getElementById("fotoPreview");
  const fotoPh = document.getElementById("fotoPh");
  const fotoRemove = document.getElementById("fotoRemove");

  function resetFoto() {
    fotoInput.value = "";
    fotoPreview.hidden = true;
    fotoPreview.removeAttribute("src");
    fotoPh.hidden = false;
    fotoRemove.hidden = true;
    fotoWrap.classList.remove("has-foto");
  }

  fotoInput.addEventListener("change", () => {
    limparErro("foto");
    const f = fotoInput.files[0];
    if (!f) return resetFoto();
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) {
      mostrarErro("foto", "Envie uma imagem JPG, PNG ou WEBP.");
      return resetFoto();
    }
    if (f.size > FOTO_MAX_MB * 1024 * 1024) {
      mostrarErro("foto", "Foto muito grande (máx. " + FOTO_MAX_MB + " MB).");
      return resetFoto();
    }
    const reader = new FileReader();
    reader.onload = () => {
      fotoPreview.src = reader.result;
      fotoPreview.hidden = false;
      fotoPh.hidden = true;
      fotoRemove.hidden = false;
      fotoWrap.classList.add("has-foto");
    };
    reader.readAsDataURL(f);
  });

  fotoRemove.addEventListener("click", () => {
    limparErro("foto");
    resetFoto();
  });

  // Limpa o erro do campo ao editar/selecionar
  form.addEventListener("input", (e) => {
    const name = e.target.name;
    if (name) limparErro(name);
  });

  // Regras de validação por campo
  const regras = {
    nome: (v) => (v.trim().length >= 3 ? "" : "Informe seu nome completo."),
    cpf: (v) => (cpfValido(v) ? "" : "Informe um CPF válido."),
    email: (v) => (emailValido(v) ? "" : "Informe um e-mail válido."),
    vaga: (v) => (v.trim().length >= 2 ? "" : "Informe a vaga da Azul em que se inscreveu."),
  };
  const confirmacoes = [
    "mudancaEstado",
    "cvAtualizado",
    "cvInformaLito",
    "leuVaga",
    "autorizaCompartilhar",
    "infoVerdadeiras",
  ];

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Honeypot: bots preenchem o campo invisível. Finge sucesso
    // (sem enviar nada) para o bot não aprender.
    const hp = form.elements.website;
    if (hp && hp.value.trim() !== "") {
      mostrarSucesso(form.elements.nome.value || "Candidato");
      return;
    }

    formError.hidden = true;
    let primeiroInvalido = null;

    // Campos de texto
    for (const [name, valida] of Object.entries(regras)) {
      const campo = form.elements[name];
      const msg = valida(campo.value || "");
      if (msg) {
        mostrarErro(name, msg);
        primeiroInvalido = primeiroInvalido || campo;
      }
    }

    // Cursos (caixas de seleção — pelo menos um)
    if (!form.querySelector('input[name="cursos"]:checked')) {
      mostrarErro("cursos", "Marque pelo menos um curso.");
      primeiroInvalido = primeiroInvalido || form.querySelector('input[name="cursos"]');
    }

    // Currículo (arquivo)
    const curriculoErro = validarCurriculo(fileInput.files[0]);
    if (curriculoErro) {
      mostrarErro("curriculo", curriculoErro);
      primeiroInvalido = primeiroInvalido || fileInput;
    }

    // Confirmações (radios)
    for (const name of confirmacoes) {
      const escolhido = form.querySelector(`input[name="${name}"]:checked`);
      if (!escolhido) {
        mostrarErro(name, "Selecione uma opção.");
        primeiroInvalido = primeiroInvalido || form.querySelector(`input[name="${name}"]`);
      }
    }

    if (primeiroInvalido) {
      formError.textContent = "Revise os campos destacados antes de enviar.";
      formError.hidden = false;
      primeiroInvalido.focus();
      primeiroInvalido.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Monta o envio (multipart — inclui o arquivo do currículo)
    const nome = form.elements.nome.value.trim();
    const formData = new FormData(form);
    formData.append("enviadoEm", new Date().toISOString());

    // Envio
    submitBtn.disabled = true;
    const textoOriginal = submitBtn.innerHTML;
    submitBtn.textContent = "Enviando...";

    try {
      await enviarCandidatura(formData);
      mostrarSucesso(nome);
    } catch (err) {
      console.error(err);
      // Mensagens de limite (rate limit) vêm do banco em português —
      // mostra a mensagem real; outros erros ficam genéricos.
      const msg = String((err && err.message) || "");
      const ehLimite = /limite|muitos envios|muitos arquivos|cpf hoje|aguarde/i.test(msg);
      formError.textContent = ehLimite
        ? msg.replace(/^.*?:\s*/, "")
        : "Não foi possível enviar agora. Verifique sua conexão e tente novamente.";
      formError.hidden = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = textoOriginal;
    }
  });

  /* ---- helpers de erro ---- */
  function mostrarErro(name, msg) {
    const el = form.querySelector(`[data-err-for="${name}"]`);
    if (el) el.textContent = msg;
  }
  function limparErro(name) {
    const el = form.querySelector(`[data-err-for="${name}"]`);
    if (el) el.textContent = "";
  }
});

/* ---------------------------------------------------------
   Sucesso — emite o "stub" do cartão de embarque
   --------------------------------------------------------- */
function mostrarSucesso(nome) {
  const form = document.getElementById("candidaturaForm");
  const card = document.getElementById("successCard");

  document.getElementById("successName").textContent = primeiroNome(nome);
  document.getElementById("successCode").textContent = gerarLocalizador();

  form.hidden = true;
  card.hidden = false;
  card.setAttribute("tabindex", "-1");
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.focus({ preventScroll: true });
}

function primeiroNome(nome) {
  const p = nome.trim().split(/\s+/)[0] || "candidato(a)";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function gerarLocalizador() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/* ---------------------------------------------------------
   Revelação no scroll
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Apenas elementos decorativos entram na animação. O formulário e os
  // títulos NUNCA dependem de JS para ficarem visíveis.
  const alvos = document.querySelectorAll(".step, .aviso__card");
  alvos.forEach((el) => el.classList.add("reveal"));

  if (!("IntersectionObserver" in window)) {
    alvos.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  alvos.forEach((el) => io.observe(el));
});
