/* =========================================================
   Painel de indicações — Lito Academy x Azul
   Lê a tabela candidaturasLAZ (somente autenticado) e mostra
   cada candidatura como um card. Permite filtrar, buscar,
   mudar o status e baixar o currículo (link assinado).
   ========================================================= */
(function () {
  const sb = window.sb;
  const cfg = window.LAZ_CONFIG || {};

  const els = {
    login: document.getElementById("loginView"),
    loginForm: document.getElementById("loginForm"),
    email: document.getElementById("loginEmail"),
    senha: document.getElementById("loginSenha"),
    loginErr: document.getElementById("loginErr"),
    loginBtn: document.getElementById("loginBtn"),
    app: document.getElementById("appView"),
    userEmail: document.getElementById("userEmail"),
    logoutBtn: document.getElementById("logoutBtn"),
    board: document.getElementById("board"),
    filters: document.getElementById("filters"),
    search: document.getElementById("search"),
    refreshBtn: document.getElementById("refreshBtn"),
    loading: document.getElementById("loadingState"),
    empty: document.getElementById("emptyState"),
    viewTabs: document.querySelectorAll(".view-tab"),
    viewCand: document.getElementById("viewCandidaturas"),
    viewVagas: document.getElementById("viewVagas"),
    novaVagaBtn: document.getElementById("novaVagaBtn"),
    vagaForm: document.getElementById("vagaForm"),
    vagaTitulo: document.getElementById("vagaTitulo"),
    vagaLocal: document.getElementById("vagaLocal"),
    vagaLink: document.getElementById("vagaLink"),
    vagaDesc: document.getElementById("vagaDesc"),
    vagaErr: document.getElementById("vagaErr"),
    vagaSalvarBtn: document.getElementById("vagaSalvarBtn"),
    vagaCancelarBtn: document.getElementById("vagaCancelarBtn"),
    vagasList: document.getElementById("vagasList"),
    vagasLoading: document.getElementById("vagasLoading"),
    vagasEmpty: document.getElementById("vagasEmpty"),
    tabEquipe: document.getElementById("tabEquipe"),
    viewEquipe: document.getElementById("viewEquipe"),
    equipeForm: document.getElementById("equipeForm"),
    membroEmail: document.getElementById("membroEmail"),
    membroPapel: document.getElementById("membroPapel"),
    membroAddBtn: document.getElementById("membroAddBtn"),
    equipeErr: document.getElementById("equipeErr"),
    equipeLoading: document.getElementById("equipeLoading"),
    equipeList: document.getElementById("equipeList"),
    userRole: document.getElementById("userRole"),
    totpView: document.getElementById("totpView"),
    totpForm: document.getElementById("totpForm"),
    totpCode: document.getElementById("totpCode"),
    totpErr: document.getElementById("totpErr"),
    totpBtn: document.getElementById("totpBtn"),
    totpSair: document.getElementById("totpSair"),
    mfaBtn: document.getElementById("mfaBtn"),
    mfaModal: document.getElementById("mfaModal"),
    mfaClose: document.getElementById("mfaClose"),
    mfaBody: document.getElementById("mfaBody"),
    fotoModal: document.getElementById("fotoModal"),
    fotoModalImg: document.getElementById("fotoModalImg"),
    fotoModalCap: document.getElementById("fotoModalCap"),
    fotoModalClose: document.getElementById("fotoModalClose"),
  };

  const state = { items: [], filtro: "todas", busca: "" };
  const vagas = { items: [], carregado: false };
  let usuarioEmail = "";

  /* ---------------- papéis (hierarquia) ----------------
     admin → tudo | azul → edita/publica | lito → só leitura.
     O papel vem do banco (adminsLAZ.papel) e as permissões são
     impostas pelo RLS — aqui só ajustamos a interface. */
  let papel = "lito"; // padrão mais restrito até o banco responder

  const podeEditar = () => papel === "admin" || papel === "azul";
  const podeExcluir = () => papel === "admin";

  const PAPEL_LABEL = { admin: "Admin", azul: "Azul", lito: "Lito" };

  async function carregarPapel() {
    try {
      const { data, error } = await sb.rpc("papel_laz");
      if (!error && data) papel = data;
    } catch (_) {}
    els.userRole.textContent = PAPEL_LABEL[papel] || papel;
    els.userRole.hidden = false;
    els.userRole.className = "app__role app__role--" + papel;
  }

  function aplicarPapelUI() {
    els.novaVagaBtn.hidden = !podeEditar();
    els.tabEquipe.hidden = !podeExcluir(); // aba Equipe: só admin
  }

  const STATUS = {
    nova:       { label: "Nova",       cls: "st-nova" },
    em_analise: { label: "Em análise", cls: "st-analise" },
    indicada:   { label: "Indicada",   cls: "st-indicada" },
    arquivada:  { label: "Arquivada",  cls: "st-arquivada" },
  };

  const CHECKS = [
    { k: "disponibilidade_mudanca", label: "Aceita mudança de estado" },
    { k: "cv_atualizado",         label: "Currículo atualizado" },
    { k: "cv_informa_lito",       label: "Cita a Lito no CV" },
    { k: "leu_vaga",              label: "Leu a vaga e atende requisitos" },
    { k: "autoriza_compartilhar", label: "Autoriza compartilhar dados", crit: true },
    { k: "info_verdadeiras",      label: "Confirma veracidade", crit: true },
  ];

  /* ---------------- helpers de DOM ---------------- */
  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function fmtData(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (_) { return iso; }
  }

  /* ---------------- autenticação ---------------- */
  // Backoff de login: após erros seguidos, trava o botão por um
  // tempo crescente (5 erros → 30s; depois 60s, 120s...).
  let loginFalhas = 0;
  let loginTravadoAte = 0;

  function loginTravado() {
    return Date.now() < loginTravadoAte;
  }

  function travarLogin() {
    const espera = Math.min(30 * Math.pow(2, Math.max(0, loginFalhas - 5)), 300); // s
    loginTravadoAte = Date.now() + espera * 1000;
    els.loginBtn.disabled = true;
    const tick = () => {
      const resta = Math.ceil((loginTravadoAte - Date.now()) / 1000);
      if (resta > 0) {
        els.loginBtn.textContent = "Aguarde " + resta + "s";
        setTimeout(tick, 1000);
      } else {
        els.loginBtn.disabled = false;
        els.loginBtn.textContent = "Entrar";
      }
    };
    tick();
  }

  async function entrar(e) {
    e.preventDefault();
    if (loginTravado()) return;
    els.loginErr.hidden = true;
    els.loginBtn.disabled = true;
    const txt = els.loginBtn.textContent;
    els.loginBtn.textContent = "Entrando...";

    const { error } = await sb.auth.signInWithPassword({
      email: els.email.value.trim(),
      password: els.senha.value,
    });

    if (error) {
      loginFalhas++;
      els.loginErr.textContent =
        loginFalhas >= 5
          ? "Muitas tentativas. Aguarde antes de tentar de novo."
          : "E-mail ou senha inválidos.";
      els.loginErr.hidden = false;
      if (loginFalhas >= 5) {
        travarLogin();
        return;
      }
    } else {
      loginFalhas = 0;
      loginTravadoAte = 0;
    }
    els.loginBtn.disabled = false;
    els.loginBtn.textContent = txt;
    // A troca de tela é feita por onAuthStateChange.
  }

  function sair() { sb.auth.signOut(); }

  function mostrarApp(session) {
    usuarioEmail = (session && session.user && session.user.email) || "";
    els.userEmail.textContent = usuarioEmail;
    if (!els.app.hidden) return; // já visível
    els.login.hidden = true;
    els.app.hidden = false;
    // Busca o papel primeiro para renderizar os cards com os controles certos.
    carregarPapel().then(() => {
      aplicarPapelUI();
      carregar();
      assinarRealtime();
    });
  }

  function mostrarLogin() {
    els.app.hidden = true;
    els.totpView.hidden = true;
    els.login.hidden = false;
    els.senha.value = "";
  }

  /* ---------------- 2FA: roteamento e verificação ----------------
     Depois da senha, se o usuário tem TOTP ativo, exige o código
     (sessão sobe de aal1 para aal2). O banco também exige — sem o
     código, as consultas voltam vazias. */
  async function rotearSessao(session) {
    if (!session) { mostrarLogin(); return; }
    let precisa = false;
    try {
      const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      precisa = !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2";
    } catch (_) {}
    if (precisa) mostrarTotp();
    else mostrarApp(session);
  }

  function mostrarTotp() {
    els.app.hidden = true;
    els.login.hidden = true;
    els.totpView.hidden = false;
    els.totpErr.hidden = true;
    els.totpCode.value = "";
    els.totpCode.focus();
  }

  async function validarTotp(e) {
    e.preventDefault();
    const code = els.totpCode.value.replace(/\D/g, "");
    if (code.length !== 6) {
      els.totpErr.textContent = "Digite os 6 dígitos do código.";
      els.totpErr.hidden = false;
      return;
    }
    els.totpBtn.disabled = true;
    const txt = els.totpBtn.textContent;
    els.totpBtn.textContent = "Validando...";
    try {
      const { data: fs, error: e1 } = await sb.auth.mfa.listFactors();
      if (e1) throw e1;
      const fator = (fs && fs.totp && fs.totp[0]) || null;
      if (!fator) throw new Error("Nenhum fator 2FA encontrado.");
      const { data: ch, error: e2 } = await sb.auth.mfa.challenge({ factorId: fator.id });
      if (e2) throw e2;
      const { error: e3 } = await sb.auth.mfa.verify({
        factorId: fator.id, challengeId: ch.id, code,
      });
      if (e3) throw e3;
      els.totpView.hidden = true;
      const { data } = await sb.auth.getSession();
      if (data && data.session) mostrarApp(data.session);
    } catch (err) {
      els.totpErr.textContent = "Código inválido ou expirado. Tente de novo.";
      els.totpErr.hidden = false;
      els.totpCode.select();
    } finally {
      els.totpBtn.disabled = false;
      els.totpBtn.textContent = txt;
    }
  }

  /* ---------------- carregar dados ---------------- */
  async function carregar() {
    els.loading.hidden = false;
    els.empty.hidden = true;
    const { data, error } = await sb
      .from(cfg.tabela)
      .select("*")
      .order("criado_em", { ascending: false });

    els.loading.hidden = true;
    if (error) {
      els.board.innerHTML = "";
      els.empty.hidden = false;
      els.empty.textContent = "Não foi possível carregar: " + error.message;
      return;
    }
    state.items = data || [];
    render();
  }

  function contar() {
    const c = { todas: state.items.length, nova: 0, em_analise: 0, indicada: 0, arquivada: 0 };
    state.items.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
    els.filters.querySelectorAll("[data-count]").forEach((n) => {
      const k = n.getAttribute("data-count");
      n.textContent = c[k] != null ? c[k] : 0;
    });
  }

  function filtrar() {
    const q = state.busca.trim().toLowerCase();
    return state.items.filter((i) => {
      if (state.filtro !== "todas" && i.status !== state.filtro) return false;
      if (!q) return true;
      return [i.nome, i.email, i.cpf, i.vaga, i.cursos]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }

  function render() {
    contar();
    const lista = filtrar();
    els.board.innerHTML = "";
    if (!lista.length) {
      els.empty.hidden = false;
      els.empty.textContent = state.items.length
        ? "Nenhuma candidatura para este filtro."
        : "Nenhuma candidatura por aqui ainda.";
      return;
    }
    els.empty.hidden = true;
    const frag = document.createDocumentFragment();
    lista.forEach((i) => frag.appendChild(card(i)));
    els.board.appendChild(frag);
  }

  /* ---------------- card ---------------- */
  function card(i) {
    const st = STATUS[i.status] || STATUS.nova;
    const wrap = el("article", "cand " + st.cls);
    wrap.dataset.id = i.id;

    const head = el("div", "cand__head");
    const idbox = el("div", "cand__id");
    idbox.append(avatar(i), el("h2", "cand__nome", i.nome || "—"));
    head.append(idbox, el("span", "cand__badge " + st.cls, st.label));

    const meta = el("p", "cand__meta", "Recebida em " + fmtData(i.criado_em));

    const grid = el("div", "cand__grid");

    // Vaga em linha própria, com destaque (é a informação-chave).
    const vagaBox = infoLinha("Vaga na Azul", i.vaga);
    vagaBox.classList.add("info--full");
    vagaBox.querySelector(".info__val").classList.add("info__val--forte");

    // Cursos como etiquetas (em vez de texto corrido).
    const cursosBox = el("div", "info info--full");
    cursosBox.appendChild(el("span", "info__lb", "Cursos na Lito"));
    const tags = el("div", "cursotags");
    String(i.cursos || "").split(/,\s+/).filter(Boolean)
      .forEach((c) => tags.appendChild(el("span", "cursotag", c)));
    if (!tags.childElementCount) tags.appendChild(el("span", "cursotag", "—"));
    cursosBox.appendChild(tags);

    grid.append(
      infoLinha("E-mail (Gupy)", i.email, true),
      infoLinha("CPF", i.cpf, true),
      vagaBox,
      cursosBox
    );

    const checks = el("div", "cand__checks");
    CHECKS.forEach((c) => {
      const v = (i[c.k] || "").trim();
      const sim = /^sim$/i.test(v);
      const cls = sim ? "ok" : (c.crit ? "crit" : "warn");
      const pill = el("span", "check check--" + cls);
      pill.append(el("span", "check__ic", sim ? "✓" : "!"),
                  el("span", "check__lb", c.label));
      pill.title = c.label + ": " + (v || "—");
      checks.appendChild(pill);
    });

    const actions = el("div", "cand__actions");
    const dl = el("button", "btn btn--line btn--sm", "Baixar currículo");
    dl.type = "button";
    if (!i.curriculo_path) { dl.disabled = true; dl.textContent = "Sem currículo"; }
    else dl.addEventListener("click", () => baixar(i, dl));

    actions.appendChild(dl);

    // Mover candidato: só admin e azul (lito é somente leitura).
    if (podeEditar()) {
      const sel = el("select", "cand__status");
      Object.keys(STATUS).forEach((k) => {
        const o = el("option", null, STATUS[k].label);
        o.value = k;
        if (k === i.status) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", () => mudarStatus(i, sel.value, wrap));
      actions.appendChild(sel);
    }

    // Excluir: só admin.
    if (podeExcluir()) {
      const rm = el("button", "card__del", "Excluir");
      rm.type = "button";
      rm.addEventListener("click", () => excluirCandidatura(i, rm));
      actions.appendChild(rm);
    }

    wrap.append(head, meta, grid, checks, actions);
    return wrap;
  }

  async function excluirCandidatura(i, btn) {
    const ok = confirm(
      "Excluir a candidatura de " + (i.nome || "candidato(a)") +
      "?\nO currículo e a foto também serão apagados. Essa ação não tem volta."
    );
    if (!ok) return;
    btn.disabled = true;
    // Apaga os arquivos primeiro (se falhar, seguimos: o registro é o principal).
    const arquivos = [i.curriculo_path, i.foto_path].filter(Boolean);
    if (arquivos.length) {
      try { await sb.storage.from(cfg.bucket).remove(arquivos); } catch (_) {}
    }
    const { error } = await sb.from(cfg.tabela).delete().eq("id", i.id);
    btn.disabled = false;
    if (error) { alert("Não foi possível excluir: " + error.message); return; }
    state.items = state.items.filter((x) => x.id !== i.id);
    render();
  }

  /* Avatar circular: foto (URL assinada) ou iniciais do nome */
  function iniciais(nome) {
    const p = (nome || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] || "" : "")).toUpperCase();
  }

  function avatar(i) {
    const box = el("span", "cand__avatar");
    box.append(el("span", "cand__avatar-ini", iniciais(i.nome)));
    if (i.foto_path) {
      sb.storage.from(cfg.bucket)
        .createSignedUrl(i.foto_path, 3600)
        .then(({ data, error }) => {
          if (error || !data) return; // fica com as iniciais
          const img = new Image();
          img.className = "cand__avatar-img";
          img.alt = "";
          img.onload = () => {
            box.innerHTML = "";
            box.appendChild(img);
            // Foto carregada → clique abre o modal ampliado.
            box.classList.add("cand__avatar--clicavel");
            box.setAttribute("role", "button");
            box.setAttribute("tabindex", "0");
            box.setAttribute("aria-label", "Ampliar foto de " + (i.nome || "candidato(a)"));
            const abrir = () => abrirFotoModal(data.signedUrl, i.nome);
            box.addEventListener("click", abrir);
            box.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); }
            });
          };
          img.src = data.signedUrl;
        })
        .catch(() => {});
    }
    return box;
  }

  /* ---------------- modal de foto ---------------- */
  let fotoModalOrigem = null; // devolve o foco ao fechar

  function abrirFotoModal(url, nome) {
    fotoModalOrigem = document.activeElement;
    els.fotoModalImg.src = url;
    els.fotoModalCap.textContent = nome || "";
    els.fotoModal.hidden = false;
    document.body.style.overflow = "hidden";
    els.fotoModalClose.focus();
  }

  function fecharFotoModal() {
    els.fotoModal.hidden = true;
    els.fotoModalImg.removeAttribute("src");
    document.body.style.overflow = "";
    if (fotoModalOrigem && fotoModalOrigem.focus) fotoModalOrigem.focus();
    fotoModalOrigem = null;
  }

  function infoLinha(label, valor, copiavel) {
    const box = el("div", "info");
    box.append(el("span", "info__lb", label));
    const val = el("span", "info__val", valor || "—");
    if (copiavel && valor) {
      val.classList.add("info__val--copy");
      val.title = "Clique para copiar";
      val.addEventListener("click", () => copiar(valor, val));
    }
    box.appendChild(val);
    return box;
  }

  async function copiar(txt, node) {
    try {
      await navigator.clipboard.writeText(txt);
      const antes = node.textContent;
      node.textContent = "Copiado!";
      node.classList.add("is-copied");
      setTimeout(() => { node.textContent = antes; node.classList.remove("is-copied"); }, 1000);
    } catch (_) {}
  }

  /* ---------------- currículo (link assinado) ---------------- */
  async function baixar(item, btn) {
    if (!item.curriculo_path) return;
    const t = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Gerando link...";
    const { data, error } = await sb.storage
      .from(cfg.bucket)
      .createSignedUrl(item.curriculo_path, 60, { download: item.curriculo_nome || true });
    btn.disabled = false;
    btn.textContent = t;
    if (error || !data) { alert("Não foi possível gerar o link do currículo."); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------------- status ---------------- */
  async function mudarStatus(item, novo, wrap) {
    const antigo = item.status;
    item.status = novo;
    aplicarStatusVisual(wrap, novo);
    const { error } = await sb.from(cfg.tabela).update({ status: novo }).eq("id", item.id);
    if (error) {
      item.status = antigo;
      aplicarStatusVisual(wrap, antigo);
      alert("Não foi possível atualizar o status.");
    }
    contar();
    if (state.filtro !== "todas" && state.filtro !== item.status) render();
  }

  function aplicarStatusVisual(wrap, status) {
    const st = STATUS[status] || STATUS.nova;
    wrap.className = "cand " + st.cls;
    const badge = wrap.querySelector(".cand__badge");
    if (badge) { badge.className = "cand__badge " + st.cls; badge.textContent = st.label; }
  }

  /* ---------------- tempo real ---------------- */
  let canal = null;
  function assinarRealtime() {
    if (canal) return;
    try {
      canal = sb.channel("cand-laz")
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: cfg.tabela },
          (payload) => { state.items.unshift(payload.new); render(); flash(); })
        .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: cfg.tabela },
          (payload) => {
            const idx = state.items.findIndex((x) => x.id === payload.new.id);
            if (idx >= 0) state.items[idx] = payload.new;
            render();
          })
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "vagasLAZ" },
          (payload) => {
            if (!vagas.carregado) return;
            if (!vagas.items.some((v) => v.id === payload.new.id)) {
              vagas.items.unshift(payload.new);
              renderVagas();
            }
          })
        .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "vagasLAZ" },
          (payload) => {
            const idx = vagas.items.findIndex((v) => v.id === payload.new.id);
            if (idx >= 0) { vagas.items[idx] = payload.new; renderVagas(); }
          })
        .on("postgres_changes",
          { event: "DELETE", schema: "public", table: cfg.tabela },
          (payload) => {
            const id = payload.old && payload.old.id;
            if (!id) return;
            state.items = state.items.filter((x) => x.id !== id);
            render();
          })
        .on("postgres_changes",
          { event: "DELETE", schema: "public", table: "vagasLAZ" },
          (payload) => {
            const id = payload.old && payload.old.id;
            if (!id) return;
            vagas.items = vagas.items.filter((x) => x.id !== id);
            if (vagas.carregado) renderVagas();
          })
        .subscribe();
    } catch (_) {}
  }

  function flash() {
    document.title = "● Nova candidatura — Painel";
    setTimeout(() => (document.title = "Painel de indicações · Lito x Azul"), 4000);
  }

  /* ---------------- vagas da Azul ---------------- */
  function abrirView(nome) {
    els.viewTabs.forEach((t) =>
      t.classList.toggle("is-active", t.dataset.view === nome));
    els.viewCand.hidden = nome !== "candidaturas";
    els.viewVagas.hidden = nome !== "vagas";
    els.viewEquipe.hidden = nome !== "equipe";
    if (nome === "vagas" && !vagas.carregado) carregarVagas();
    if (nome === "equipe" && !equipe.carregado) carregarEquipe();
  }

  async function carregarVagas() {
    els.vagasLoading.hidden = false;
    els.vagasEmpty.hidden = true;
    const { data, error } = await sb
      .from("vagasLAZ")
      .select("*")
      .order("criado_em", { ascending: false });
    els.vagasLoading.hidden = true;
    if (error) {
      els.vagasEmpty.hidden = false;
      els.vagasEmpty.textContent = "Não foi possível carregar as vagas: " + error.message;
      return;
    }
    vagas.items = data || [];
    vagas.carregado = true;
    renderVagas();
  }

  function renderVagas() {
    els.vagasList.innerHTML = "";
    if (!vagas.items.length) {
      els.vagasEmpty.hidden = false;
      els.vagasEmpty.textContent = "Nenhuma vaga publicada ainda.";
      return;
    }
    els.vagasEmpty.hidden = true;
    const frag = document.createDocumentFragment();
    vagas.items.forEach((v) => frag.appendChild(vagaCard(v)));
    els.vagasList.appendChild(frag);
  }

  function vagaCard(v) {
    const aberta = v.status === "aberta";
    const wrap = el("article", "vaga" + (aberta ? "" : " vaga--encerrada"));

    const head = el("div", "vaga__head");
    head.append(el("h3", "vaga__titulo", v.titulo || "—"),
                el("span", "vaga__badge", aberta ? "Aberta" : "Encerrada"));

    const meta = el("p", "vaga__meta",
      [v.local, "Publicada em " + fmtData(v.criado_em)].filter(Boolean).join(" · "));

    wrap.append(head, meta);
    if (v.descricao) wrap.appendChild(el("p", "vaga__desc", v.descricao));

    const actions = el("div", "vaga__actions");
    if (v.link) {
      const a = el("a", "btn btn--line btn--sm", "Ver na Gupy");
      a.href = v.link; a.target = "_blank"; a.rel = "noopener noreferrer";
      actions.appendChild(a);
    }
    // Encerrar/Reabrir: só admin e azul.
    if (podeEditar()) {
      const tog = el("button", "vaga__toggle", aberta ? "Encerrar" : "Reabrir");
      tog.type = "button";
      tog.addEventListener("click", () => alternarVaga(v, tog));
      actions.appendChild(tog);
    }

    // Excluir: só admin.
    if (podeExcluir()) {
      const rm = el("button", "card__del", "Excluir");
      rm.type = "button";
      rm.addEventListener("click", () => excluirVaga(v, rm));
      actions.appendChild(rm);
    }

    wrap.appendChild(actions);

    if (v.publicado_por) wrap.appendChild(el("p", "vaga__por", "por " + v.publicado_por));
    return wrap;
  }

  async function excluirVaga(v, btn) {
    if (!confirm('Excluir a vaga "' + (v.titulo || "") + '"? Essa ação não tem volta.')) return;
    btn.disabled = true;
    const { error } = await sb.from("vagasLAZ").delete().eq("id", v.id);
    btn.disabled = false;
    if (error) { alert("Não foi possível excluir: " + error.message); return; }
    vagas.items = vagas.items.filter((x) => x.id !== v.id);
    renderVagas();
  }

  async function alternarVaga(v, btn) {
    const novo = v.status === "aberta" ? "encerrada" : "aberta";
    btn.disabled = true;
    const { error } = await sb.from("vagasLAZ").update({ status: novo }).eq("id", v.id);
    btn.disabled = false;
    if (error) { alert("Não foi possível atualizar a vaga."); return; }
    v.status = novo;
    renderVagas();
  }

  function alternarFormVaga(abrir) {
    els.vagaForm.hidden = !abrir;
    els.novaVagaBtn.hidden = abrir;
    els.vagaErr.hidden = true;
    if (abrir) els.vagaTitulo.focus();
  }

  async function publicarVaga(e) {
    e.preventDefault();
    const titulo = els.vagaTitulo.value.trim();
    if (!titulo) {
      els.vagaErr.textContent = "Informe o título da vaga.";
      els.vagaErr.hidden = false;
      els.vagaTitulo.focus();
      return;
    }
    els.vagaSalvarBtn.disabled = true;
    const txt = els.vagaSalvarBtn.textContent;
    els.vagaSalvarBtn.textContent = "Publicando...";
    const { error } = await sb.from("vagasLAZ").insert({
      titulo,
      local: els.vagaLocal.value.trim() || null,
      link: els.vagaLink.value.trim() || null,
      descricao: els.vagaDesc.value.trim() || null,
      publicado_por: usuarioEmail || null,
    });
    els.vagaSalvarBtn.disabled = false;
    els.vagaSalvarBtn.textContent = txt;
    if (error) {
      els.vagaErr.textContent = "Não foi possível publicar: " + error.message;
      els.vagaErr.hidden = false;
      return;
    }
    els.vagaForm.reset();
    alternarFormVaga(false);
    carregarVagas(); // garante a lista mesmo sem realtime
  }

  /* ---------------- equipe (só admin) ---------------- */
  const equipe = { items: [], carregado: false };
  const PAPEIS = [
    { valor: "admin", rotulo: "Admin — acesso total" },
    { valor: "azul",  rotulo: "Azul — publica e move" },
    { valor: "lito",  rotulo: "Lito — só visualiza" },
  ];

  async function carregarEquipe() {
    els.equipeLoading.hidden = false;
    const { data, error } = await sb
      .from("adminsLAZ")
      .select("*")
      .order("criado_em", { ascending: true });
    els.equipeLoading.hidden = true;
    if (error) {
      mostrarErroEquipe("Não foi possível carregar a equipe: " + error.message);
      return;
    }
    equipe.items = data || [];
    equipe.carregado = true;
    renderEquipe();
  }

  function mostrarErroEquipe(msg) {
    els.equipeErr.textContent = msg;
    els.equipeErr.hidden = false;
  }

  function renderEquipe() {
    els.equipeList.innerHTML = "";
    const frag = document.createDocumentFragment();
    equipe.items.forEach((m) => frag.appendChild(linhaMembro(m)));
    els.equipeList.appendChild(frag);
  }

  function linhaMembro(m) {
    const souEu = m.email === usuarioEmail;
    const row = el("div", "membro" + (souEu ? " membro--eu" : ""));

    const info = el("div", "membro__info");
    const ini = el("span", "membro__avatar", (m.email[0] || "?").toUpperCase());
    const idbox = el("div", "membro__id");
    idbox.append(el("span", "membro__email", m.email));
    if (souEu) idbox.append(el("span", "membro__voce", "você"));
    info.append(ini, idbox);

    const acts = el("div", "membro__actions");

    // Campo de lista: classifica o papel.
    const sel = el("select", "cand__status equipe__select");
    PAPEIS.forEach((p) => {
      const o = el("option", null, p.rotulo);
      o.value = p.valor;
      if (p.valor === m.papel) o.selected = true;
      sel.appendChild(o);
    });
    // Não deixa você rebaixar a si mesmo (evita se trancar pra fora).
    if (souEu) { sel.disabled = true; sel.title = "Você não pode alterar o próprio papel."; }
    else sel.addEventListener("change", () => mudarPapel(m, sel));
    acts.appendChild(sel);

    if (!souEu) {
      const rm = el("button", "card__del", "Remover");
      rm.type = "button";
      rm.addEventListener("click", () => removerMembro(m, rm));
      acts.appendChild(rm);
    }

    row.append(info, acts);
    return row;
  }

  async function mudarPapel(m, sel) {
    const anterior = m.papel;
    const novo = sel.value;
    sel.disabled = true;
    const { error } = await sb
      .from("adminsLAZ")
      .update({ papel: novo })
      .eq("email", m.email);
    sel.disabled = false;
    if (error) {
      sel.value = anterior;
      mostrarErroEquipe("Não foi possível mudar o papel: " + error.message);
      return;
    }
    els.equipeErr.hidden = true;
    m.papel = novo;
  }

  async function removerMembro(m, btn) {
    const ok = confirm(
      "Remover " + m.email + " da equipe?\nA pessoa perde o acesso ao painel na hora."
    );
    if (!ok) return;
    btn.disabled = true;
    const { error } = await sb.from("adminsLAZ").delete().eq("email", m.email);
    btn.disabled = false;
    if (error) {
      mostrarErroEquipe("Não foi possível remover: " + error.message);
      return;
    }
    els.equipeErr.hidden = true;
    equipe.items = equipe.items.filter((x) => x.email !== m.email);
    renderEquipe();
  }

  async function adicionarMembro(e) {
    e.preventDefault();
    els.equipeErr.hidden = true;
    const email = els.membroEmail.value.trim().toLowerCase();
    if (!email) { els.membroEmail.focus(); return; }
    if (equipe.items.some((x) => x.email.toLowerCase() === email)) {
      mostrarErroEquipe("Esse e-mail já está na equipe.");
      return;
    }
    els.membroAddBtn.disabled = true;
    const txt = els.membroAddBtn.textContent;
    els.membroAddBtn.textContent = "Adicionando...";
    const { data, error } = await sb
      .from("adminsLAZ")
      .insert({ email, papel: els.membroPapel.value })
      .select()
      .single();
    els.membroAddBtn.disabled = false;
    els.membroAddBtn.textContent = txt;
    if (error) {
      mostrarErroEquipe("Não foi possível adicionar: " + error.message);
      return;
    }
    equipe.items.push(data);
    renderEquipe();
    els.equipeForm.reset();
    els.membroEmail.focus();
  }

  /* ---------------- 2FA: gestão (ativar/desativar) ---------------- */
  function abrirMfa() {
    els.mfaModal.hidden = false;
    document.body.style.overflow = "hidden";
    renderMfa();
  }

  function fecharMfa() {
    els.mfaModal.hidden = true;
    document.body.style.overflow = "";
  }

  async function renderMfa() {
    els.mfaBody.innerHTML = "";
    els.mfaBody.appendChild(el("p", "mfacard__sub", "Verificando..."));
    const { data, error } = await sb.auth.mfa.listFactors();
    els.mfaBody.innerHTML = "";
    if (error) {
      els.mfaBody.appendChild(el("p", "mfacard__err",
        "Não foi possível consultar o 2FA: " + error.message));
      return;
    }
    const ativo = (data.totp || [])[0];
    if (ativo) renderMfaAtivo(ativo);
    else renderMfaInativo(data);
  }

  function renderMfaAtivo(fator) {
    const ok = el("p", "mfacard__status mfacard__status--on", "✓ 2FA ativado nesta conta");
    const sub = el("p", "mfacard__sub",
      "Além da senha, o painel pede o código do seu aplicativo autenticador a cada login.");
    const off = el("button", "card__del", "Desativar 2FA");
    off.type = "button";
    off.addEventListener("click", async () => {
      if (!confirm("Desativar a verificação em 2 etapas? Sua conta fica menos protegida.")) return;
      off.disabled = true;
      const { error } = await sb.auth.mfa.unenroll({ factorId: fator.id });
      off.disabled = false;
      if (error) { alert("Não foi possível desativar: " + error.message); return; }
      renderMfa();
    });
    els.mfaBody.append(ok, sub, off);
  }

  function renderMfaInativo(lista) {
    const sub = el("p", "mfacard__sub",
      "Proteja sua conta: além da senha, o login passa a pedir um código de 6 dígitos " +
      "gerado no seu celular (Google Authenticator, 1Password, Authy...).");
    const btn = el("button", "btn btn--primary", "Ativar 2FA");
    btn.type = "button";
    btn.addEventListener("click", () => iniciarEnrol(lista, btn));
    els.mfaBody.append(sub, btn);
  }

  async function iniciarEnrol(lista, btn) {
    btn.disabled = true;
    btn.textContent = "Gerando QR Code...";
    // Remove tentativas abandonadas (fator criado e nunca verificado).
    const pendentes = ((lista && lista.all) || []).filter(
      (f) => f.factor_type === "totp" && f.status !== "verified");
    for (const p of pendentes) {
      try { await sb.auth.mfa.unenroll({ factorId: p.id }); } catch (_) {}
    }

    const { data, error } = await sb.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Painel Lito x Azul",
    });
    if (error) {
      els.mfaBody.innerHTML = "";
      els.mfaBody.appendChild(el("p", "mfacard__err",
        "Não foi possível iniciar o 2FA: " + error.message));
      return;
    }

    els.mfaBody.innerHTML = "";
    els.mfaBody.appendChild(el("p", "mfacard__sub",
      "1. Escaneie o QR Code no seu aplicativo autenticador:"));

    const qr = new Image();
    qr.className = "mfacard__qr";
    qr.alt = "QR Code do 2FA";
    const qrData = data.totp && data.totp.qr_code;
    qr.src = qrData && qrData.startsWith("data:")
      ? qrData
      : "data:image/svg+xml;utf8," + encodeURIComponent(qrData || "");
    els.mfaBody.appendChild(qr);

    if (data.totp && data.totp.secret) {
      const man = el("p", "mfacard__secret");
      man.append(el("span", null, "Ou digite manualmente: "),
                 el("code", null, data.totp.secret));
      els.mfaBody.appendChild(man);
    }

    els.mfaBody.appendChild(el("p", "mfacard__sub",
      "2. Digite o código de 6 dígitos que apareceu no app:"));

    const input = el("input", "totp__input");
    input.type = "text"; input.inputMode = "numeric"; input.maxLength = 6;
    input.placeholder = "000000"; input.autocomplete = "one-time-code";
    const err = el("p", "mfacard__err"); err.hidden = true;
    const conf = el("button", "btn btn--primary", "Confirmar e ativar");
    conf.type = "button";
    conf.addEventListener("click", async () => {
      const code = input.value.replace(/\D/g, "");
      if (code.length !== 6) {
        err.textContent = "Digite os 6 dígitos."; err.hidden = false; return;
      }
      conf.disabled = true;
      try {
        const { data: ch, error: e1 } = await sb.auth.mfa.challenge({ factorId: data.id });
        if (e1) throw e1;
        const { error: e2 } = await sb.auth.mfa.verify({
          factorId: data.id, challengeId: ch.id, code,
        });
        if (e2) throw e2;
        renderMfa(); // mostra o estado "ativado"
      } catch (_) {
        err.textContent = "Código inválido. Confira o app e tente de novo.";
        err.hidden = false;
        conf.disabled = false;
      }
    });
    els.mfaBody.append(input, err, conf);
    input.focus();
  }

  /* ---------------- eventos ---------------- */
  els.totpForm.addEventListener("submit", validarTotp);
  els.totpSair.addEventListener("click", () => sb.auth.signOut());
  els.mfaBtn.addEventListener("click", abrirMfa);
  els.mfaClose.addEventListener("click", fecharMfa);
  els.mfaModal.addEventListener("click", (e) => {
    if (e.target === els.mfaModal) fecharMfa();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.mfaModal.hidden) fecharMfa();
  });
  els.equipeForm.addEventListener("submit", adicionarMembro);
  els.fotoModalClose.addEventListener("click", fecharFotoModal);
  els.fotoModal.addEventListener("click", (e) => {
    if (e.target === els.fotoModal) fecharFotoModal(); // clique no fundo fecha
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.fotoModal.hidden) fecharFotoModal();
  });
  els.viewTabs.forEach((t) =>
    t.addEventListener("click", () => abrirView(t.dataset.view)));
  els.novaVagaBtn.addEventListener("click", () => alternarFormVaga(true));
  els.vagaCancelarBtn.addEventListener("click", () => alternarFormVaga(false));
  els.vagaForm.addEventListener("submit", publicarVaga);
  els.loginForm.addEventListener("submit", entrar);
  els.logoutBtn.addEventListener("click", sair);
  els.refreshBtn.addEventListener("click", carregar);
  els.search.addEventListener("input", () => { state.busca = els.search.value; render(); });
  els.filters.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    els.filters.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    state.filtro = chip.dataset.status;
    render();
  });

  /* ---------------- logout por inatividade ----------------
     Painel lida com dados sensíveis (CPF, currículos): após
     30 min sem interação, encerra a sessão sozinho. */
  const INATIVIDADE_MIN = 30;
  let ultimaAtividade = Date.now();
  ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach((ev) =>
    document.addEventListener(ev, () => { ultimaAtividade = Date.now(); }, { passive: true })
  );
  setInterval(() => {
    if (els.app.hidden) return; // só vale com o painel aberto
    if (Date.now() - ultimaAtividade > INATIVIDADE_MIN * 60 * 1000) {
      sb.auth.signOut();
    }
  }, 60 * 1000);

  /* ---------------- sessão ---------------- */
  sb.auth.onAuthStateChange((_evt, session) => { rotearSessao(session); });
  sb.auth.getSession().then(({ data }) => { rotearSessao(data.session); });
})();
