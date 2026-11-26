/* SAGA · Mesa do Árbitro
   Tudo fica salvo no navegador (localStorage). Sem servidor, sem build. */
(() => {
  "use strict";

  // ---------------------------------------------------------------- dados fixos
  const M = window.SAGA_MOLDES;
  const ORDEM_TIER = ["fraco", "medio", "forte", "chefao"];
  const TIER = Object.fromEntries(M.tiers.map((t) => [t.id, t]));
  const MOLDE = Object.fromEntries(M.moldes.map((m) => [m.id, m]));
  const CATEGORIA = Object.fromEntries(M.categorias.map((c) => [c.id, c]));
  const POS_NOME = { frente: "Frente", meio: "Meio", tras: "Trás" };
  const TIPO_NOME = { golpe: "Golpe", resposta: "Resposta", especial: "Especial" };
  const MORAIS = [6, 7, 8];

  const BATIDAS = [
    { nome: "Começo", dica: "O problema aparece." },
    { nome: "Complicação", dica: "Fica mais difícil do que parecia." },
    { nome: "Reviravolta", dica: "Algo que ninguém esperava muda tudo." },
    { nome: "Crise", dica: "O pior momento, quando tudo pode dar errado." },
    { nome: "Final", dica: "O objetivo é alcançado, ou não." },
  ];

  const SECOES = {
    login: ["IDENTIFICAÇÃO", "00"],
    entrada: ["ENTRADA", "01"],
    historias: ["HISTÓRIAS", "02"],
    historia: ["HISTÓRIA", "03"],
    esquadroes: ["ESQUADRÕES", "04"],
    esquadrao: ["ESQUADRÃO", "05"],
  };

  // ---------------------------------------------------------------- armazenamento
  // Contas: e-mail + senha (com hash PBKDF2). Cada conta tem a sua própria chave de dados.
  const CHAVE_CONTAS = "saga-arbitro-contas";
  const CHAVE_SESSAO = "saga-arbitro-sessao";
  const CHAVE_ANTIGA = "saga-arbitro-v1"; // dados de antes de existir login
  const chaveDados = (email) => "saga-arbitro-dados:" + email;

  function lerJSON(chave) {
    try { return JSON.parse(localStorage.getItem(chave)); } catch (_) { return null; }
  }
  function escreverJSON(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (_) { return false; }
  }
  function lerContas() {
    const c = lerJSON(CHAVE_CONTAS);
    return c && Array.isArray(c.contas) ? c : { contas: [] };
  }
  function lerSessao() {
    try {
      const email = localStorage.getItem(CHAVE_SESSAO);
      return email && lerContas().contas.some((c) => c.email === email) ? email : null;
    } catch (_) { return null; }
  }

  let usuario = lerSessao();
  let db = usuario ? carregar(usuario) : { historias: [] };

  function carregar(email) {
    const bruto = lerJSON(chaveDados(email));
    return bruto && Array.isArray(bruto.historias) ? bruto : { historias: [] };
  }
  function gravar() {
    if (!usuario) return false;
    if (escreverJSON(chaveDados(usuario), db)) return true;
    toast("Não deu pra salvar neste navegador.");
    return false;
  }

  // ---- senha
  const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const deB64 = (txt) => Uint8Array.from(atob(txt), (c) => c.charCodeAt(0));
  async function hashSenha(senha, sal) {
    const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: deB64(sal), iterations: 150000, hash: "SHA-256" }, chave, 256);
    return b64(new Uint8Array(bits));
  }
  const normalizarEmail = (e) => String(e || "").trim().toLowerCase();
  const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  function entrarComo(email) {
    usuario = email;
    try { localStorage.setItem(CHAVE_SESSAO, email); } catch (_) { /* segue só nesta aba */ }
    db = carregar(email);
  }

  async function criarConta(email, senha) {
    const contas = lerContas();
    if (contas.contas.some((c) => c.email === email)) throw new Error("Esse e-mail já tem conta. Use “Já tenho login”.");
    const sal = b64(crypto.getRandomValues(new Uint8Array(16)));
    contas.contas.push({ email, sal, hash: await hashSenha(senha, sal), criada: agora() });
    if (!escreverJSON(CHAVE_CONTAS, contas)) throw new Error("Este navegador não deixa salvar dados. Tente fora da janela anônima.");
    // Primeira conta do navegador: leva junto o que já estava salvo antes do login.
    const antigo = contas.contas.length === 1 ? lerJSON(CHAVE_ANTIGA) : null;
    if (antigo && Array.isArray(antigo.historias) && antigo.historias.length) {
      escreverJSON(chaveDados(email), antigo);
      try { localStorage.removeItem(CHAVE_ANTIGA); } catch (_) { /* fica a cópia antiga */ }
    }
    entrarComo(email);
  }

  async function fazerLogin(email, senha) {
    const conta = lerContas().contas.find((c) => c.email === email);
    if (!conta || (await hashSenha(senha, conta.sal)) !== conta.hash) throw new Error("E-mail ou senha errados.");
    entrarComo(email);
  }

  function sair() {
    usuario = null;
    db = { historias: [] };
    rascunho = null;
    try { localStorage.removeItem(CHAVE_SESSAO); } catch (_) { /* nada */ }
  }
  const novoId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const agora = () => new Date().toISOString();

  function novaHistoria(nome) {
    return {
      id: novoId(),
      nome: nome || "História sem nome",
      criada: agora(),
      atualizada: agora(),
      modo: "batidas",
      batidas: BATIDAS.map(() => ({ texto: "", marca: "" })),
      preparo: { segredos: ["", "", ""], lugar: "" },
      notas: "",
      esquadroes: [],
    };
  }
  function novoEsquadrao() {
    return { id: novoId(), tema: "", jogadores: 4, oponentes: [], criado: agora(), atualizado: agora() };
  }
  function novoOponente(moldeId, extra = {}) {
    const m = MOLDE[moldeId];
    return Object.assign({
      uid: novoId(),
      molde: moldeId,
      nome: m.nome_placeholder ? m.nome.replace("___", "").trim() + " …" : m.nome,
      tier: "medio",
      moral: 6,
      gangue: moldeId === "enxame",
      frase: "",
      quer: "",
      nomesPecas: m.pecas.map(() => ""),
    }, extra);
  }
  const historia = (id) => db.historias.find((h) => h.id === id);
  function tocar(h) { h.atualizada = agora(); }

  // ---------------------------------------------------------------- utilidades
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const app = $("#app");
  const modalRaiz = $("#modal-raiz");

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function dataCurta(iso) {
    try {
      return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch (_) { return ""; }
  }
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("on"), 2200);
  }
  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  /** Texto do efeito com Naipes destacados e o D trocado pelo dano do tier. */
  function efeitoHTML(texto, dano) {
    let s = esc(texto);
    s = s.replace(/(Caído|Atordoado|Ardendo|Exposto)(!?)/g, (_, n, b) => {
      const cls = "n-" + n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      return `<span class="${cls}">${n}${b}</span>`;
    });
    s = s.replace(/\bRoubo(!?)/g, '<span class="n-roubo">Roubo$1</span>');
    s = s.replace(/(^|[\s(])D(?=[\s.,]|$)/g, (_, pre) =>
      dano == null ? `${pre}<span class="dano">D</span>` : `${pre}<span class="dano dano--num" title="D = ${dano}">${dano}</span>`
    );
    return s;
  }

  function vidaDe(op, jogadores) {
    const t = TIER[op.tier];
    if (op.tier === "fraco" && op.gangue) return { valor: t.vida * jogadores, extra: `${jogadores} membros` };
    return { valor: t.vida_por_jogador ? t.vida * jogadores : t.vida, extra: t.vida_por_jogador ? `${t.vida}×${jogadores} jog.` : "" };
  }
  const pecaVisivel = (p, tier) => ORDEM_TIER.indexOf(p.tier_minimo) <= ORDEM_TIER.indexOf(tier);

  // ---------------------------------------------------------------- cartão de molde
  function linhaPeca(p, i, { dano, tier, op }) {
    const tag = `<span class="tag ${p.tipo !== "golpe" ? "tag--" + p.tipo : ""}">${TIPO_NOME[p.tipo]}</span>`;
    const original = p.nome + (p.tipo === "especial" && p.forma !== "Explosão" ? ` (${p.forma})` : "");
    let nome;
    if (op) {
      const atual = op.nomesPecas[i] || p.nome;
      nome = `<input class="peca-input" data-campo="peca" data-i="${i}" value="${esc(atual)}" aria-label="Nome do ${TIPO_NOME[p.tipo]}" size="${Math.max(6, atual.length + 1)}">`
        + (p.tipo === "especial" && p.forma !== "Explosão" ? ` <span class="linha__nota">(${p.forma})</span>` : "");
    } else {
      nome = `<span class="linha__nome">${esc(original)}</span>`;
    }
    const nota = p.nota ? ` <span class="linha__nota">(${esc(p.nota)})</span>` : "";
    const parase = p.para_se ? `<span class="linha__parase">⟶ Para se ${esc(p.para_se)}</span>` : "";
    const chip = tier ? "" : `<span class="tier-chip">${TIER[p.tier_minimo].nome.toUpperCase()}+</span>`;
    return `<div class="linha ${p.tipo === "especial" ? "linha--especial" : ""}">
      ${tag}
      <div>${nome}: ${efeitoHTML(p.efeito, dano)}${nota}${parase}</div>
      ${chip}
    </div>`;
  }

  function infoMolde(m) {
    return `<div class="cartao__info">
      <div><b>Na luta</b>${efeitoHTML(m.na_luta, null).replace(/<span class="dano">D<\/span>/g, "D")}</div>
      ${m.nao_pega ? `<div><b>Não pega</b><strong>${esc(m.nao_pega.naipe)}</strong>: ${esc(m.nao_pega.motivo)}</div>` : ""}
    </div>`;
  }

  /** Cartão do jeito que está no livro (todas as linhas, com FRACO+/MÉDIO+/FORTE+). */
  function cartaoMolde(m, { selecionado = false, estatico = false } = {}) {
    const abre = estatico
      ? `<article class="cartao" data-molde="${m.id}">`
      : `<article class="cartao escolhivel ${selecionado ? "sel" : ""}" data-acao="alternar-molde" data-molde="${m.id}" tabindex="0" role="button" aria-pressed="${selecionado}">
      <span class="escolhivel__marca" aria-hidden="true">${selecionado ? "✓" : "+"}</span>`;
    return `${abre}
      <div class="cartao__cabeca">
        <span class="cartao__num">${m.numero}</span>
        <span class="cartao__nome">${esc(m.nome)}</span>
        <span class="pos pos--${m.posicao}">${POS_NOME[m.posicao]}</span>
      </div>
      <div class="cartao__resumo">${esc(m.resumo)}</div>
      ${infoMolde(m)}
      <div class="cartao__pecas">${m.pecas.map((p, i) => linhaPeca(p, i, { dano: null, tier: null })).join("")}</div>
    </article>`;
  }

  /** Cartão de um oponente no esquadrão: já no tier escolhido, com nomes editáveis. */
  /** Vida atual do oponente (guardada em op.vida; sem valor = cheia). */
  function vidaAtual(op, max) {
    return op.vida == null ? max : Math.min(max, Math.max(0, op.vida));
  }

  /** Cartão compacto de um oponente no esquadrão: tier escolhido, Vida controlável e nomes editáveis. */
  function cartaoOponente(op, idx, total, jogadores) {
    const m = MOLDE[op.molde];
    const t = TIER[op.tier];
    const vida = vidaDe(op, jogadores);
    const atual = vidaAtual(op, vida.valor);
    const ferido = atual > 0 && atual <= Math.floor(vida.valor / 2);
    const caido = atual === 0;
    const gangue = op.tier === "fraco" && op.gangue;
    const visiveis = m.pecas.map((p, i) => [p, i]).filter(([p]) => pecaVisivel(p, op.tier));
    const segTier = ORDEM_TIER.map((id) =>
      `<button type="button" data-acao="tier" data-tier="${id}" aria-pressed="${op.tier === id}">${TIER[id].nome}</button>`).join("");
    const segMoral = MORAIS.map((v) =>
      `<button type="button" data-acao="moral" data-moral="${v}" aria-pressed="${op.moral === v}">${v}</button>`).join("");
    const estado = caido ? `<span class="selo-estado selo-estado--caido">Caído</span>`
      : ferido ? `<span class="selo-estado selo-estado--ferido">Ferido</span>` : "";
    const pct = vida.valor ? Math.round((atual / vida.valor) * 100) : 0;

    return `<div class="oponente ${caido ? "oponente--caido" : ""}" data-uid="${op.uid}">
      <article class="cartao cartao--compacto">
        <div class="cartao__cabeca">
          <span class="cartao__num" title="Ordem no esquadrão">${idx + 1}</span>
          <input class="cartao__nome-input" data-campo="nome" value="${esc(op.nome)}" aria-label="Nome do oponente">
          <span class="pos pos--${m.posicao}">${POS_NOME[m.posicao]}</span>
        </div>
        <div class="oponente__barra">
          <span class="oponente__molde">${m.numero} · ${esc(m.nome)}</span>
          <span class="oponente__acoes">
            <button class="icone-btn" type="button" data-acao="subir" title="Pra trás" aria-label="Mover pra trás" ${idx === 0 ? "disabled" : ""}>←</button>
            <button class="icone-btn" type="button" data-acao="descer" title="Pra frente" aria-label="Mover pra frente" ${idx === total - 1 ? "disabled" : ""}>→</button>
            <button class="icone-btn" type="button" data-acao="duplicar" title="Duplicar" aria-label="Duplicar">⧉</button>
            <button class="icone-btn" type="button" data-acao="remover" title="Tirar do esquadrão" aria-label="Tirar do esquadrão">✕</button>
          </span>
        </div>
        <div class="vida-painel">
          <div class="vida-painel__conta">
            <button class="icone-btn" type="button" data-acao="vida" data-delta="-1" aria-label="Tirar 1 de Vida">−</button>
            <div class="vida-painel__num"><b>${atual}</b><span>/ ${vida.valor}</span></div>
            <button class="icone-btn" type="button" data-acao="vida" data-delta="1" aria-label="Devolver 1 de Vida">+</button>
            ${atual !== vida.valor ? `<button class="icone-btn" type="button" data-acao="vida-cheia" title="Vida cheia" aria-label="Voltar à Vida cheia">↺</button>` : ""}
            ${estado}
          </div>
          <div class="vida-painel__barra" aria-hidden="true"><i style="width:${pct}%"></i></div>
          <div class="vida-painel__info">
            <span><b>D</b> ${t.dano}</span>
            <span><b>Ações</b> ${t.acoes}</span>
            ${gangue ? `<span><b>De pé</b> ${Math.ceil(atual / 2)} de ${jogadores}</span>` : vida.extra ? `<span class="apagado">${esc(vida.extra)}</span>` : ""}
          </div>
        </div>
        <div class="controles">
          <div class="controle"><span>Tier</span><div class="segmentos">${segTier}</div></div>
          <div class="controle"><span>Moral</span><div class="segmentos segmentos--moral">${segMoral}</div></div>
          ${op.tier === "fraco" ? `<label class="checa"><input type="checkbox" data-campo="gangue" ${op.gangue ? "checked" : ""}> Gangue</label>` : ""}
        </div>
        ${infoMolde(m)}
        <div class="cartao__pecas">${visiveis.map(([p, i]) => linhaPeca(p, i, { dano: t.dano, tier: op.tier, op })).join("")}</div>
        <details class="oponente__mais">
          <summary>Frase e Quer${op.frase || op.quer ? " ✓" : ""}</summary>
          <div class="oponente__extra">
            <label><span>Frase</span><input data-campo="frase" value="${esc(op.frase)}" placeholder="uma frase que ele diria"></label>
            <label><span>Quer</span><input data-campo="quer" value="${esc(op.quer)}" placeholder="o que ele quer de verdade"></label>
          </div>
        </details>
      </article>
    </div>`;
  }

  // ---------------------------------------------------------------- moldura (vinhas, rodapé, topo)
  function desenharVinhas() {
    const h = Math.max(window.innerHeight, 400);
    const naipes = ["♠", "♥", "♦", "♣"];
    [["esq", 0], ["dir", 1]].forEach(([lado, fase]) => {
      const el = $(".vinha--" + lado);
      if (!el) return;
      const cx = 32;
      let d = `M ${cx} -10`;
      let d2 = `M ${cx + 6} -10`;
      for (let y = 0; y <= h + 20; y += 20) {
        d += ` L ${(cx + Math.sin(y / 85 + fase * 2) * 9).toFixed(1)} ${y}`;
        d2 += ` L ${(cx + 4 + Math.sin(y / 120 + fase * 2 + 1.4) * 12).toFixed(1)} ${y}`;
      }
      let fichas = "";
      let k = fase;
      for (let y = 46 + fase * 30; y < h - 80; y += 64 + ((y * 7) % 46)) {
        const x = cx + Math.sin(y / 85 + fase * 2) * 9;
        const n = naipes[k % 4];
        const grande = k % 3 !== 1;
        const rot = ((k * 37) % 30) - 15;
        if (grande) {
          fichas += `<g class="ficha" style="animation-delay:${(k % 5) * -1.1}s"><g transform="translate(${x.toFixed(1)} ${y}) rotate(${rot})">
            <line x1="0" y1="-8" x2="0" y2="0" stroke="currentColor" stroke-width="1.2"/>
            <rect x="-10" y="0" width="20" height="26" rx="3.5" fill="currentColor"/>
            <rect x="-7.5" y="2.5" width="15" height="21" rx="2" fill="none" stroke="#f3e3c7" stroke-width=".8" opacity=".6"/>
            <text x="0" y="18" text-anchor="middle" font-size="12" fill="#f3e3c7">${n}</text></g></g>`;
        } else {
          fichas += `<g transform="translate(${x.toFixed(1)} ${y}) rotate(45)"><rect x="-4" y="-4" width="8" height="8" fill="currentColor"/></g>`;
        }
        k++;
      }
      el.innerHTML = `<svg viewBox="0 0 64 ${h}" width="64" height="${h}">
        <path d="${d2}" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/>
        <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6"/>
        ${fichas}</svg>`;
    });
  }

  function marcarSecao(chave, nav) {
    const [nome, num] = SECOES[chave];
    document.body.classList.toggle("na-entrada", chave === "entrada" || chave === "login");
    $("#topo-usuario").innerHTML = usuario
      ? `<span class="topo__email" title="${esc(usuario)}">${esc(usuario)}</span><button class="btn btn--mini" type="button" data-acao="sair">Sair</button>`
      : "";
    $("#rodape-secao").textContent = nome;
    $("#rodape-pagina").textContent = num;
    $("#topo-nav").innerHTML = nav
      .map(([href, txt, atual]) => `<a href="${href}" ${atual ? 'aria-current="page"' : ""}>${esc(txt)}</a>`)
      .join("");
  }

  // ---------------------------------------------------------------- telas
  let modoLogin = null; // "criar" | "entrar"

  function telaLogin(emailAnterior = "") {
    marcarSecao("login", []);
    const temContas = lerContas().contas.length > 0;
    const modo = modoLogin || (temContas ? "entrar" : "criar");
    const criar = modo === "criar";
    app.innerHTML = `<section class="entrada entrada--login">
      <img class="entrada__mao" src="assets/mao.png" alt="">
      <h1 class="entrada__titulo">Mesa do <b>Árbitro</b></h1>
      <p class="entrada__tags"><span>#NARRAR</span><span>#PERGUNTAR</span><span>#DECIDIR</span></p>
      <div class="entrada__palco">
        <form class="login" id="form-login" data-modo="${modo}" novalidate>
          <div class="login__cabeca">
            <span class="login__naipe" aria-hidden="true">${criar ? "♠" : "♥"}</span>
            <div><strong>${criar ? "Criar conta" : "Entrar"}</strong>
            <small>${criar ? "Suas histórias e esquadrões ficam na sua conta." : "Bem-vindo de volta à mesa."}</small></div>
          </div>
          <label class="campo"><span>E-mail</span>
            <input class="entrada-texto" id="login-email" name="email" type="email" autocomplete="email" required value="${esc(emailAnterior)}" placeholder="voce@email.com">
          </label>
          <label class="campo"><span>Senha</span>
            <input class="entrada-texto" id="login-senha" name="senha" type="password" autocomplete="${criar ? "new-password" : "current-password"}" required ${criar ? 'minlength="6" placeholder="pelo menos 6 caracteres"' : ""}>
          </label>
          ${criar ? `<label class="campo"><span>Confirmar senha</span>
            <input class="entrada-texto" id="login-senha2" name="senha2" type="password" autocomplete="new-password" required>
          </label>` : ""}
          <p class="login__erro" id="login-erro" role="alert"></p>
          <button class="btn btn--vermelho login__enviar" type="submit">${criar ? "Criar conta" : "Entrar"}</button>
          <div class="login__troca">
            ${criar
              ? `<span>Já tem um login?</span><button class="btn btn--mini" type="button" data-acao="modo-login" data-modo="entrar">Já tenho login</button>`
              : `<span>Ainda não tem conta?</span><button class="btn btn--mini" type="button" data-acao="modo-login" data-modo="criar">Criar conta</button>`}
          </div>
          <p class="login__nota">A conta fica guardada neste navegador. Em outro aparelho, leve suas histórias com Exportar e Importar.</p>
        </form>
      </div>
    </section>`;
    setTimeout(() => $(emailAnterior ? "#login-senha" : "#login-email")?.focus(), 20);
  }

  function telaEntrada() {
    marcarSecao("entrada", [["#inicio", "Entrada", true], ["#historias", "Histórias", false]]);
    const total = db.historias.length;
    app.innerHTML = `<section class="entrada">
      <img class="entrada__mao" src="assets/mao.png" alt="">
      <h1 class="entrada__titulo">Conte a história, <b>Saga</b></h1>
      <p class="entrada__tags"><span>#NARRAR</span><span>#PERGUNTAR</span><span>#DECIDIR</span></p>
      <div class="entrada__palco">
        <div class="entrada__voo" aria-hidden="true"><span>♠</span><span>♦</span><span>♥</span><span>♣</span></div>
        <button class="carta-cta" type="button" data-acao="comecar">
          <span class="carta-cta__moldura">
            <span class="carta-cta__canto">A<br>♠</span>
            <span class="carta-cta__miolo">
              <span class="carta-cta__naipe">♠</span>
              <span class="carta-cta__texto">Começar<br>a história</span>
              <span class="carta-cta__sub">${total ? `${total} ${total === 1 ? "história salva" : "histórias salvas"}` : "a mesa está esperando"}</span>
            </span>
            <span class="carta-cta__canto carta-cta__canto--b">A<br>♠</span>
          </span>
        </button>
      </div>
    </section>
    <div class="entrada__contador"><b>01</b> <span>/ 05</span> <b>ENTRADA</b></div>
    <div class="selo" aria-hidden="true">
      <svg class="selo__fundo" viewBox="0 0 100 100"><path fill="currentColor" d="${seloForma()}"/></svg>
      <svg class="selo__anel" viewBox="0 0 100 100">
        <defs><path id="circ" d="M50 50 m-34 0 a34 34 0 1 1 68 0 a34 34 0 1 1 -68 0"/></defs>
        <text font-size="9.4" font-weight="700" letter-spacing="2.6" fill="#fbf4e6" font-family="Lexend"><textPath href="#circ">ÁRBITRO · SAGA · ALPHA 0.7 ·</textPath></text>
      </svg>
      <span class="selo__miolo">♠</span>
    </div>`;
  }
  function seloForma() {
    let d = "";
    const n = 22;
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? 46 : 50;
      d += (i ? " L " : "M ") + (50 + Math.cos(a) * r).toFixed(2) + " " + (50 + Math.sin(a) * r).toFixed(2);
    }
    return d + " Z";
  }

  function telaHistorias() {
    marcarSecao("historias", [["#inicio", "Entrada", false], ["#historias", "Histórias", true]]);
    const lista = [...db.historias].sort((a, b) => (b.atualizada || "").localeCompare(a.atualizada || ""));
    app.innerHTML = `<section class="pagina">
      <div class="pagina__cabeca">
        <h1 class="pagina__titulo">Suas <b>histórias</b></h1>
        <div class="pagina__acoes">
          <button class="btn btn--leve" type="button" data-acao="exportar">Exportar</button>
          <label class="btn btn--leve" tabindex="0">Importar<input type="file" accept="application/json,.json" data-campo="importar" hidden></label>
          <button class="btn btn--vermelho" type="button" data-acao="nova-historia">＋ Criar nova história</button>
        </div>
      </div>
      <div class="grade-historias">
        <button class="ficha-nova" type="button" data-acao="nova-historia"><big>＋</big>Nova história</button>
        ${lista.map((h) => {
          const nOp = h.esquadroes.reduce((s, e) => s + e.oponentes.length, 0);
          const escritas = h.batidas.filter((b) => b.texto.trim()).length;
          return `<a class="ficha-historia" href="#h-${h.id}-historia">
            <span class="ficha-historia__naipe">${["♠", "♥", "♦", "♣"][h.id.charCodeAt(0) % 4]}</span>
            <h3>${esc(h.nome)}</h3>
            <div class="ficha-historia__meta">
              <span>${h.modo === "notas" ? "Bloco de notas" : `${escritas}/5 batidas`}</span>
              <span>${h.esquadroes.length} ${h.esquadroes.length === 1 ? "esquadrão" : "esquadrões"}</span>
              <span>${nOp} ${nOp === 1 ? "oponente" : "oponentes"}</span>
            </div>
            <div class="ficha-historia__rodape">
              <span class="ficha-historia__data">${dataCurta(h.atualizada)}</span>
              <span class="btn btn--mini" role="button" data-acao="apagar-historia" data-id="${h.id}" title="Apagar história">Apagar</span>
            </div>
          </a>`;
        }).join("")}
      </div>
      ${lista.length ? "" : `<p class="vazio">Nenhuma história ainda. Ninguém começa na taverna: comece no meio do problema.</p>`}
    </section>`;
  }

  function cabecaHistoria(h, aba) {
    return `<div class="historia-topo">
      <input class="historia-topo__nome" data-campo="nome-historia" value="${esc(h.nome)}" aria-label="Nome da história">
      <nav class="abas" aria-label="Partes da história">
        <a href="#h-${h.id}-historia" ${aba === "historia" ? 'aria-current="page"' : ""}>História</a>
        <a href="#h-${h.id}-esquadroes" ${aba === "esquadroes" ? 'aria-current="page"' : ""}>Esquadrões</a>
      </nav>
    </div>`;
  }
  const navHistoria = (h, aba) => [["#inicio", "Entrada", false], ["#historias", "Histórias", false], [`#h-${h.id}-${aba}`, h.nome.length > 22 ? h.nome.slice(0, 20) + "…" : h.nome, true]];

  function telaHistoria(h) {
    marcarSecao("historia", navHistoria(h, "historia"));
    const mais = h.batidas.filter((b) => b.marca === "+").length;
    const menos = h.batidas.filter((b) => b.marca === "-").length;
    let veredito = "Marque um + ou um − depois de cada batida. No Final, as marcas dizem como a história fecha.";
    if (mais + menos) {
      if (mais > menos) veredito = "<b>Mais +</b>: o final é melhor. Eles conseguem, e ainda ganham algo a mais.";
      else if (menos > mais) veredito = "<b>Mais −</b>: o final é pior. Eles podem até conseguir, mas pagam um preço.";
      else veredito = "<b>Empatado</b>: o final fica na mão da mesa. Decida pela cena e siga em frente.";
    }
    const corpo = h.modo === "notas"
      ? `<div class="notas-livres"><textarea class="area-texto" data-campo="notas" placeholder="Escreva do jeito que quiser. Tema, lugares, nomes, ideias soltas…" aria-label="Bloco de notas">${esc(h.notas)}</textarea></div>`
      : `<div class="batidas">
          ${BATIDAS.map((b, i) => `<section class="batida">
            <div class="batida__num">${i + 1}<small>${["♠", "♥", "♦", "♣", "♠"][i]}</small></div>
            <div class="batida__corpo">
              <div class="batida__titulo"><strong>${b.nome}</strong><em>${b.dica}</em></div>
              <textarea class="area-texto" data-campo="batida" data-i="${i}" placeholder="${i === 0 ? "Uma frase que joga todo mundo no meio do problema." : "O que acontece aqui?"}" aria-label="${b.nome}">${esc(h.batidas[i].texto)}</textarea>
            </div>
            <div class="batida__marca" role="group" aria-label="Como foi pros jogadores">
              <button type="button" class="mais" data-acao="marca" data-i="${i}" data-marca="+" aria-pressed="${h.batidas[i].marca === "+"}" title="Deu bom pros jogadores">+</button>
              <button type="button" class="menos" data-acao="marca" data-i="${i}" data-marca="-" aria-pressed="${h.batidas[i].marca === "-"}" title="Deu ruim pros jogadores">−</button>
            </div>
          </section>`).join("")}
        </div>
        <div class="placar">
          <div class="placar__conta"><span class="m">${mais} +</span> · <span class="n">${menos} −</span></div>
          <p>${veredito}</p>
        </div>
        <div class="preparo">
          <label class="campo"><span>Três segredos soltos</span>
            ${h.preparo.segredos.map((s, i) => `<input class="entrada-texto" data-campo="segredo" data-i="${i}" value="${esc(s)}" placeholder="Segredo ${i + 1}">`).join("")}
          </label>
          <label class="campo"><span>Um lugar</span>
            <textarea class="area-texto" data-campo="lugar" placeholder="Um nome e três detalhes.">${esc(h.preparo.lugar)}</textarea>
          </label>
          <div class="dica"><b>Preparo em 5 minutos</b>Um Começo, três segredos, um lugar, um oponente e as cinco batidas. O resto você improvisa.</div>
        </div>`;

    app.innerHTML = `<section class="pagina">
      ${cabecaHistoria(h, "historia")}
      <div class="historia-topo">
        <div class="abas" role="group" aria-label="Jeito de escrever">
          <button type="button" data-acao="modo" data-modo="batidas" aria-pressed="${h.modo !== "notas"}">Cinco batidas</button>
          <button type="button" data-acao="modo" data-modo="notas" aria-pressed="${h.modo === "notas"}">Bloco de notas</button>
        </div>
        <span class="salvo" id="salvo"></span>
      </div>
      ${corpo}
    </section>`;
  }

  function telaEsquadroes(h) {
    marcarSecao("esquadroes", navHistoria(h, "esquadroes"));
    app.innerHTML = `<section class="pagina">
      ${cabecaHistoria(h, "esquadroes")}
      <div class="pagina__cabeca" style="margin-top:0">
        <h2 class="rotulo-secao">Esquadrões <small>cada um com um tema e os oponentes de cima pra baixo</small></h2>
        <div class="pagina__acoes"><a class="btn btn--vermelho" href="#h-${h.id}-esq-novo">＋ Novo esquadrão</a></div>
      </div>
      <div class="grade-esquadroes">
        ${h.esquadroes.map((e) => `<article class="ficha-esq">
          <div class="ficha-esq__cabeca"><strong>${esc(e.tema || "Sem tema")}</strong><span>${e.jogadores} jog.</span></div>
          <ul>${e.oponentes.length ? e.oponentes.map((o) => `<li><span>${esc(o.nome)}</span><span class="mono">${TIER[o.tier].nome}${o.tier === "fraco" && o.gangue ? " · Gangue" : ""}</span></li>`).join("") : `<li><span class="linha__nota">Nenhum oponente ainda.</span></li>`}</ul>
          <div class="ficha-esq__acoes">
            <a class="btn btn--mini btn--escuro" href="#h-${h.id}-esq-${e.id}">Abrir</a>
            <button class="btn btn--mini" type="button" data-acao="copiar-texto" data-esq="${e.id}">Copiar texto</button>
            <button class="btn btn--mini" type="button" data-acao="duplicar-esq" data-esq="${e.id}">Duplicar</button>
            <button class="btn btn--mini" type="button" data-acao="apagar-esq" data-esq="${e.id}">Apagar</button>
          </div>
        </article>`).join("")}
        <a class="ficha-nova" href="#h-${h.id}-esq-novo"><big>＋</big>Novo esquadrão</a>
      </div>
    </section>`;
  }

  // ---------------------------------------------------------------- editor de esquadrão (rascunho)
  let rascunho = null; // { hid, esqId, novo, dados, sujo }

  function abrirRascunho(h, esqId) {
    if (rascunho && rascunho.hid === h.id && rascunho.esqId === esqId) return rascunho;
    if (esqId === "novo") {
      const e = novoEsquadrao();
      rascunho = { hid: h.id, esqId: "novo", novo: true, dados: e, sujo: false };
    } else {
      const e = h.esquadroes.find((x) => x.id === esqId);
      if (!e) return null;
      rascunho = { hid: h.id, esqId, novo: false, dados: copia(e), sujo: false };
    }
    return rascunho;
  }

  function marcarSujo() {
    if (!rascunho) return;
    rascunho.sujo = true;
    const el = $("#estado-esq");
    if (el) { el.textContent = "● alterações não salvas"; el.classList.add("sujo"); }
  }

  // Cola do mestre: texto curto pra bater o olho durante a luta (Livro de Oponentes, págs. 2–3).
  const NAIPES_COLA = [
    ["Caído", "n-caido", "Não sai do lugar até o fim do próximo turno dele. Antes, você pode empurrar ele até 2 espaços."],
    ["Atordoado", "n-atordoado", "A próxima rolagem dele tem Desvantagem."],
    ["Ardendo", "n-ardendo", "Perde 1 de Vida na hora. A Couraça não reduz."],
    ["Exposto", "n-exposto", "O próximo golpe nele não pode ser defendido, só Interceptado."],
    ["Roubo", "n-roubo", "Leva um item, a voz ou a visão. A perícia que precisa disso fica com Desvantagem. Pleno nele devolve."],
  ];
  const FORMA_CURTA = {
    "Explosão": ["Dano do tier em todos na área.", "Metade do dano."],
    "Pânico": ["2 Naipes em todos na área, sem dano.", "Só o Naipe com !."],
    "Reforço": ["Entra uma Gangue de Fracos, 1 membro por jogador.", "Metade dos membros."],
    "Terreno": ["O lugar vira perigo até o “Para se”. Quem começa o turno ali sofre o Naipe.", "Dura só até o fim da próxima rodada."],
    "Captura": ["Um alvo sai do mapa e perde 1 de Vida por turno. Só age pra se soltar (Pleno sai).", "O alvo só fica Caído."],
  };
  let colaAberta = true;
  document.addEventListener("toggle", (ev) => { if (ev.target.id === "cola") colaAberta = ev.target.open; }, true);

  function colaDoMestre(e) {
    const especiais = [];
    e.oponentes.forEach((op) => {
      const m = MOLDE[op.molde];
      m.pecas.forEach((p, i) => {
        if (p.tipo !== "especial" || !pecaVisivel(p, op.tier)) return;
        especiais.push({ op, p, nome: op.nomesPecas[i] || p.nome, dano: TIER[op.tier].dano, chefao: op.tier === "chefao" });
      });
    });
    const quadrados = Math.max(2, e.jogadores);
    const listaEsp = especiais.length
      ? especiais.map(({ op, p, nome, dano, chefao }) => {
          const [acontece, metade] = FORMA_CURTA[p.forma] || FORMA_CURTA["Explosão"];
          return `<li class="cola__esp">
            <div class="cola__esp-topo"><b>${esc(nome)}</b><span class="cola__forma">${esc(p.forma)}</span><span class="cola__dono">${esc(op.nome)}</span></div>
            <p>${efeitoHTML(p.efeito, dano)}</p>
            <p class="cola__regra"><b>Faz:</b> ${esc(acontece)} <b>Pela metade:</b> ${esc(metade)}</p>
            ${p.para_se ? `<p class="cola__regra"><b>Para se</b> ${esc(p.para_se)} <span class="apagado">(${quadrados + (chefao ? 1 : 0)} quadradinhos)</span></p>` : ""}
          </li>`;
        }).join("")
      : `<li class="cola__vazio">Nenhum Especial ainda. Só Forte e Chefão têm (e o Kabum do Explosivo, em qualquer tier).</li>`;
    return `<details class="cola" id="cola" ${colaAberta ? "open" : ""}>
      <summary><span>Cola do mestre</span><small>Naipes e Especiais deste esquadrão</small></summary>
      <div class="cola__corpo">
        <section>
          <h3>Naipes do oponente</h3>
          <p class="cola__nota">Duram até o fim do próximo turno do jogador. Repetido não soma, só renova. Com <b>!</b> passa mesmo no Parcial da Defesa.</p>
          <ul class="cola__naipes">${NAIPES_COLA.map(([n, cls, txt]) => `<li><b class="${cls}">${n}</b><span>${txt}</span></li>`).join("")}</ul>
        </section>
        <section>
          <h3>Especiais</h3>
          <p class="cola__nota"><b>Turno 1:</b> anuncia, se planta e mostra a área. <b>Turno 2:</b> acontece primeiro, sem gastar ação; quem saiu da área escapa. <b>Parar:</b> Pleno risca 2, Parcial risca 1. Riscou tudo cancela, riscou algum fica pela metade.</p>
          <ul class="cola__especiais">${listaEsp}</ul>
        </section>
      </div>
    </details>`;
  }

  function telaEsquadrao(h, esqId) {
    const r = abrirRascunho(h, esqId);
    if (!r) { location.hash = `#h-${h.id}-esquadroes`; return; }
    marcarSecao("esquadrao", navHistoria(h, "esquadroes"));
    const e = r.dados;
    app.innerHTML = `<section class="pagina">
      ${cabecaHistoria(h, "esquadroes")}
      <div class="barra-salvar">
        <span class="barra-salvar__estado ${r.sujo ? "sujo" : ""}" id="estado-esq">${r.sujo ? "● alterações não salvas" : r.novo ? "esquadrão novo" : "tudo salvo"}</span>
        <div class="barra-salvar__fim">
          <a class="btn btn--leve" href="#h-${h.id}-esquadroes">Voltar</a>
          <button class="btn btn--petroleo" type="button" data-acao="explorar">＋ Moldes</button>
          <button class="btn btn--vermelho" type="button" data-acao="salvar-esq">Salvar esquadrão</button>
        </div>
      </div>
      <div class="editor-cabeca">
        <label class="campo"><span>Tema do esquadrão</span>
          <input class="entrada-texto" data-campo="tema" value="${esc(e.tema)}" placeholder="Batalha na praia">
        </label>
        <div class="campo"><span>Jogadores na mesa</span>
          <div class="contador">
            <button type="button" data-acao="jogadores" data-delta="-1" aria-label="Menos um jogador">−</button>
            <output id="n-jog">${e.jogadores}</output>
            <button type="button" data-acao="jogadores" data-delta="1" aria-label="Mais um jogador">+</button>
          </div>
        </div>
        <div class="campo"><span>Oponentes</span><strong style="font-size:22px">${e.oponentes.length}</strong></div>
      </div>
      ${colaDoMestre(e)}
      <div class="lista-oponentes">
        ${e.oponentes.map((op, i) => cartaoOponente(op, i, e.oponentes.length, e.jogadores)).join("")}
        <button class="adicionar-grande" type="button" data-acao="explorar">＋ Escolher moldes pra este esquadrão</button>
      </div>
    </section>`;
    if (r.novo && !e.oponentes.length && !r.explorouUmaVez) {
      r.explorouUmaVez = true;
      abrirExplorador();
    }
  }

  function salvarEsquadrao() {
    const h = historia(rascunho.hid);
    if (!h) return;
    const dados = copia(rascunho.dados);
    dados.atualizado = agora();
    if (rascunho.novo) {
      h.esquadroes.push(dados);
    } else {
      const i = h.esquadroes.findIndex((x) => x.id === dados.id);
      if (i >= 0) h.esquadroes[i] = dados; else h.esquadroes.push(dados);
    }
    tocar(h);
    if (!gravar()) return;
    const eraNovo = rascunho.novo;
    rascunho = { hid: h.id, esqId: dados.id, novo: false, dados: copia(dados), sujo: false };
    toast("Esquadrão salvo na história.");
    if (eraNovo) {
      pularGuarda = true;
      location.replace(`#h-${h.id}-esq-${dados.id}`);
    } else {
      const el = $("#estado-esq");
      if (el) { el.textContent = "tudo salvo"; el.classList.remove("sujo"); }
    }
  }

  function textoEsquadrao(e) {
    const linhas = [`ESQUADRÃO: ${e.tema || "Sem tema"} (${e.jogadores} jogadores)`, ""];
    e.oponentes.forEach((op) => {
      const m = MOLDE[op.molde];
      const t = TIER[op.tier];
      const v = vidaDe(op, e.jogadores);
      linhas.push(`${op.nome.toUpperCase()} · ${t.nome}${op.tier === "fraco" && op.gangue ? " (Gangue, " + v.extra + ")" : ""} · ${POS_NOME[m.posicao]}`);
      linhas.push(`Vida ${v.valor} · Moral ${op.moral} · Dano ${t.dano} · ${t.acoes} ${t.acoes > 1 ? "ações" : "ação"}`);
      if (op.frase) linhas.push(`“${op.frase}”`);
      if (op.quer) linhas.push(`QUER ${op.quer}`);
      linhas.push(`NA LUTA ${m.na_luta}`);
      if (m.nao_pega) linhas.push(`NÃO PEGA ${m.nao_pega.naipe}: ${m.nao_pega.motivo}`);
      m.pecas.forEach((p, i) => {
        if (!pecaVisivel(p, op.tier)) return;
        const nome = (op.nomesPecas[i] || p.nome) + (p.tipo === "especial" && p.forma !== "Explosão" ? ` (${p.forma})` : "");
        const ef = p.efeito.replace(/(^|[\s(])D(?=[\s.,]|$)/g, `$1${t.dano}`);
        linhas.push(`  ${TIPO_NOME[p.tipo].toUpperCase()}  ${nome}: ${ef}${p.nota ? ` (${p.nota})` : ""}${p.para_se ? ` ⟶ Para se ${p.para_se}` : ""}`);
      });
      linhas.push("");
    });
    return linhas.join("\n");
  }

  // ---------------------------------------------------------------- explorador de moldes
  // view "moldes": a grade (com os Combos Prontos no fim) · view "combo": um preset aberto.
  const exp = { aberto: false, cat: "todas", busca: "", sel: [], view: "moldes", combo: null, praCombo: false };
  const COMBO = Object.fromEntries((M.combos || []).map((c) => [c.id, c]));
  const ENCONTRO = Object.fromEntries((M.encontros || []).map((e) => [e.id, e]));
  const PAPEL_NOME = { maioria: "Maioria", destaque: "Destaque", extra: "Extra" };

  const semAcento = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const jogadoresAgora = () => (rascunho ? rascunho.dados.jogadores : 4);

  function abrirExplorador() {
    exp.aberto = true;
    exp.sel = [];
    exp.busca = "";
    exp.view = "moldes";
    exp.combo = null;
    exp.praCombo = false;
    desenharExplorador();
    document.body.style.overflow = "hidden";
    setTimeout(() => $(".explorador__busca")?.focus(), 30);
  }
  function fecharExplorador() {
    exp.aberto = false;
    modalRaiz.innerHTML = "";
    document.body.style.overflow = "";
  }
  function moldesFiltrados() {
    const b = semAcento(exp.busca.trim());
    return M.moldes.filter((m) => {
      if (exp.cat === "combos") return false;
      if (exp.cat !== "todas" && m.categoria !== exp.cat) return false;
      if (!b) return true;
      return semAcento([m.nome, m.resumo, m.na_luta, String(m.numero), ...m.pecas.map((p) => p.nome + " " + p.efeito)].join(" ")).includes(b);
    });
  }
  function combosFiltrados() {
    if (exp.praCombo) return [];
    if (exp.cat !== "todas" && exp.cat !== "combos") return [];
    const b = semAcento(exp.busca.trim());
    return M.combos.filter((c) => !b || semAcento([c.nome, MOLDE[c.maioria].nome, MOLDE[c.destaque].nome].join(" ")).includes(b));
  }

  // --- combo (preset)
  /** Quantidade e tier de Maioria/Destaque pela tabela "Quantos" da Referência do Árbitro. */
  function aplicarEncontro(combo, encId) {
    const enc = ENCONTRO[encId];
    const col = Math.min(3, Math.max(0, jogadoresAgora() - 2));
    combo.encontro = encId;
    combo.linhas.forEach((l) => {
      if (l.papel === "maioria") {
        l.tier = enc.maioria.tier;
        l.gangue = enc.maioria.gangue;
        l.qtd = enc.maioria.qtd[col];
      } else if (l.papel === "destaque") {
        l.tier = enc.destaque ? enc.destaque.tier : "medio";
        l.gangue = false;
        l.qtd = enc.destaque ? enc.destaque.qtd : 0;
      }
    });
  }
  function abrirCombo(id) {
    const c = COMBO[id];
    exp.combo = {
      id: c.id,
      nome: c.nome,
      encontro: "padrao",
      linhas: [
        { molde: c.maioria, papel: "maioria", tier: "medio", qtd: 1, gangue: false },
        { molde: c.destaque, papel: "destaque", tier: "medio", qtd: 1, gangue: false },
      ],
    };
    aplicarEncontro(exp.combo, "padrao");
    exp.view = "combo";
    exp.praCombo = false;
    exp.sel = [];
    desenharExplorador();
  }
  function totalCombo(combo) {
    return combo.linhas.reduce((s, l) => s + l.qtd, 0);
  }

  function cartaoCombo(c) {
    const a = MOLDE[c.maioria];
    const d = MOLDE[c.destaque];
    return `<article class="combo-ficha" data-acao="abrir-combo" data-combo="${c.id}" tabindex="0" role="button" aria-label="Abrir combo ${esc(c.nome)}">
      <div class="combo-ficha__cabeca"><strong>${esc(c.nome)}</strong><span aria-hidden="true">→</span></div>
      <div class="combo-ficha__linha"><span class="tag">Maioria</span><b>${esc(a.nome)}</b><span class="mono">${a.numero}</span></div>
      <div class="combo-ficha__linha"><span class="tag tag--especial">Destaque</span><b>${esc(d.nome)}</b><span class="mono">${d.numero}</span></div>
    </article>`;
  }

  function gradeExplorador() {
    if (exp.view === "combo") return telaCombo();
    const lista = moldesFiltrados();
    const combos = combosFiltrados();
    if (!lista.length && !combos.length) return `<p class="vazio">Nada com “${esc(exp.busca)}”.</p>`;
    let html = "";
    if (exp.praCombo) {
      html += `<div class="aviso-combo">Escolhendo moldes pra juntar ao combo <b>${esc(exp.combo.nome)}</b>. Clique nos cartões e depois em “Juntar ao combo”.</div>`;
    }
    M.categorias.forEach((c) => {
      const daCat = lista.filter((m) => m.categoria === c.id);
      if (!daCat.length) return;
      html += `<div class="explorador__cat-titulo" id="cat-${c.id}"><strong>${c.numero} ${esc(c.nome)}</strong><em>${esc(c.descricao)}</em></div>`;
      html += daCat.map((m) => cartaoMolde(m, { selecionado: exp.sel.includes(m.id) })).join("");
    });
    if (combos.length) {
      html += `<div class="explorador__cat-titulo" id="cat-combos"><strong>♣ Combos prontos</strong><em>Maioria + Destaque. Referência do Árbitro, pág. 5</em></div>`;
      html += `<div class="combos-grade">${combos.map(cartaoCombo).join("")}</div>`;
    }
    return `<div class="explorador__grade">${html}</div>`;
  }

  function telaCombo() {
    const c = exp.combo;
    const jog = jogadoresAgora();
    const segEnc = M.encontros.map((e) =>
      `<button type="button" data-acao="encontro" data-encontro="${e.id}" aria-pressed="${c.encontro === e.id}" title="${esc(e.descricao)}">${esc(e.nome)}</button>`).join("");
    const enc = ENCONTRO[c.encontro];
    const linhas = c.linhas.map((l, i) => {
      const m = MOLDE[l.molde];
      const segTier = ORDEM_TIER.map((id) =>
        `<button type="button" data-acao="combo-tier" data-i="${i}" data-tier="${id}" aria-pressed="${l.tier === id}">${TIER[id].nome}</button>`).join("");
      const gangue = l.tier === "fraco"
        ? `<label class="checa"><input type="checkbox" data-campo="combo-gangue" data-i="${i}" ${l.gangue ? "checked" : ""}> Gangue (${jog} membros)</label>` : "";
      return `<div class="combo-linha ${l.qtd === 0 ? "combo-linha--fora" : ""}">
        <div class="combo-linha__barra">
          <span class="combo-linha__papel combo-linha__papel--${l.papel}">${PAPEL_NOME[l.papel]}</span>
          <div class="controle"><span>Quantos</span>
            <div class="contador">
              <button type="button" data-acao="combo-qtd" data-i="${i}" data-delta="-1" aria-label="Menos um ${esc(m.nome)}">−</button>
              <output>${l.qtd}</output>
              <button type="button" data-acao="combo-qtd" data-i="${i}" data-delta="1" aria-label="Mais um ${esc(m.nome)}">+</button>
            </div>
          </div>
          <div class="controle"><span>Tier</span><div class="segmentos">${segTier}</div></div>
          ${gangue}
          ${l.papel === "extra" ? `<button class="btn btn--mini" type="button" data-acao="combo-remover" data-i="${i}">Tirar</button>` : ""}
        </div>
        ${cartaoMolde(m, { estatico: true })}
      </div>`;
    }).join("");
    return `<div class="combo-tela">
      <button class="btn btn--leve" type="button" data-acao="voltar-moldes">← Todos os moldes e combos</button>
      <div class="combo-tela__cabeca">
        <h3>${esc(c.nome)}</h3>
        <p>Maioria (iguais entre si) + Destaque. Quantos pela tabela da Referência do Árbitro, com <b>${jog} jogadores</b>.</p>
        <div class="controle"><span>Que luta você quer?</span><div class="segmentos">${segEnc}</div></div>
        <p class="combo-tela__enc"><b>${esc(enc.nome)}:</b> ${esc(enc.descricao)}.${c.linhas.some((l) => l.gangue) ? " Gangue é um cartão só, com 1 membro por jogador." : ""}</p>
      </div>
      <div class="combo-linhas">${linhas}</div>
      <button class="adicionar-grande" type="button" data-acao="combo-mais-moldes">＋ Adicionar mais moldes a esse grupo</button>
    </div>`;
  }

  function peExplorador() {
    if (exp.view === "combo") {
      const t = totalCombo(exp.combo);
      return `<div class="fichas-sel">${exp.combo.linhas.filter((l) => l.qtd > 0).map((l) =>
          `<span class="fichinha">${l.qtd}× ${esc(MOLDE[l.molde].nome)} · ${TIER[l.tier].nome}${l.tier === "fraco" && l.gangue ? " (Gangue)" : ""}</span>`).join("")}</div>
        <button class="btn btn--leve" type="button" data-acao="fechar-explorador">Cancelar</button>
        <button class="btn btn--vermelho" type="button" data-acao="adicionar-combo" ${t ? "" : "disabled"}>Adicionar ao esquadrão (${t})</button>`;
    }
    if (exp.praCombo) {
      return `<div class="fichas-sel">${exp.sel.map((id) => `<span class="fichinha">${esc(MOLDE[id].nome)}</span>`).join("") || `<span class="mono">Escolha os moldes que vão entrar no combo.</span>`}</div>
        <button class="btn btn--leve" type="button" data-acao="voltar-combo">Voltar pro combo</button>
        <button class="btn btn--vermelho" type="button" data-acao="juntar-ao-combo" ${exp.sel.length ? "" : "disabled"}>Juntar ao combo (${exp.sel.length})</button>`;
    }
    return `<div class="fichas-sel">${exp.sel.length
      ? exp.sel.map((id) => `<span class="fichinha">${esc(MOLDE[id].nome)}</span>`).join("")
      : `<span class="mono">Clique nos cartões pra escolher, ou abra um combo pronto lá embaixo.</span>`}</div>
      <button class="btn btn--leve" type="button" data-acao="fechar-explorador">Cancelar</button>
      <button class="btn btn--vermelho" type="button" data-acao="adicionar-moldes" ${exp.sel.length ? "" : "disabled"}>Adicionar ao esquadrão (${exp.sel.length})</button>`;
  }
  function desenharExplorador() {
    const cats = [["todas", "★", "Todos", "moldes e combos"], ...M.categorias.map((c) => [c.id, c.numero, c.nome, c.descricao])];
    if (!exp.praCombo) cats.push(["combos", "♣", "Combos prontos", "Maioria + Destaque"]);
    const ativa = exp.view === "combo" ? "combos" : exp.cat;
    modalRaiz.innerHTML = `<div class="explorador" role="dialog" aria-modal="true" aria-label="Moldes">
      <div class="explorador__topo">
        <h2>Moldes<small>${exp.praCombo ? "juntando ao combo " + esc(exp.combo.nome) : "36 jeitos de lutar e 21 combos prontos."}</small></h2>
        ${exp.view === "combo" ? "" : `<input class="entrada-texto explorador__busca" type="search" data-campo="busca" placeholder="Buscar: veneno, voador, Tumba…" value="${esc(exp.busca)}">
        <button class="btn btn--mini" type="button" data-acao="d66" title="Rolar um molde aleatório">Rolar d66</button>`}
        <button class="btn btn--mini btn--escuro" type="button" data-acao="fechar-explorador" aria-label="Fechar">✕</button>
      </div>
      <nav class="explorador__lado" aria-label="Categorias">
        ${cats.map(([id, n, nome, desc]) => `<button type="button" class="cat-btn" data-acao="cat" data-cat="${id}" aria-pressed="${ativa === id}"><b>${n}</b><strong>${esc(nome)}</strong><small>${esc(desc)}</small></button>`).join("")}
      </nav>
      <div class="explorador__principal" id="exp-grade">${gradeExplorador()}</div>
      <div class="explorador__pe" id="exp-pe">${peExplorador()}</div>
    </div>`;
  }
  function atualizarExplorador({ grade = true } = {}) {
    if (grade) {
      const el = $("#exp-grade");
      const y = el.scrollTop;
      el.innerHTML = gradeExplorador();
      el.scrollTop = y;
    }
    $("#exp-pe").innerHTML = peExplorador();
  }

  // ---------------------------------------------------------------- modais simples
  function modalNovaHistoria() {
    modalRaiz.innerHTML = `<div class="modal-fundo" data-acao="fechar-modal">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh-t">
        <form id="form-nova">
          <h2 id="mh-t">Nova história</h2>
          <p class="sub">Dê um nome. Dá pra mudar depois.</p>
          <label class="campo"><span>Nome da história</span>
            <input class="entrada-texto" name="nome" required maxlength="80" placeholder="O defunto que serve cafezinho" autocomplete="off">
          </label>
          <div class="modal__acoes">
            <button class="btn btn--leve" type="button" data-acao="fechar-modal">Cancelar</button>
            <button class="btn btn--vermelho" type="submit">Continuar</button>
          </div>
        </form>
      </div>
    </div>`;
    setTimeout(() => $("#form-nova input")?.focus(), 20);
  }
  function modalPrimeiroPasso(h) {
    modalRaiz.innerHTML = `<div class="modal-fundo">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mp-t">
        <h2 id="mp-t">O que escrever primeiro?</h2>
        <p class="sub">“${esc(h.nome)}” está criada. Por onde você quer começar?</p>
        <div class="escolhas">
          <button class="escolha" type="button" data-acao="primeiro" data-para="historia" data-id="${h.id}">
            <span class="escolha__naipe">♠</span><strong>História</strong>
            <span>As cinco batidas: Começo, Complicação, Reviravolta, Crise e Final. Ou um bloco de notas livre.</span>
          </button>
          <button class="escolha" type="button" data-acao="primeiro" data-para="oponentes" data-id="${h.id}">
            <span class="escolha__naipe">♣</span><strong>Oponentes</strong>
            <span>Explore os moldes, escolha o tier de cada um e monte um esquadrão com tema.</span>
          </button>
        </div>
      </div>
    </div>`;
  }
  let resolverConfirmacao = null;
  /** Confirmação dentro da página (o navegador às vezes bloqueia confirm()). */
  function confirmar(msg, textoSim = "Confirmar") {
    responderConfirmacao(false);
    modalRaiz.innerHTML = `<div class="modal-fundo" data-acao="confirmar-nao">
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mc-t">
        <h2 id="mc-t">Tem certeza?</h2>
        <p class="sub">${esc(msg)}</p>
        <div class="modal__acoes">
          <button class="btn btn--leve" type="button" data-acao="confirmar-nao">Cancelar</button>
          <button class="btn btn--vermelho" type="button" data-acao="confirmar-sim">${esc(textoSim)}</button>
        </div>
      </div>
    </div>`;
    setTimeout(() => $('[data-acao="confirmar-sim"]')?.focus(), 20);
    return new Promise((res) => { resolverConfirmacao = res; });
  }
  function responderConfirmacao(valor) {
    const r = resolverConfirmacao;
    resolverConfirmacao = null;
    if (!r) return;
    modalRaiz.innerHTML = "";
    r(valor);
  }
  function modalTexto(titulo, sub, texto, nomeArquivo) {
    modalRaiz.innerHTML = `<div class="modal-fundo" data-acao="fechar-modal">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt-t">
        <h2 id="mt-t">${esc(titulo)}</h2>
        <p class="sub">${esc(sub)}</p>
        <textarea class="area-texto mono" id="texto-modal" rows="12" readonly>${esc(texto)}</textarea>
        <div class="modal__acoes">
          <button class="btn btn--leve" type="button" data-acao="fechar-modal">Fechar</button>
          ${nomeArquivo ? `<button class="btn" type="button" data-acao="baixar-texto" data-nome="${esc(nomeArquivo)}">Baixar arquivo</button>` : ""}
          <button class="btn btn--vermelho" type="button" data-acao="copiar-modal">Copiar</button>
        </div>
      </div>
    </div>`;
    setTimeout(() => $("#texto-modal")?.select(), 20);
  }
  function fecharModal() {
    if (resolverConfirmacao) return responderConfirmacao(false);
    modalRaiz.innerHTML = "";
  }

  // ---------------------------------------------------------------- roteador
  let hashAnterior = location.hash;
  let pularGuarda = false;
  let voltandoSemRender = false;

  function rota() {
    // Endereços simples (#historias, #h-ID-historia, #h-ID-esq-ID): funcionam em qualquer lugar.
    const partes = location.hash.replace(/^#\/?/, "").split(/[-/]/).filter(Boolean);
    return { partes };
  }

  function render() {
    if (exp.aberto) fecharExplorador();
    fecharModal();
    if (!usuario) return telaLogin();
    const { partes } = rota();
    if (partes[0] === "historias") return telaHistorias();
    if (partes[0] === "h" && partes[1]) {
      const h = historia(partes[1]);
      if (!h) { location.replace("#historias"); return; }
      if (partes[2] === "esquadroes") return telaEsquadroes(h);
      if (partes[2] === "esq" && partes[3]) return telaEsquadrao(h, partes[3]);
      return telaHistoria(h);
    }
    return telaEntrada();
  }

  function saindoDoEditor(novoHash) {
    if (!rascunho) return false;
    const p = novoHash.replace(/^#\/?/, "").split(/[-/]/).filter(Boolean);
    return !(p[0] === "h" && p[1] === rascunho.hid && p[2] === "esq" && p[3] === rascunho.esqId);
  }

  window.addEventListener("hashchange", () => {
    const novo = location.hash;
    if (voltandoSemRender) {
      voltandoSemRender = false;
      hashAnterior = novo;
      return;
    }
    if (pularGuarda) {
      pularGuarda = false;
    } else if (rascunho && rascunho.sujo && saindoDoEditor(novo)) {
      voltandoSemRender = true;
      location.hash = hashAnterior;
      confirmar("O esquadrão tem alterações não salvas. Sair e perder essas mudanças?", "Sair sem salvar").then((ok) => {
        if (!ok) return;
        rascunho.sujo = false;
        location.hash = novo;
      });
      return;
    }
    if (saindoDoEditor(novo)) rascunho = null;
    hashAnterior = novo;
    render();
    window.scrollTo(0, 0);
  });
  window.addEventListener("beforeunload", (ev) => {
    if (rascunho && rascunho.sujo) { ev.preventDefault(); ev.returnValue = ""; }
  });

  // ---------------------------------------------------------------- eventos
  const mostrarSalvo = debounce(() => {
    const el = $("#salvo");
    if (el) el.textContent = "salvo ✓";
  }, 450);
  const gravarDepois = debounce(() => { gravar(); }, 350);

  function historiaAtual() {
    const { partes } = rota();
    return partes[0] === "h" ? historia(partes[1]) : null;
  }
  function oponenteDe(el) {
    const box = el.closest("[data-uid]");
    if (!box || !rascunho) return [null, -1];
    const i = rascunho.dados.oponentes.findIndex((o) => o.uid === box.dataset.uid);
    return [rascunho.dados.oponentes[i], i];
  }
  function rerenderEditor() {
    const y = window.scrollY;
    const abertos = [...document.querySelectorAll(".oponente__mais[open]")].map((d) => d.closest("[data-uid]")?.dataset.uid);
    render();
    abertos.forEach((uid) => { const d = $(`[data-uid="${uid}"] .oponente__mais`); if (d) d.open = true; });
    window.scrollTo(0, y);
  }

  document.addEventListener("click", (ev) => {
    const alvo = ev.target.closest("[data-acao]");
    if (!alvo) return;
    const acao = alvo.dataset.acao;

    // fundo do modal: só fecha se clicou fora da caixa
    if ((acao === "fechar-modal" || acao === "confirmar-nao") && alvo.classList.contains("modal-fundo") && ev.target !== alvo) return;

    switch (acao) {
      case "modo-login":
        modoLogin = alvo.dataset.modo;
        telaLogin(normalizarEmail($("#login-email")?.value));
        break;
      case "sair": {
        const fazer = () => { sair(); modoLogin = "entrar"; if (location.hash !== "#inicio") { pularGuarda = true; location.hash = "#inicio"; } else render(); };
        if (rascunho && rascunho.sujo) confirmar("O esquadrão tem alterações não salvas. Sair da conta mesmo assim?", "Sair").then((ok) => ok && fazer());
        else fazer();
        break;
      }
      case "comecar":
        location.hash = "#historias";
        break;
      case "nova-historia":
        modalNovaHistoria();
        break;
      case "fechar-modal":
        fecharModal();
        break;
      case "primeiro": {
        const h = historia(alvo.dataset.id);
        fecharModal();
        if (!h) break;
        location.hash = alvo.dataset.para === "oponentes" ? `#h-${h.id}-esq-novo` : `#h-${h.id}-historia`;
        break;
      }
      case "apagar-historia": {
        ev.preventDefault();
        ev.stopPropagation();
        const h = historia(alvo.dataset.id);
        if (h) confirmar(`Apagar “${h.nome}” e todos os esquadrões dela? Não tem volta.`, "Apagar").then((ok) => {
          if (!ok) return;
          db.historias = db.historias.filter((x) => x.id !== h.id);
          gravar();
          render();
          toast("História apagada.");
        });
        break;
      }
      case "exportar":
        modalTexto("Backup das histórias", "Guarde esse texto num arquivo .json. Pra trazer de volta, use Importar.",
          JSON.stringify({ app: "saga-arbitro", versao: 1, historias: db.historias }, null, 2),
          `saga-historias-${new Date().toISOString().slice(0, 10)}.json`);
        break;
      case "baixar-texto": {
        const blob = new Blob([$("#texto-modal").value], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = alvo.dataset.nome;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        break;
      }
      case "copiar-modal": {
        const ta = $("#texto-modal");
        ta.select();
        (navigator.clipboard?.writeText(ta.value) || Promise.reject())
          .then(() => toast("Copiado."))
          .catch(() => toast("Texto selecionado: use Ctrl+C."));
        break;
      }
      case "confirmar-sim":
      case "confirmar-nao":
        responderConfirmacao(acao === "confirmar-sim");
        break;
      case "modo": {
        const h = historiaAtual();
        if (!h) break;
        h.modo = alvo.dataset.modo;
        tocar(h);
        gravar();
        render();
        break;
      }
      case "marca": {
        const h = historiaAtual();
        if (!h) break;
        const b = h.batidas[+alvo.dataset.i];
        b.marca = b.marca === alvo.dataset.marca ? "" : alvo.dataset.marca;
        tocar(h);
        gravar();
        const y = window.scrollY;
        render();
        window.scrollTo(0, y);
        break;
      }
      case "apagar-esq": {
        const h = historiaAtual();
        const e = h?.esquadroes.find((x) => x.id === alvo.dataset.esq);
        if (e) confirmar(`Apagar o esquadrão “${e.tema || "Sem tema"}”?`, "Apagar").then((ok) => {
          if (!ok) return;
          h.esquadroes = h.esquadroes.filter((x) => x !== e);
          tocar(h);
          gravar();
          render();
        });
        break;
      }
      case "duplicar-esq": {
        const h = historiaAtual();
        const e = h?.esquadroes.find((x) => x.id === alvo.dataset.esq);
        if (!e) break;
        const c = copia(e);
        c.id = novoId();
        c.tema = (e.tema || "Sem tema") + " (cópia)";
        c.oponentes.forEach((o) => { o.uid = novoId(); });
        h.esquadroes.push(c);
        tocar(h);
        gravar();
        render();
        toast("Esquadrão duplicado.");
        break;
      }
      case "copiar-texto": {
        const h = historiaAtual();
        const e = h?.esquadroes.find((x) => x.id === alvo.dataset.esq);
        if (!e) break;
        const txt = textoEsquadrao(e);
        (navigator.clipboard?.writeText(txt) || Promise.reject())
          .then(() => toast("Cartões copiados como texto."))
          .catch(() => modalTexto("Cartões em texto", "Selecione e copie.", txt));
        break;
      }

      // editor
      case "explorar":
        abrirExplorador();
        break;
      case "salvar-esq":
        salvarEsquadrao();
        break;
      case "jogadores": {
        const e = rascunho.dados;
        e.jogadores = Math.min(10, Math.max(1, e.jogadores + +alvo.dataset.delta));
        marcarSujo();
        rerenderEditor();
        break;
      }
      case "tier": {
        const [op] = oponenteDe(alvo);
        if (!op) break;
        op.tier = alvo.dataset.tier;
        marcarSujo();
        rerenderEditor();
        break;
      }
      case "vida":
      case "vida-cheia": {
        const [op] = oponenteDe(alvo);
        if (!op) break;
        const max = vidaDe(op, rascunho.dados.jogadores).valor;
        op.vida = acao === "vida-cheia" ? null : Math.min(max, Math.max(0, vidaAtual(op, max) + +alvo.dataset.delta));
        if (op.vida === max) op.vida = null;
        marcarSujo();
        rerenderEditor();
        break;
      }
      case "moral": {
        const [op] = oponenteDe(alvo);
        if (!op) break;
        op.moral = +alvo.dataset.moral;
        marcarSujo();
        rerenderEditor();
        break;
      }
      case "subir":
      case "descer": {
        const [op, i] = oponenteDe(alvo);
        if (!op) break;
        const lista = rascunho.dados.oponentes;
        const j = acao === "subir" ? i - 1 : i + 1;
        if (j < 0 || j >= lista.length) break;
        [lista[i], lista[j]] = [lista[j], lista[i]];
        marcarSujo();
        rerenderEditor();
        break;
      }
      case "duplicar": {
        const [op, i] = oponenteDe(alvo);
        if (!op) break;
        const c = copia(op);
        c.uid = novoId();
        rascunho.dados.oponentes.splice(i + 1, 0, c);
        marcarSujo();
        rerenderEditor();
        break;
      }
      case "remover": {
        const [op, i] = oponenteDe(alvo);
        if (!op) break;
        rascunho.dados.oponentes.splice(i, 1);
        marcarSujo();
        rerenderEditor();
        break;
      }

      // explorador
      case "fechar-explorador":
        fecharExplorador();
        break;
      case "cat":
        exp.cat = alvo.dataset.cat;
        exp.view = "moldes";
        desenharExplorador();
        $("#exp-grade").scrollTop = 0;
        break;
      case "alternar-molde": {
        const id = alvo.dataset.molde;
        exp.sel = exp.sel.includes(id) ? exp.sel.filter((x) => x !== id) : [...exp.sel, id];
        const sel = exp.sel.includes(id);
        alvo.classList.toggle("sel", sel);
        alvo.setAttribute("aria-pressed", String(sel));
        alvo.querySelector(".escolhivel__marca").textContent = sel ? "✓" : "+";
        atualizarExplorador({ grade: false });
        break;
      }
      case "d66": {
        const a = 1 + Math.floor(Math.random() * 6);
        const b = 1 + Math.floor(Math.random() * 6);
        const m = M.moldes.find((x) => x.numero === a * 10 + b);
        exp.cat = "todas";
        exp.busca = "";
        exp.view = "moldes";
        if (!exp.sel.includes(m.id)) exp.sel.push(m.id);
        desenharExplorador();
        const card = $(`#exp-grade [data-molde="${m.id}"]`);
        card?.scrollIntoView({ block: "center", behavior: "smooth" });
        toast(`d66: ${a}·${b} → ${m.nome}`);
        break;
      }
      case "abrir-combo":
        abrirCombo(alvo.dataset.combo);
        break;
      case "voltar-moldes":
        exp.view = "moldes";
        exp.combo = null;
        exp.cat = "todas";
        desenharExplorador();
        $("#cat-combos")?.scrollIntoView({ block: "start" });
        break;
      case "encontro":
        aplicarEncontro(exp.combo, alvo.dataset.encontro);
        atualizarExplorador();
        break;
      case "combo-tier": {
        const l = exp.combo.linhas[+alvo.dataset.i];
        l.tier = alvo.dataset.tier;
        if (l.tier !== "fraco") l.gangue = false;
        atualizarExplorador();
        break;
      }
      case "combo-qtd": {
        const l = exp.combo.linhas[+alvo.dataset.i];
        l.qtd = Math.min(12, Math.max(0, l.qtd + +alvo.dataset.delta));
        atualizarExplorador();
        break;
      }
      case "combo-remover":
        exp.combo.linhas.splice(+alvo.dataset.i, 1);
        atualizarExplorador();
        break;
      case "combo-mais-moldes":
        exp.view = "moldes";
        exp.praCombo = true;
        exp.cat = "todas";
        exp.busca = "";
        exp.sel = [];
        desenharExplorador();
        break;
      case "voltar-combo":
        exp.view = "combo";
        exp.praCombo = false;
        exp.sel = [];
        desenharExplorador();
        break;
      case "juntar-ao-combo": {
        const n = exp.sel.length;
        exp.sel.forEach((id) => exp.combo.linhas.push({ molde: id, papel: "extra", tier: "medio", qtd: 1, gangue: false }));
        exp.view = "combo";
        exp.praCombo = false;
        exp.sel = [];
        desenharExplorador();
        const g = $("#exp-grade");
        g.scrollTop = g.scrollHeight;
        toast(`${n} ${n === 1 ? "molde entrou" : "moldes entraram"} no combo.`);
        break;
      }
      case "adicionar-combo": {
        if (!rascunho) break;
        const c = exp.combo;
        let n = 0;
        c.linhas.forEach((l) => {
          for (let k = 1; k <= l.qtd; k++) {
            const op = novoOponente(l.molde, { tier: l.tier, gangue: l.tier === "fraco" && l.gangue });
            if (l.qtd > 1) op.nome = `${op.nome} ${k}`;
            rascunho.dados.oponentes.push(op);
            n++;
          }
        });
        if (!rascunho.dados.tema.trim()) rascunho.dados.tema = c.nome;
        fecharExplorador();
        marcarSujo();
        rerenderEditor();
        toast(`Combo ${c.nome}: ${n} ${n === 1 ? "oponente adicionado" : "oponentes adicionados"}. Não esqueça de salvar.`);
        break;
      }
      case "adicionar-moldes": {
        if (!rascunho || !exp.sel.length) break;
        const n = exp.sel.length;
        exp.sel.forEach((id) => rascunho.dados.oponentes.push(novoOponente(id)));
        fecharExplorador();
        marcarSujo();
        rerenderEditor();
        toast(`${n} ${n === 1 ? "molde adicionado" : "moldes adicionados"}. Não esqueça de salvar.`);
        break;
      }
    }
  });

  // teclado nos cartões do explorador
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (exp.aberto) fecharExplorador();
      else if (modalRaiz.innerHTML) fecharModal();
      return;
    }
    if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches?.(".escolhivel, .combo-ficha")) {
      ev.preventDefault();
      ev.target.click();
    }
  });

  document.addEventListener("submit", async (ev) => {
    if (ev.target.id === "form-login") {
      ev.preventDefault();
      const f = ev.target;
      const erro = $("#login-erro");
      const botao = f.querySelector(".login__enviar");
      const email = normalizarEmail(f.email.value);
      const senha = f.senha.value;
      const criar = f.dataset.modo === "criar";
      let msg = "";
      if (!emailValido(email)) msg = "Escreva um e-mail válido, tipo voce@email.com.";
      else if (!senha) msg = "Escreva a senha.";
      else if (criar && senha.length < 6) msg = "A senha precisa de pelo menos 6 caracteres.";
      else if (criar && senha !== f.senha2.value) msg = "As duas senhas não estão iguais.";
      else if (!window.crypto?.subtle) msg = "Este navegador não consegue proteger a senha. Abra o site em https ou num navegador atualizado.";
      if (msg) { erro.textContent = msg; return; }
      erro.textContent = "";
      botao.disabled = true;
      try {
        if (criar) await criarConta(email, senha); else await fazerLogin(email, senha);
        modoLogin = null;
        toast(criar ? "Conta criada. Bem-vindo à mesa." : "Login feito.");
        if (location.hash && location.hash !== "#inicio") location.hash = "#inicio"; else render();
      } catch (e) {
        erro.textContent = e.message || "Não deu certo. Tente de novo.";
        botao.disabled = false;
      }
      return;
    }
    if (ev.target.id !== "form-nova") return;
    ev.preventDefault();
    const nome = new FormData(ev.target).get("nome").toString().trim();
    if (!nome) return;
    const h = novaHistoria(nome);
    db.historias.push(h);
    gravar();
    modalPrimeiroPasso(h);
  });

  document.addEventListener("input", (ev) => {
    const el = ev.target;
    const campo = el.dataset?.campo;
    if (!campo) return;

    // explorador
    if (campo === "busca") {
      exp.busca = el.value;
      atualizarExplorador();
      return;
    }

    // história (salva sozinha)
    const h = historiaAtual();
    const naHistoria = { "nome-historia": 1, batida: 1, notas: 1, segredo: 1, lugar: 1 };
    if (h && naHistoria[campo]) {
      if (campo === "nome-historia") h.nome = el.value || "História sem nome";
      if (campo === "batida") h.batidas[+el.dataset.i].texto = el.value;
      if (campo === "notas") h.notas = el.value;
      if (campo === "segredo") h.preparo.segredos[+el.dataset.i] = el.value;
      if (campo === "lugar") h.preparo.lugar = el.value;
      tocar(h);
      const s = $("#salvo");
      if (s) s.textContent = "salvando…";
      gravarDepois();
      mostrarSalvo();
      return;
    }

    // esquadrão (vai pro rascunho, salva no botão)
    if (!rascunho) return;
    if (campo === "tema") {
      rascunho.dados.tema = el.value;
      marcarSujo();
      return;
    }
    const [op] = oponenteDe(el);
    if (!op) return;
    if (campo === "nome") op.nome = el.value;
    if (campo === "frase") op.frase = el.value;
    if (campo === "quer") op.quer = el.value;
    if (campo === "peca") {
      op.nomesPecas[+el.dataset.i] = el.value;
      el.size = Math.max(6, el.value.length + 1);
    }
    marcarSujo();
  });

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset?.campo === "combo-gangue" && exp.combo) {
      exp.combo.linhas[+el.dataset.i].gangue = el.checked;
      atualizarExplorador();
      return;
    }
    if (el.dataset?.campo === "gangue") {
      const [op] = oponenteDe(el);
      if (!op) return;
      op.gangue = el.checked;
      marcarSujo();
      rerenderEditor();
    }
    if (el.dataset?.campo === "importar" && el.files?.[0]) {
      el.files[0].text().then((txt) => {
        const dados = JSON.parse(txt);
        const lista = Array.isArray(dados?.historias) ? dados.historias : null;
        if (!lista) throw new Error("formato");
        let n = 0;
        lista.forEach((h) => {
          if (!h || !h.id || !Array.isArray(h.esquadroes) || !Array.isArray(h.batidas)) return;
          if (historia(h.id)) h.id = novoId();
          db.historias.push(h);
          n++;
        });
        gravar();
        render();
        toast(`${n} ${n === 1 ? "história importada" : "histórias importadas"}.`);
      }).catch(() => toast("Esse arquivo não parece um backup do SAGA."));
    }
  });

  window.addEventListener("resize", debounce(desenharVinhas, 150));

  // ---------------------------------------------------------------- início
  desenharVinhas();
  render();
})();
