/* =========================================================
   Lito Academy ✈ Azul — lógica da candidatura
   ========================================================= */

/* ---------------------------------------------------------
   BACKEND — ponto único de integração.
   Deixe ENDPOINT como "" enquanto não houver backend: o
   formulário valida e mostra a tela de sucesso (modo demo).
   Quando o backend estiver pronto, coloque a URL abaixo.
   A função recebe um objeto `dados` com os campos do form.
   --------------------------------------------------------- */
const ENDPOINT = ""; // TODO: URL do backend (ex.: "https://api.seudominio.com/indicacoes")

async function enviarCandidatura(formData) {
  if (!ENDPOINT) {
    // Modo demo — nada é enviado ainda.
    const resumo = {};
    for (const [k, v] of formData.entries()) {
      resumo[k] = v instanceof File ? `${v.name} (${Math.round(v.size / 1024)} KB)` : v;
    }
    console.info("[Lito x Azul] Backend não configurado. Dados capturados:", resumo);
    await new Promise((r) => setTimeout(r, 600)); // simula latência
    return { ok: true, simulado: true };
  }

  // Envio multipart (inclui o arquivo do currículo). Não defina Content-Type:
  // o navegador cria o boundary correto automaticamente.
  const res = await fetch(ENDPOINT, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Falha no envio (" + res.status + ")");
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
    cursos: (v) => (v.trim().length >= 3 ? "" : "Informe o(s) curso(s) que você fez na Lito."),
    vaga: (v) => (v.trim().length >= 2 ? "" : "Informe a vaga da Azul em que se inscreveu."),
  };
  const confirmacoes = [
    "cvAtualizado",
    "cvInformaLito",
    "leuVaga",
    "autorizaCompartilhar",
    "infoVerdadeiras",
  ];

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
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
      formError.textContent =
        "Não foi possível enviar agora. Verifique sua conexão e tente novamente.";
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
