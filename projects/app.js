/* =========================================================
   Projetos v3 — lógica da interface
   Novidades: pesquisa na pasta, filtro por tipo (imagens/vídeos/outros),
   categorias, ícones de pasta, seleção múltipla, agrupar e desagrupar,
   exportação (projeto, pasta ou seleção; zip ou lista .txt) e vídeo no visualizador.
   Sem dados de exemplo: a tela começa vazia.
   Projetos: Projetos.setProjects([...]). Arquivos: Projetos.setFiles(id, [...]).
   Ícones e categorias: Projetos.setMeta(id, { "caminho/da/pasta": { icon, category } }).
   ========================================================= */

/* ---------- 1. CONFIGURAÇÃO (edite aqui os textos, categorias e ícones) ---------- */
const CONFIG = {
  user: {
    name: "",          // nome do usuário logado
    email: "",         // e-mail do usuário logado
    initials: ""       // iniciais para o avatar (ex.: "CK")
  },
  brand: { name: "", version: "" },
  pageTitle: "All projects",
  newProjectLabel: "New project",
  recentLabel: "Recent projects",
  listLabel: "All projects",
  filtersLabel: "Filters",
  searchPlaceholder: "",
  tabs: {
    all:       "View all",
    recent:    "Recent",
    favorites: "Favorites",
    shared:    "Shared",
    archived:  "Archived"
  },
  empty: {
    title: "No projects found",
    textWithSearch: 'Your search "{query}" did not match any projects. Please try again.',
    textNoSearch: "You don't have any projects yet.",
    clearSearch: "Clear search"
  },
  // Pastas e arquivos que a importação ignora (não entram na árvore nem no envio)
  skipPattern: /(^|\/)(node_modules|\.git|\.DS_Store|Thumbs\.db|__pycache__|\.idea|\.vscode)(\/|$)/,
  imageExt: /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i,
  videoExt: /\.(mp4|webm|mov|mkv|avi|m4v)$/i,
  recentLimit: 3,        // quantos cards aparecem em "Recent projects"
  // Categorias sugeridas (o usuário também pode criar as suas)
  categories: ["Arte", "Código", "Documentos", "Áudio", "Referências", "Outros"],
  // Ícones que a pasta pode usar (ids são símbolos SVG definidos no index.html)
  folderIcons: [
    { id: "folder",  label: "Padrão" },
    { id: "image",   label: "Imagens" },
    { id: "film",    label: "Vídeos" },
    { id: "music",   label: "Áudio" },
    { id: "code",    label: "Código" },
    { id: "palette", label: "Arte" },
    { id: "file",    label: "Documentos" },
    { id: "star",    label: "Favoritos" },
    { id: "lock",    label: "Privado" },
    { id: "box",     label: "Pacote" },
    { id: "game",    label: "Jogo" },
    { id: "flask",   label: "Testes" }
  ],
  nav: {
    // Para ligar um item do menu a uma página, troque o "#" pela URL.
    home: "#", "my-projects": "#", projects: "#", "all-files": "#",
    team: "#", appearance: "#", "open-browser": "#", support: "#", settings: "#"
  }
};

/* ---------- 2. DADOS ----------
   Projeto: { id, name, files: number, members: ["iniciais"], favorite, shared, archived, updatedAt }
   Arquivo ou pasta (por projeto):
     { path: "site/index.html", type: "file" | "folder", size: bytes, mime?, url? }
   Em importações, o nó também leva "file" (File do navegador) para pré-visualizar e baixar.
   Metadados (ícone e categoria), por projeto e caminho:
     META[id]["site/imagens"] = { icon: "image", category: "Arte" } */
let PROJECTS = [];
const FILES = {};            // id do projeto -> lista de nós
const META = {};             // id do projeto -> { caminho: { icon?, category? } }
const EXPANDED = new Set();  // "id|pasta" abertas na árvore

/* ---------- 3. ESTADO ---------- */
const state = {
  tab: "all",          // aba ativa
  query: "",           // texto da busca de projetos
  openId: null,        // projeto aberto na tela de árvore
  importing: null,     // { name, nodes, skipped } enquanto a tela de importação está aberta
  importTarget: null,  // id do projeto quando a importação é "para dentro" de um projeto existente
  lbList: [],          // imagens e vídeos da árvore atual, para navegar no visualizador
  lbIndex: 0,
  treeQuery: "",       // pesquisa dentro do projeto
  typeFilter: "all",   // all | image | video | other
  catFilter: "",       // categoria selecionada ("" = todas)
  selectMode: false,   // modo de seleção múltipla
  selected: new Set(), // caminhos selecionados
  vidList: []          // vídeos visíveis na árvore (para o player)
};

/* ---------- 4. HELPERS ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function icon(id, cls = "ic") {
  return `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
}
function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}
function parentOf(path) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}
function baseOf(path) {
  return path.slice(path.lastIndexOf("/") + 1);
}
function safeName(text) {
  return String(text || "").replace(/[\\/:*?"<>|]+/g, "-").trim() || "projeto";
}
function isImage(node) {
  if (node.type !== "file") return false;
  return (node.mime && node.mime.startsWith("image/")) || CONFIG.imageExt.test(node.path);
}
function isVideo(node) {
  if (node.type !== "file") return false;
  return (node.mime && node.mime.startsWith("video/")) || CONFIG.videoExt.test(node.path);
}
/* "image" | "video" | null (só para arquivos de mídia) */
function mediaKind(node) {
  if (!node || node.type !== "file") return null;
  if (isImage(node)) return "image";
  if (isVideo(node)) return "video";
  return null;
}
/* "folder" | "image" | "video" | "other" */
function typeOf(node) {
  if (node.type === "folder") return "folder";
  return mediaKind(node) || "other";
}
function imageSrc(node) {
  if (node.url) return node.url;
  if (node.file) {
    if (!node._blobUrl) node._blobUrl = URL.createObjectURL(node.file);
    return node._blobUrl;
  }
  return "";
}
function project(id) { return PROJECTS.find((p) => p.id === id); }

/* ---- metadados (ícone e categoria) ---- */
function metaOf(id, path) {
  return (META[id] && META[id][path]) || {};
}
/* Atualiza ícone/categoria. Valor vazio (ou ícone "folder") remove o campo. */
function setMeta(id, path, patch) {
  META[id] = META[id] || {};
  const next = Object.assign({}, META[id][path] || {}, patch);
  Object.keys(next).forEach((k) => {
    if (next[k] === "" || next[k] == null || (k === "icon" && next[k] === "folder")) delete next[k];
  });
  if (Object.keys(next).length) META[id][path] = next;
  else delete META[id][path];
}
/* Remove metadados de um caminho e de tudo que estiver dentro dele */
function dropMeta(id, path) {
  const m = META[id];
  if (!m) return;
  Object.keys(m).forEach((k) => { if (k === path || k.startsWith(path + "/")) delete m[k]; });
}
function usedCategories(id) {
  const set = new Set();
  Object.values(META[id] || {}).forEach((m) => { if (m.category) set.add(m.category); });
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
function allCategories(id) {
  return [...new Set([...CONFIG.categories, ...usedCategories(id)])];
}

/* Filtra por aba e busca (lista de projetos) */
function visibleProjects() {
  const q = state.query.trim().toLowerCase();
  return PROJECTS.filter((p) => {
    const tabOk =
      state.tab === "all" ||
      (state.tab === "recent" && !p.archived) ||
      (state.tab === "favorites" && p.favorite) ||
      (state.tab === "shared" && p.shared) ||
      (state.tab === "archived" && p.archived);
    const queryOk = !q || String(p.name).toLowerCase().includes(q);
    return tabOk && queryOk;
  });
}

/* ---------- 5. TELA PRINCIPAL (lista) ---------- */

function renderStaticText() {
  $("#user-avatar").textContent = CONFIG.user.initials;
  $("#user-name").textContent = CONFIG.user.name;
  $("#user-mail").textContent = CONFIG.user.email;
  $("#brand-name").textContent = CONFIG.brand.name;
  $("#brand-version").textContent = CONFIG.brand.version;
  $("#page-title").textContent = CONFIG.pageTitle;
  $("#btn-new-project").lastChild.textContent = CONFIG.newProjectLabel;
  $("#btn-new-project-empty").lastChild.textContent = CONFIG.newProjectLabel;
  $("#recent-label").textContent = CONFIG.recentLabel;
  $("#list-label").textContent = CONFIG.listLabel;
  $("#btn-filters").lastChild.textContent = CONFIG.filtersLabel;
  $("#search-input").placeholder = CONFIG.searchPlaceholder;
  $("#btn-clear-search").lastChild.textContent = CONFIG.empty.clearSearch;
  $("#empty-title").textContent = CONFIG.empty.title;

  $$(".tab").forEach((t) => (t.querySelector("span").textContent = CONFIG.tabs[t.dataset.tab]));
  $$(".sub-item").forEach((s) => {
    const key = s.dataset.filter;
    s.firstChild.textContent = CONFIG.tabs[key] + " ";
  });
  $$("[data-nav]").forEach((a) => {
    a.setAttribute("href", CONFIG.nav[a.dataset.nav] || "#");
  });
}

function renderCounts() {
  const count = {
    all: PROJECTS.length,
    recent: PROJECTS.filter((p) => !p.archived).length,
    favorites: PROJECTS.filter((p) => p.favorite).length,
    shared: PROJECTS.filter((p) => p.shared).length,
    archived: PROJECTS.filter((p) => p.archived).length
  };
  $$("[data-count]").forEach((b) => (b.textContent = count[b.dataset.count] ?? 0));
}

function cardHtml(p) {
  const members = (p.members || []).slice(0, 3).map(() => "<span></span>").join("");
  return `
    <div class="card" data-id="${escapeHtml(p.id)}">
      <div class="folder">${icon("folder", "ic ic-sm")}</div>
      <div class="card-info">
        <div class="card-name">${escapeHtml(p.name)}</div>
        <div class="card-meta">${icon("files", "ic ic-sm")}${p.files ?? 0} files
          <span class="stack">${members}</span>
        </div>
      </div>
      <button class="card-more" aria-label="Mais ações">${icon("more", "ic ic-sm")}</button>
    </div>`;
}

function rowHtml(p) {
  return `
    <div class="project-row" data-id="${escapeHtml(p.id)}">
      <div class="folder">${icon("folder", "ic ic-sm")}</div>
      <div class="card-info">
        <div class="card-name">${escapeHtml(p.name)}</div>
        <div class="card-meta">${icon("files", "ic ic-sm")}${p.files ?? 0} files</div>
      </div>
      <button class="card-more" aria-label="Mais ações">${icon("more", "ic ic-sm")}</button>
    </div>`;
}

function renderRecent() {
  const recent = PROJECTS.filter((p) => !p.archived).slice(0, CONFIG.recentLimit);
  $("#recent-grid").innerHTML = recent.map(cardHtml).join("");
  $("#recent-grid").parentElement.hidden = recent.length === 0;
}

function renderList() {
  const items = visibleProjects();
  $("#project-list").innerHTML = items.map(rowHtml).join("");
  const isEmpty = items.length === 0;
  $("#empty-state").hidden = !isEmpty;
  if (isEmpty) {
    const hasQuery = state.query.trim() !== "";
    $("#empty-text").textContent = hasQuery
      ? CONFIG.empty.textWithSearch.replace("{query}", state.query)
      : CONFIG.empty.textNoSearch;
    $("#btn-clear-search").hidden = !hasQuery;
  }
}

function renderActive() {
  $$(".tab").forEach((t) => {
    const on = t.dataset.tab === state.tab;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", on);
  });
  $$(".sub-item").forEach((s) => s.classList.toggle("is-active", s.dataset.filter === state.tab));
}

function renderMain() {
  renderCounts();
  renderRecent();
  renderActive();
  renderList();
}

/* ---------- 6. ÁRVORE DE ARQUIVOS ---------- */

/* Há pesquisa, filtro de tipo ou de categoria ativo? */
function filtersActive() {
  return !!(state.treeQuery.trim() || state.catFilter || state.typeFilter !== "all");
}

/* Um nó combina com os filtros? (pasta não entra por tipo, só como "pai" de um arquivo) */
function nodeMatches(id, n) {
  const q = state.treeQuery.trim().toLowerCase();
  if (q && !baseOf(n.path).toLowerCase().includes(q)) return false;
  if (state.catFilter && metaOf(id, n.path).category !== state.catFilter) return false;
  if (state.typeFilter !== "all") {
    if (n.type === "folder") return false;
    if (typeOf(n) !== state.typeFilter) return false;
  }
  return true;
}

/* Caminhos que aparecem: os que combinam e todas as pastas acima deles */
function visibleSet(id, nodes) {
  const set = new Set();
  nodes.forEach((n) => {
    if (!nodeMatches(id, n)) return;
    let p = n.path;
    while (p) { set.add(p); p = parentOf(p); }
  });
  return set;
}

/* Transforma a lista de nós em linhas achatadas, respeitando pastas abertas.
   Com filtros ativos, mostra só o que combina e abre todas as pastas. */
function flattenTree(projectId, nodes, useFilters = false) {
  const active = useFilters && filtersActive();
  const vis = active ? visibleSet(projectId, nodes) : null;
  const kids = new Map();
  nodes.forEach((n) => {
    const p = parentOf(n.path);
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(n);
  });
  const rows = [];
  (function walk(parent, depth) {
    const list = (kids.get(parent) || [])
      .filter((n) => !vis || vis.has(n.path))
      .slice()
      .sort((a, b) =>
        a.type === b.type ? baseOf(a.path).localeCompare(baseOf(b.path), "pt-BR") : (a.type === "folder" ? -1 : 1)
      );
    list.forEach((n) => {
      rows.push({ n, depth });
      const open = n.type === "folder" && (active || EXPANDED.has(`${projectId}|${n.path}`));
      if (open) walk(n.path, depth + 1);
    });
  })("", 0);
  return rows;
}

function childCount(nodes, folder) {
  return nodes.filter((n) => parentOf(n.path) === folder).length;
}

function treeRowHtml(projectId, nodes, n, depth, editable) {
  const pad = 12 + depth * 18;
  const isFolder = n.type === "folder";
  const open = isFolder && (EXPANDED.has(`${projectId}|${n.path}`) || (editable && filtersActive()));
  const m = editable ? metaOf(projectId, n.path) : {};
  const isSel = editable && state.selected.has(n.path);

  const check = editable && state.selectMode
    ? `<button class="check ${isSel ? "is-on" : ""}" data-select="${escapeHtml(n.path)}" aria-label="Selecionar ${escapeHtml(baseOf(n.path))}" aria-pressed="${isSel}">${isSel ? icon("check", "ic ic-sm") : ""}</button>`
    : "";
  const chev = isFolder
    ? `<button class="chev ${open ? "is-open" : ""}" data-toggle="${escapeHtml(n.path)}" aria-label="${open ? "Fechar" : "Abrir"}">${icon("chev-right", "ic ic-sm")}</button>`
    : `<span class="chev-space"></span>`;

  const kind = mediaKind(n);
  const p = escapeHtml(n.path);
  const snip = isText(n) ? (queueSnippet(n), `<div class="txt-prev" data-snip="${p}">${txtPreviewHtml(n._snip)}</div>`) : "";
  let thumb;
  if (kind === "image") {
    const src = imageSrc(n);
    thumb = src
      ? `<button class="thumb-btn" data-lb="${p}" aria-label="Ver imagem"><img class="thumb" src="${escapeHtml(src)}" alt="" loading="lazy"></button>`
      : `<span class="thumb-ph">${icon("image", "ic ic-sm")}</span>`;
  } else if (kind === "video") {
    queueVideoThumb(n);
    thumb = `<button class="thumb-btn" data-lb="${p}" aria-label="Ver vídeo"><span class="thumb-vid"><span class="thumb-vid-in" data-vid="${p}">${n._thumb ? `<img src="${n._thumb}" alt="">` : icon("play", "ic ic-sm")}</span><span class="thumb-dur" data-vdur="${p}">${n._dur ? fmtTime(n._dur) : ""}</span></span></button>`;
  } else if (isAudio(n)) {
    thumb = `<button class="thumb-btn" data-audio="${p}" aria-label="Ouvir">${audioBtnHtml(n.path)}</button>`;
  } else if (isText(n)) {
    thumb = `<span class="thumb-ph text">${icon("file", "ic ic-sm")}</span>`;
  } else if (isFolder) {
    thumb = folderStackHtml(nodes, n.path, m.icon);
  } else {
    thumb = `<span class="thumb-ext">${escapeHtml(extOf(n.path))}</span>`;
  }

  const count = isFolder ? childCount(nodes, n.path) : 0;
  const meta = isFolder ? (count === 1 ? "1 item" : `${count} itens`) : fmtSize(n.size);
  const catTag = m.category ? `<span class="cat-tag">${escapeHtml(m.category)}</span>` : "";
  const actions = editable ? `
      <button class="row-btn" data-rename="${escapeHtml(n.path)}" aria-label="Renomear" title="Renomear">${icon("edit", "ic ic-sm")}</button>
      <button class="row-btn" data-move="${escapeHtml(n.path)}" aria-label="Mover" title="Mover">${icon("move", "ic ic-sm")}</button>
      <button class="row-btn danger" data-delete="${escapeHtml(n.path)}" aria-label="Excluir" title="Excluir">${icon("trash", "ic ic-sm")}</button>
      <button class="row-btn" data-more="${escapeHtml(n.path)}" data-pop-open aria-label="Mais ações" title="Mais ações">${icon("more", "ic ic-sm")}</button>` : "";

  return `
    <div class="trow ${isSel ? "is-sel" : ""} ${isFolder ? "is-folder" : ""}" data-path="${escapeHtml(n.path)}" style="padding-left:${pad}px">
      ${check}${chev}${thumb}
      <div class="trow-name">${escapeHtml(baseOf(n.path))}${snip}</div>
      ${catTag}
      <div class="trow-meta">${escapeHtml(meta)}</div>
      <div class="trow-actions">${actions}</div>
    </div>`;
}

function renderTree() {
  const id = state.openId;
  const nodes = FILES[id] || [];
  const rows = flattenTree(id, nodes, true);
  $("#tree").innerHTML = rows.map(({ n, depth }) => treeRowHtml(id, nodes, n, depth, true)).join("");
  $("#tree-empty").hidden = rows.length > 0;
  $("#tree-empty p").textContent = filtersActive()
    ? "Nenhum item corresponde à pesquisa ou aos filtros."
    : "Este projeto ainda não tem arquivos.";
  const p = project(id);
  $("#proj-name").textContent = p ? p.name : "";
  const files = nodes.filter((n) => n.type === "file").length;
  const folders = nodes.filter((n) => n.type === "folder").length;
  $("#proj-meta").textContent = `${files} arquivos · ${folders} pastas`;
  // o visualizador percorre só as imagens e vídeos que estão visíveis na árvore
  state.lbList = rows.map((r) => r.n).filter((n) => mediaKind(n) === "image");
  state.vidList = rows.map((r) => r.n).filter((n) => mediaKind(n) === "video");
  renderToolbar();
  renderSelBar();
}

/* Barra de pesquisa, filtros de tipo e categorias */
function renderToolbar() {
  const id = state.openId;
  const search = $("#tree-search");
  if (search.value !== state.treeQuery) search.value = state.treeQuery;
  $$("#type-chips [data-type]").forEach((b) => {
    const on = b.dataset.type === state.typeFilter;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", on);
  });
  const counts = {};
  Object.values(META[id] || {}).forEach((m) => {
    if (m.category) counts[m.category] = (counts[m.category] || 0) + 1;
  });
  const cats = Object.keys(counts).sort((a, b) => a.localeCompare(b, "pt-BR"));
  $("#cat-chips").innerHTML = cats.length
    ? cats.map((c) => `<button class="chip-f ${state.catFilter === c ? "is-on" : ""}" data-cat-filter="${escapeHtml(c)}" aria-pressed="${state.catFilter === c}">${escapeHtml(c)} <small>${counts[c]}</small></button>`).join("")
    : `<span class="muted-note">Nenhuma categoria ainda. Use "Categoria" no menu ⋯ de uma pasta ou arquivo.</span>`;
  const sb = $("#btn-select");
  sb.classList.toggle("is-on", state.selectMode);
  sb.setAttribute("aria-pressed", state.selectMode);
}

/* Barra de ações da seleção múltipla */
function renderSelBar() {
  const bar = $("#sel-bar");
  bar.hidden = !state.selectMode;
  const n = state.selected.size;
  $("#sel-count").textContent = n ? `${n} selecionado${n > 1 ? "s" : ""}` : "Toque nos itens para selecionar";
  bar.querySelectorAll("[data-sel-needs]").forEach((b) => (b.disabled = n === 0));
}

function openProject(id) {
  state.openId = id;
  state.treeQuery = "";
  state.typeFilter = "all";
  state.catFilter = "";
  state.selectMode = false;
  state.selected.clear();
  closePop();
  renderTree();
  showScreen("screen-project");
  document.dispatchEvent(new CustomEvent("projects:open", { detail: { id } }));
}

/* Cria uma linha de entrada logo abaixo da linha indicada (nova pasta / renomear / grupo) */
function inlineInput({ placeholder, value = "", onOk, afterPath }) {
  const tree = $("#tree");
  const row = document.createElement("div");
  row.className = "trow is-input";
  row.innerHTML = `<span class="chev-space"></span><span class="type-ic">${icon("folder", "ic ic-sm")}</span>
    <input class="inline-input" type="text" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" aria-label="${escapeHtml(placeholder)}">
    <div class="trow-actions"><button class="row-btn" data-ok aria-label="Confirmar">${icon("check", "ic ic-sm")}</button><button class="row-btn" data-cancel aria-label="Cancelar">${icon("x", "ic ic-sm")}</button></div>`;
  const anchor = afterPath ? tree.querySelector(`[data-path="${CSS.escape(afterPath)}"]`) : null;
  if (anchor) anchor.after(row); else tree.prepend(row);
  const input = row.querySelector("input");
  input.focus(); input.select();
  const done = (ok) => {
    const name = input.value.trim().replace(/[\\/]/g, "");
    row.remove();
    if (ok && name) onOk(name);
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") done(true);
    if (e.key === "Escape") done(false);
  });
  row.querySelector("[data-ok]").addEventListener("click", () => done(true));
  row.querySelector("[data-cancel]").addEventListener("click", () => done(false));
}

function folderTargets(nodes, exclude) {
  return nodes.filter((n) => n.type === "folder" && !(n.path === exclude || n.path.startsWith(exclude + "/")));
}

function moveRow(path) {
  const id = state.openId;
  const nodes = FILES[id];
  const node = nodes.find((n) => n.path === path);
  const targets = folderTargets(nodes, path);
  const row = $(`#tree [data-path="${CSS.escape(path)}"]`);
  if (!row) return;
  const panel = document.createElement("div");
  panel.className = "trow is-input move-panel";
  panel.innerHTML = `<span class="chev-space"></span><span class="type-ic">${icon("move", "ic ic-sm")}</span>
    <select class="inline-input" aria-label="Mover para">
      <option value="">Raiz do projeto</option>
      ${targets.map((t) => `<option value="${escapeHtml(t.path)}">${escapeHtml(t.path)}</option>`).join("")}
    </select>
    <div class="trow-actions"><button class="row-btn" data-cancel aria-label="Cancelar">${icon("x", "ic ic-sm")}</button></div>`;
  row.after(panel);
  const select = panel.querySelector("select");
  select.focus();
  select.addEventListener("change", () => {
    const dest = select.value;
    const to = dest ? `${dest}/${baseOf(path)}` : baseOf(path);
    panel.remove();
    if (to !== path) moveNode(id, path, to, node.type);
  });
  panel.querySelector("[data-cancel]").addEventListener("click", () => panel.remove());
}

/* Renomeia (e atualiza os filhos, os metadados e as pastas abertas) */
function applyRename(id, from, to) {
  const nodes = FILES[id];
  nodes.forEach((n) => {
    if (n.path === from) n.path = to;
    else if (n.path.startsWith(from + "/")) n.path = to + n.path.slice(from.length);
  });
  const m = META[id];
  if (m) {
    const next = {};
    Object.keys(m).forEach((k) => {
      const nk = k === from ? to : k.startsWith(from + "/") ? to + k.slice(from.length) : k;
      next[nk] = m[k];
    });
    META[id] = next;
  }
  const prefix = `${id}|`;
  [...EXPANDED].forEach((k) => {
    if (!k.startsWith(prefix)) return;
    const p = k.slice(prefix.length);
    if (p === from || p.startsWith(from + "/")) {
      EXPANDED.delete(k);
      EXPANDED.add(prefix + (p === from ? to : to + p.slice(from.length)));
    }
  });
}
function moveNode(id, from, to, type) {
  mutateTree(() => applyRename(id, from, to), { wobble: [to] });
  document.dispatchEvent(new CustomEvent("file:move", { detail: { projectId: id, from, to, type } }));
}
function renameRow(path) {
  const id = state.openId;
  inlineInput({
    placeholder: "Novo nome",
    value: baseOf(path),
    afterPath: path,
    onOk: (name) => {
      const to = parentOf(path) ? `${parentOf(path)}/${name}` : name;
      if (to === path) return renderTree();
      mutateTree(() => applyRename(id, path, to), { wobble: [to] });
      document.dispatchEvent(new CustomEvent("file:rename", { detail: { projectId: id, from: path, to } }));
    }
  });
}

function addFolder(parent) {
  const id = state.openId;
  inlineInput({
    placeholder: "Nome da pasta",
    afterPath: parent || undefined,   // sem pasta-pai: entra no topo da árvore
    onOk: (name) => {
      const path = parent ? `${parent}/${name}` : name;
      const nodes = FILES[id] || (FILES[id] = []);
      if (nodes.some((n) => n.path === path)) return toast("Já existe um item com esse nome");
      mutateTree(() => {
        nodes.push({ path, type: "folder", size: 0 });
        if (parent) EXPANDED.add(`${id}|${parent}`);
      }, { added: [path] });
      document.dispatchEvent(new CustomEvent("file:folder-create", { detail: { projectId: id, path } }));
    }
  });
}

async function deleteRow(path) {
  const id = state.openId;
  const node = FILES[id].find((n) => n.path === path);
  const isFolder = node && node.type === "folder";
  const count = isFolder ? FILES[id].filter((n) => n.path.startsWith(path + "/")).length : 0;
  const text = isFolder
    ? `Excluir a pasta "${baseOf(path)}"${count ? ` e os ${count} itens dentro dela` : ""}?`
    : `Excluir o arquivo "${baseOf(path)}"?`;
  const ok = await ask(text, "Excluir", { danger: true });
  if (!ok) return;
  outThen([path], () => {
    FILES[id] = FILES[id].filter((n) => n.path !== path && !n.path.startsWith(path + "/"));
    dropMeta(id, path);
    state.selected.delete(path);
    renderTree();
  });
  document.dispatchEvent(new CustomEvent("file:delete", { detail: { projectId: id, path, type: node ? node.type : "file" } }));
}

/* ---------- 6b. SELEÇÃO, AGRUPAR E DESAGRUPAR ---------- */

/* Mantém só os caminhos de nível superior (se a pasta está marcada, os filhos não contam) */
function topOf(paths) {
  return paths.filter((p) => !paths.some((q) => q !== p && p.startsWith(q + "/")));
}
function topLevelSelected() {
  return topOf([...state.selected]);
}
function toggleSelect(path) {
  if (state.selected.has(path)) state.selected.delete(path);
  else state.selected.add(path);
  renderTree();
}
function setSelectMode(on) {
  state.selectMode = on;
  if (!on) state.selected.clear();
  closePop();
  renderTree();
}
function selectVisible() {
  $$("#tree .trow[data-path]").forEach((r) => state.selected.add(r.dataset.path));
  renderTree();
}

/* Cria uma pasta nova e move dentro dela os itens selecionados */
function groupSelected() {
  const id = state.openId;
  const nodes = FILES[id] || (FILES[id] = []);
  const top = topLevelSelected();
  if (!top.length) return;
  const parents = new Set(top.map(parentOf));
  const dest = parents.size === 1 ? [...parents][0] : "";
  inlineInput({
    placeholder: "Nome do grupo",
    afterPath: top[0],
    onOk: (name) => {
      const folder = dest ? `${dest}/${name}` : name;
      if (nodes.some((n) => n.path === folder)) return toast("Já existe um item com esse nome");
      nodes.push({ path: folder, type: "folder", size: 0 });
      if (dest) EXPANDED.add(`${id}|${dest}`);
      EXPANDED.add(`${id}|${folder}`);
      mutateTree(() => {
        top.forEach((p) => applyRename(id, p, `${folder}/${baseOf(p)}`));
        state.selected.clear();
      }, { added: [folder] });
      toast(`${top.length} item(ns) agrupados em "${name}"`);
      document.dispatchEvent(new CustomEvent("file:group", { detail: { projectId: id, folder, paths: top } }));
    }
  });
}

/* Nome livre dentro da pasta de destino: "arquivo (2).png", "pasta (2)" ... */
function uniquePath(id, path) {
  const nodes = FILES[id] || [];
  if (!nodes.some((n) => n.path === path)) return path;
  const dir = parentOf(path);
  const name = baseOf(path);
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 2; ; i++) {
    const cand = (dir ? dir + "/" : "") + `${stem} (${i})${ext}`;
    if (!nodes.some((n) => n.path === cand)) return cand;
  }
}

/* Tira a pasta e leva o conteúdo dela para o nível de cima */
async function ungroup(path) {
  const id = state.openId;
  const nodes = FILES[id] || [];
  const dest = parentOf(path);
  const kids = nodes.filter((n) => parentOf(n.path) === path);
  const where = dest ? `"${baseOf(dest)}"` : "a raiz do projeto";
  const ok = await ask(
    `Desagrupar "${baseOf(path)}"? ${kids.length} item(ns) vão para ${where} e a pasta será removida.`,
    "Desagrupar"
  );
  if (!ok) return;
  outThen([path], () => mutateTree(() => {
    kids.forEach((k) => {
      const to = uniquePath(id, dest ? `${dest}/${baseOf(k.path)}` : baseOf(k.path));
      applyRename(id, k.path, to);
    });
    FILES[id] = (FILES[id] || []).filter((n) => n.path !== path);
    dropMeta(id, path);
    state.selected.delete(path);
  }));
  toast(`"${baseOf(path)}" desagrupada`);
  document.dispatchEvent(new CustomEvent("file:ungroup", { detail: { projectId: id, path, moved: kids.length } }));
}

/* Exclui todos os itens selecionados */
async function deleteSelected() {
  const id = state.openId;
  const top = topLevelSelected();
  if (!top.length) return;
  const ok = await ask(`Excluir ${top.length} item(ns) selecionado(s)? Pastas levam o conteúdo junto.`, "Excluir", { danger: true });
  if (!ok) return;
  outThen(top, () => {
    FILES[id] = (FILES[id] || []).filter((n) => !top.some((p) => n.path === p || n.path.startsWith(p + "/")));
    top.forEach((p) => dropMeta(id, p));
    state.selected.clear();
    renderTree();
  });
  document.dispatchEvent(new CustomEvent("file:delete", { detail: { projectId: id, paths: top } }));
}

/* ---------- 6c. ÍCONES, CATEGORIAS E MENUS ---------- */

let pop = null;
function closePop() {
  if (pop) { pop.remove(); pop = null; }
}
/* Abre um menu flutuante junto de um elemento */
function openPop(anchor, html, bind) {
  closePop();
  const el = document.createElement("div");
  el.className = "pop";
  el.innerHTML = html;
  document.body.appendChild(el);
  pop = el;
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
  el.style.left = left + "px";
  el.style.top = top + "px";
  bind(el);
}
function rowAnchor(path) {
  return $(`#tree [data-more="${CSS.escape(path)}"]`) || $("#tree") || document.body;
}

function openRowMenu(anchor, path) {
  const id = state.openId;
  const node = (FILES[id] || []).find((n) => n.path === path);
  if (!node) return;
  const items = [];
  if (node.type === "folder") {
    items.push(["new", "Nova pasta dentro", "folder-plus"]);
    items.push(["icon", "Trocar ícone", "palette"]);
    items.push(["ungroup", "Desagrupar", "split"]);
    items.push(["export", "Exportar esta pasta", "download"]);
  }
  items.push(["cat", "Categoria", "tag"]);
  items.push(["select", "Selecionar", "square"]);
  openPop(anchor, `<div class="menu">${items.map(([a, l, i]) =>
    `<button class="menu-item" data-act="${a}">${icon(i, "ic ic-sm")}<span>${l}</span></button>`).join("")}</div>`, (el) => {
    el.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
      const act = b.dataset.act;
      closePop();
      runRowAction(act, path);
    }));
  });
}

function runRowAction(act, path) {
  if (act === "new") return addFolder(path);
  if (act === "icon") return openIconPicker(path);
  if (act === "ungroup") return ungroup(path);
  if (act === "export") return openExport({ scope: "folder", folder: path });
  if (act === "cat") return openCategoryPicker([path], rowAnchor(path));
  if (act === "select") {
    state.selectMode = true;
    state.selected.add(path);
    renderTree();
  }
}

function openIconPicker(path) {
  const id = state.openId;
  const cur = metaOf(id, path).icon || "folder";
  openPop(rowAnchor(path), `<div class="pop-title">Ícone da pasta</div>
    <div class="icon-grid">${CONFIG.folderIcons.map((i) =>
      `<button class="icon-opt ${i.id === cur ? "is-on" : ""}" data-icon="${i.id}" title="${escapeHtml(i.label)}" aria-label="${escapeHtml(i.label)}">${icon(i.id, "ic")}</button>`).join("")}
    </div>`, (el) => {
    el.querySelectorAll("[data-icon]").forEach((b) => b.addEventListener("click", () => {
      closePop();
      mutateTree(() => setMeta(id, path, { icon: b.dataset.icon }), { wobble: [path] });
      toast("Ícone atualizado");
      document.dispatchEvent(new CustomEvent("file:icon", { detail: { projectId: id, path, icon: b.dataset.icon } }));
    }));
  });
}

/* Escolhe ou cria a categoria de um ou mais itens */
function openCategoryPicker(paths, anchor) {
  const id = state.openId;
  const cur = paths.length === 1 ? metaOf(id, paths[0]).category : null;
  openPop(anchor, `<div class="pop-title">Categoria</div>
    <div class="cat-list">
      <button class="cat-opt ${!cur ? "is-on" : ""}" data-cat="">Sem categoria</button>
      ${allCategories(id).map((c) => `<button class="cat-opt ${c === cur ? "is-on" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}
    </div>
    <form class="cat-new">
      <input type="text" maxlength="24" placeholder="Nova categoria" aria-label="Nova categoria">
      <button class="btn-primary" type="submit"><span>Criar</span></button>
    </form>`, (el) => {
    el.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => {
      closePop();
      applyCategory(paths, b.dataset.cat);
    }));
    el.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = el.querySelector("input").value.trim();
      if (!v) return;
      closePop();
      applyCategory(paths, v);
    });
    el.querySelector("input").focus();
  });
}
function applyCategory(paths, value) {
  const id = state.openId;
  mutateTree(() => paths.forEach((p) => setMeta(id, p, { category: value || "" })), { wobble: paths });
  toast(value ? `Categoria: ${value}` : "Categoria removida");
  document.dispatchEvent(new CustomEvent("file:category", { detail: { projectId: id, paths, category: value || null } }));
}

/* ---------- 7. IMPORTAÇÃO DE PASTA ---------- */

function buildImport(fileList) {
  const files = Array.from(fileList || []);
  const nodes = new Map();
  const skipped = [];
  let root = "";
  let total = 0;
  files.forEach((f) => {
    const rel = f.webkitRelativePath || f.name;
    if (CONFIG.skipPattern.test(rel)) { skipped.push(rel); return; }
    if (!root) root = rel.split("/")[0];
    // cria as pastas intermediárias
    const parts = rel.split("/");
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join("/");
      if (!nodes.has(dir)) nodes.set(dir, { path: dir, type: "folder", size: 0 });
    }
    nodes.set(rel, { path: rel, type: "file", size: f.size, mime: f.type || "", file: f });
    total += f.size;
  });
  const list = Array.from(nodes.values());
  // na prévia, todas as pastas começam abertas para o usuário ver o que será importado
  list.filter((n) => n.type === "folder").forEach((n) => EXPANDED.add(`import|${n.path}`));
  return { name: root, nodes: list, skipped, total, files: files.length };
}

function renderImport() {
  const imp = state.importing;
  if (!imp) return;
  const folders = imp.nodes.filter((n) => n.type === "folder").length;
  const filesCount = imp.nodes.filter((n) => n.type === "file").length;
  const images = imp.nodes.filter(isImage).length;
  const videos = imp.nodes.filter(isVideo).length;
  $("#import-stats").innerHTML = [
    ["Pasta", imp.name || "—"],
    ["Arquivos", filesCount],
    ["Pastas", folders],
    ["Imagens", images],
    ["Vídeos", videos],
    ["Tamanho", fmtSize(imp.total) || "0 B"]
  ].map(([k, v]) => `<div class="stat"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join("");
  $("#import-note").textContent = imp.skipped.length
    ? `${imp.skipped.length} itens foram ignorados (node_modules, .git e arquivos do sistema).`
    : "";
  // árvore só de leitura, com as primeiras pastas já abertas
  const rows = flattenTree("import", imp.nodes);
  $("#import-tree").innerHTML = rows.map(({ n, depth }) => treeRowHtml("import", imp.nodes, n, depth, false)).join("");
  $("#btn-import-go").disabled = filesCount === 0;
}

function startImport(targetId = null) {
  state.importTarget = targetId;
  state.importing = null;
  closePop();
  $("#folder-input").value = "";
  $("#import-stats").innerHTML = "";
  $("#import-note").textContent = "";
  $("#import-tree").innerHTML = "";
  $("#btn-import-go").disabled = true;
  showScreen("screen-import");
}

function openFolderPicker() { $("#folder-input").click(); }

function finishImport() {
  const imp = state.importing;
  if (!imp || !imp.nodes.some((n) => n.type === "file")) return;
  const targetId = state.importTarget;
  if (targetId) {
    // importa para dentro de um projeto existente
    const nodes = FILES[targetId] || (FILES[targetId] = []);
    imp.nodes.forEach((n) => { if (!nodes.some((m) => m.path === n.path)) nodes.push(n); });
    const p = project(targetId);
    if (p) p.files = nodes.filter((n) => n.type === "file").length;
    document.dispatchEvent(new CustomEvent("project:import", { detail: { projectId: targetId, name: imp.name, nodes: imp.nodes, skipped: imp.skipped } }));
    openProject(targetId);
  } else {
    const id = `imp-${Date.now()}`;
    FILES[id] = imp.nodes;
    PROJECTS.unshift({
      id, name: imp.name || "Novo projeto", files: imp.nodes.filter((n) => n.type === "file").length,
      members: [], favorite: false, shared: false, archived: false, updatedAt: new Date().toISOString()
    });
    imp.nodes.filter((n) => n.type === "folder" && parentOf(n.path) === "").forEach((n) => EXPANDED.add(`${id}|${n.path}`));
    document.dispatchEvent(new CustomEvent("project:import", { detail: { projectId: id, name: imp.name, nodes: imp.nodes, skipped: imp.skipped } }));
    state.importing = null;
    render();
    openProject(id);
  }
  state.importing = null;
}

/* ---------- 8. VISUALIZADOR (imagens e vídeos) ---------- */
function openLightbox(path) {
  const list = state.lbList;
  const idx = list.findIndex((n) => n.path === path);
  if (idx < 0) return;
  state.lbIndex = idx;
  $("#lightbox").hidden = false;
  showLb();
}
function showLb() {
  const node = state.lbList[state.lbIndex];
  if (!node) return;
  const img = $("#lb-img"), vid = $("#lb-video");
  if (mediaKind(node) === "video") {
    img.hidden = true; img.removeAttribute("src");
    vid.hidden = false; vid.src = imageSrc(node);
  } else {
    vid.pause(); vid.hidden = true; vid.removeAttribute("src"); vid.load();
    img.hidden = false; img.src = imageSrc(node);
    img.alt = baseOf(node.path);
  }
  const kind = mediaKind(node) === "video" ? "vídeo" : "imagem";
  $("#lb-cap").textContent = `${baseOf(node.path)} · ${kind} · ${state.lbIndex + 1} de ${state.lbList.length}${node.size ? " · " + fmtSize(node.size) : ""}`;
  $("#lb-prev").hidden = state.lbList.length < 2;
  $("#lb-next").hidden = state.lbList.length < 2;
}
function stepLb(dir) {
  const n = state.lbList.length;
  if (!n) return;
  state.lbIndex = (state.lbIndex + dir + n) % n;
  showLb();
}
function closeLb() {
  $("#lightbox").hidden = true;
  const vid = $("#lb-video");
  vid.pause(); vid.removeAttribute("src"); vid.load();
  $("#lb-img").removeAttribute("src");
}

/* ---------- 9. EXPORTAÇÃO (.zip ou lista .txt, feito no navegador) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/* ZIP sem compressão (método 0), com nomes em UTF-8 */
function makeZip(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  entries.forEach(({ name, data }) => {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true); local.setUint16(10, 0, true); local.setUint16(12, 0x21, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true); local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true); cen.setUint16(12, 0, true); cen.setUint16(14, 0x21, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true);
    cen.setUint16(28, nameBytes.length, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Caminho dentro da exportação: pastas exportadas começam pela própria pasta */
function relPath(path, scope, folder) {
  if (scope !== "folder") return path;
  const pr = parentOf(folder);
  return pr ? path.slice(pr.length + 1) : path;
}
/* Está dentro do escopo escolhido? */
function inScope(path, scope, folder, top) {
  if (scope === "folder") return path === folder || path.startsWith(folder + "/");
  if (scope === "selection") return top.some((p) => path === p || path.startsWith(p + "/"));
  return true;
}

/* Arquivos que a exportação atual vai levar, segundo o modal */
function exportFilter() {
  const id = state.openId;
  const nodes = FILES[id] || [];
  const scopeEl = document.querySelector('input[name="ex-scope"]:checked');
  const scope = scopeEl ? scopeEl.value : "all";
  const folder = $("#ex-folder").value;
  const top = topOf([...state.selected]);
  const types = $$("[data-ex-type]:checked").map((i) => i.dataset.exType);
  const cat = $("#ex-cat").value;
  const files = nodes.filter((n) => {
    if (n.type !== "file") return false;
    if (!inScope(n.path, scope, folder, top)) return false;
    if (!types.includes(typeOf(n))) return false;
    if (cat && metaOf(id, n.path).category !== cat) return false;
    return true;
  });
  return { files, scope, folder, top, nodes };
}

function openExport(opts = {}) {
  const id = state.openId;
  if (!id) return;
  const nodes = FILES[id] || [];
  const folders = nodes.filter((n) => n.type === "folder").sort((a, b) => a.path.localeCompare(b.path, "pt-BR"));
  $("#ex-folder").innerHTML = folders.length
    ? folders.map((f) => `<option value="${escapeHtml(f.path)}">${escapeHtml(f.path)}</option>`).join("")
    : `<option value="">Nenhuma pasta no projeto</option>`;
  $("#ex-cat").innerHTML = `<option value="">Todas as categorias</option>` +
    usedCategories(id).map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  const hasSel = state.selected.size > 0;
  let scope = opts.scope || (hasSel ? "selection" : "all");
  if (scope === "selection" && !hasSel) scope = "all";
  document.querySelector('input[name="ex-scope"][value="selection"]').disabled = !hasSel;
  document.querySelector(`input[name="ex-scope"][value="${scope}"]`).checked = true;
  if (opts.folder) $("#ex-folder").value = opts.folder;
  $$("[data-ex-type]").forEach((i) => (i.checked = true));
  $("#ex-cat").value = "";
  document.querySelector('input[name="ex-format"][value="zip"]').checked = true;
  $("#ex-meta").checked = true;
  $("#export-modal").hidden = false;
  renderExportSummary();
  $("#ex-go").focus();
}
function closeExport() { $("#export-modal").hidden = true; }

function renderExportSummary() {
  const { files } = exportFilter();
  const total = files.reduce((s, f) => s + (f.size || 0), 0);
  const img = files.filter((f) => typeOf(f) === "image").length;
  const vid = files.filter((f) => typeOf(f) === "video").length;
  const oth = files.length - img - vid;
  $("#ex-summary").textContent = files.length
    ? `${files.length} arquivo(s): ${img} imagem(ns), ${vid} vídeo(s), ${oth} outro(s) · ${fmtSize(total) || "0 B"}`
    : "Nenhum arquivo corresponde a esta exportação.";
  $("#ex-go").disabled = files.length === 0;
  const isZip = document.querySelector('input[name="ex-format"]:checked').value === "zip";
  $("#ex-meta-row").hidden = !isZip;
}

/* Metadados (ícones e categorias) das pastas e arquivos exportados */
function metaExport(id, files, scope, folder, top) {
  const paths = new Set();
  files.forEach((f) => {
    let p = parentOf(f.path);
    while (p) { paths.add(p); p = parentOf(p); }
    paths.add(f.path);
  });
  if (scope === "folder") paths.add(folder);
  const itens = [];
  [...paths].filter((p) => inScope(p, scope, folder, top)).forEach((p) => {
    const m = metaOf(id, p);
    if (!m.icon && !m.category) return;
    itens.push({ caminho: relPath(p, scope, folder), icone: m.icon || null, categoria: m.category || null });
  });
  return { projeto: (project(id) || {}).name || "", exportadoEm: new Date().toISOString(), itens };
}

/* Lista de estrutura em texto (.txt) */
function treeText(id, files, scope, folder, top) {
  const nodes = FILES[id] || [];
  const paths = new Set();
  files.forEach((f) => {
    let p = parentOf(f.path);
    while (p) { paths.add(p); p = parentOf(p); }
    paths.add(f.path);
  });
  if (scope === "folder") paths.add(folder);
  const sorted = [...paths].filter((p) => inScope(p, scope, folder, top)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const lines = [
    `Projeto: ${(project(id) || {}).name || ""}`,
    `Exportado em: ${new Date().toLocaleString("pt-BR")}`,
    ""
  ];
  sorted.forEach((p) => {
    const rel = relPath(p, scope, folder);
    const depth = rel.split("/").length - 1;
    const node = nodes.find((n) => n.path === p);
    const isFolder = node && node.type === "folder";
    const m = metaOf(id, p);
    const cat = m.category ? ` [${m.category}]` : "";
    const size = node && node.type === "file" && node.size ? ` (${fmtSize(node.size)})` : "";
    lines.push(`${"  ".repeat(depth)}${isFolder ? "▸ " : "- "}${baseOf(rel)}${isFolder ? "/" : ""}${cat}${size}`);
  });
  return lines.join("\n");
}

async function doExport() {
  const id = state.openId;
  const p = project(id);
  const { files, scope, folder, top } = exportFilter();
  if (!files.length) return;
  const format = document.querySelector('input[name="ex-format"]:checked').value;
  const suffix = scope === "folder" ? "-" + safeName(baseOf(folder)) : scope === "selection" ? "-selecao" : "";
  const base = safeName(p ? p.name : "projeto") + suffix;

  let skipped = 0;
  if (format === "txt") {
    const text = treeText(id, files, scope, folder, top);
    saveBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${base}-estrutura.txt`);
  } else {
    const entries = [];
    for (const n of files) {
      try {
        let blob = null;
        if (n.file) blob = n.file;
        else if (n.url) blob = await fetch(n.url).then((r) => r.blob());
        if (!blob) { skipped++; continue; }
        entries.push({ name: relPath(n.path, scope, folder), data: new Uint8Array(await blob.arrayBuffer()) });
      } catch (e) { skipped++; }
    }
    if (!entries.length) {
      await ask("Não foi possível ler os arquivos desta exportação.", "OK", { only: true });
      return;
    }
    if ($("#ex-meta").checked) {
      const json = JSON.stringify(metaExport(id, files, scope, folder, top), null, 2);
      entries.push({ name: "ximmer-metadados.json", data: new TextEncoder().encode(json) });
    }
    saveBlob(makeZip(entries), `${base}.zip`);
  }
  document.dispatchEvent(new CustomEvent("project:export", {
    detail: { projectId: id, scope, folder: scope === "folder" ? folder : null, format, files: files.length, skipped }
  }));
  closeExport();
}

/* ---------- 10. CARTÃO DE CONFIRMAÇÃO ---------- */
let confirmResolve = null;
function ask(text, okLabel = "OK", opts = {}) {
  $("#confirm-text").textContent = text;
  $("#confirm-ok").lastChild.textContent = okLabel;
  $("#confirm-ok").classList.toggle("danger", !!opts.danger);
  $("#confirm-cancel").hidden = !!opts.only;
  $("#confirm").hidden = false;
  $("#confirm-ok").focus();
  return new Promise((resolve) => { confirmResolve = resolve; });
}
function closeAsk(result) {
  $("#confirm").hidden = true;
  if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(result); }
}

/* Aviso rápido no rodapé */
let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
}

/* ---------- 11. NAVEGAÇÃO ENTRE TELAS ---------- */
function showScreen(id) {
  ["screen-project", "screen-import"].forEach((s) => ($("#" + s).hidden = s !== id));
  $$(".main > .block, .main > .header").forEach((el) => (el.hidden = true));
}
function showMain() {
  ["screen-project", "screen-import"].forEach((s) => ($("#" + s).hidden = true));
  $$(".main > .block, .main > .header").forEach((el) => (el.hidden = false));
  state.openId = null;
  state.selected.clear();
  state.selectMode = false;
  closePop();
  renderMain();
}

/* ---------- 12. EVENTOS ---------- */
function render() { renderMain(); }

function bindEvents() {
  $$(".tab").forEach((t) =>
    t.addEventListener("click", () => { state.tab = t.dataset.tab; renderMain(); })
  );
  $$(".sub-item").forEach((s) =>
    s.addEventListener("click", () => { state.tab = s.dataset.filter; renderMain(); })
  );
  $("#search-input").addEventListener("input", (e) => {
    state.query = e.target.value;
    renderList();
  });
  $("#btn-clear-search").addEventListener("click", () => {
    state.query = "";
    $("#search-input").value = "";
    renderMain();
  });
  const onNew = () => document.dispatchEvent(new CustomEvent("projects:new"));
  $("#btn-new-project").addEventListener("click", onNew);
  $("#btn-new-project-empty").addEventListener("click", onNew);
  $("#btn-import").addEventListener("click", () => startImport(null));

  // Clique em um card ou linha: abre o projeto
  document.addEventListener("click", (e) => {
    const item = e.target.closest(".card, .project-row");
    if (item && !e.target.closest(".card-more")) openProject(item.dataset.id);
  });

  // Fecha menus flutuantes ao clicar fora
  document.addEventListener("mousedown", (e) => {
    if (pop && !pop.contains(e.target) && !e.target.closest("[data-pop-open]")) closePop();
  });

  // Tela do projeto
  $("#btn-back").addEventListener("click", showMain);
  $("#btn-new-folder").addEventListener("click", () => addFolder(""));
  $("#btn-import-into").addEventListener("click", () => startImport(state.openId));
  $("#btn-export").addEventListener("click", () => openExport({}));

  // Pesquisa, filtros e seleção
  $("#tree-search").addEventListener("input", (e) => {
    state.treeQuery = e.target.value;
    renderTree();
  });
  $("#type-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-type]");
    if (!b) return;
    state.typeFilter = b.dataset.type;
    renderTree();
  });
  $("#cat-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat-filter]");
    if (!b) return;
    const c = b.dataset.catFilter;
    state.catFilter = state.catFilter === c ? "" : c;
    renderTree();
  });
  $("#btn-select").addEventListener("click", () => setSelectMode(!state.selectMode));
  $("#sel-bar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sel]");
    if (!b || b.disabled) return;
    const act = b.dataset.sel;
    if (act === "selectVisible") selectVisible();
    if (act === "group") groupSelected();
    if (act === "cat") openCategoryPicker(topLevelSelected(), b);
    if (act === "export") openExport({ scope: "selection" });
    if (act === "delete") deleteSelected();
    if (act === "exit") setSelectMode(false);
  });

  $("#tree").addEventListener("click", (e) => {
    const t = (sel) => e.target.closest(sel);
    let el;
    if ((el = t("[data-select]"))) return toggleSelect(el.dataset.select);
    if ((el = t("[data-toggle]"))) {
      const key = `${state.openId}|${el.dataset.toggle}`;
      mutateTree(() => { EXPANDED.has(key) ? EXPANDED.delete(key) : EXPANDED.add(key); });
      return;
    }
    if ((el = t("[data-audio]"))) {
      const an = (FILES[state.openId] || []).find((x) => x.path === el.dataset.audio);
      if (an) toggleAudio(an);
      return;
    }
    if ((el = t("[data-lb]"))) return openMedia(el.dataset.lb);
    if ((el = t("[data-more]"))) return openRowMenu(el, el.dataset.more);
    if ((el = t("[data-rename]"))) return renameRow(el.dataset.rename);
    if ((el = t("[data-move]"))) return moveRow(el.dataset.move);
    if ((el = t("[data-delete]"))) return deleteRow(el.dataset.delete);
    // com a seleção ligada, clicar na linha marca/desmarca
    const row = t(".trow[data-path]");
    if (row && state.selectMode) return toggleSelect(row.dataset.path);
    // clicar no nome de uma pasta abre ou fecha
    if (row && t(".trow-name") && row.querySelector("[data-toggle]")) row.querySelector("[data-toggle]").click();
  });

  // Modal de exportação
  $("#export-modal").addEventListener("change", renderExportSummary);
  $("#ex-go").addEventListener("click", doExport);
  $("#ex-cancel").addEventListener("click", closeExport);
  $("#ex-close").addEventListener("click", closeExport);
  $("#export-modal").addEventListener("click", (e) => { if (e.target.id === "export-modal") closeExport(); });

  // Tela de importação
  $("#btn-import-back").addEventListener("click", showMain);
  $("#btn-import-cancel").addEventListener("click", () => { state.importing = null; state.importTarget ? openProject(state.importTarget) : showMain(); });
  $("#btn-pick").addEventListener("click", openFolderPicker);
  $("#folder-input").addEventListener("change", (e) => {
    state.importing = buildImport(e.target.files);
    renderImport();
  });
  $("#btn-import-go").addEventListener("click", finishImport);
  $("#import-tree").addEventListener("click", (e) => {
    const el = e.target.closest("[data-toggle]");
    if (!el) return;
    const key = `import|${el.dataset.toggle}`;
    EXPANDED.has(key) ? EXPANDED.delete(key) : EXPANDED.add(key);
    renderImport();
  });

  // Visualizador
  $("#lb-close").addEventListener("click", closeLb);
  $("#lb-prev").addEventListener("click", () => stepLb(-1));
  $("#lb-next").addEventListener("click", () => stepLb(1));
  $("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closeLb(); });
  document.addEventListener("keydown", (e) => {
    if (!$("#player").hidden) { playerKey(e); return; }
    if ($("#lightbox").hidden === false) {
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") stepLb(-1);
      if (e.key === "ArrowRight") stepLb(1);
    } else if ($("#export-modal").hidden === false) {
      if (e.key === "Escape") closeExport();
    } else if ($("#confirm").hidden === false) {
      if (e.key === "Escape") closeAsk(false);
      if (e.key === "Enter") closeAsk(true);
    } else if (pop && e.key === "Escape") {
      closePop();
    }
  });

  bindPlayer();

  // Cartão de confirmação
  $("#confirm-ok").addEventListener("click", () => closeAsk(true));
  $("#confirm-cancel").addEventListener("click", () => closeAsk(false));
}

/* ---------- 8b. ANIMAÇÕES DA ÁRVORE ---------- */
function reduceMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
/* Guarda onde cada linha estava antes de mudar a árvore */
function snapshotRows() {
  const map = new Map();
  $$("#tree .trow[data-path]").forEach((r) => map.set(r.dataset.path, r.getBoundingClientRect()));
  return map;
}
/* Depois de renderizar: linhas novas entram, as reorganizadas deslizam, as marcadas balançam */
function animateRows(before, { added = [], wobble = [] } = {}) {
  if (reduceMotion()) return;
  const addSet = new Set(added), wobSet = new Set(wobble);
  $$("#tree .trow[data-path]").forEach((r) => {
    const p = r.dataset.path;
    if (addSet.has(p)) {
      r.animate([
        { transform: "scale(.82)", opacity: 0 },
        { transform: "scale(1.04)", opacity: 1, offset: 0.7 },
        { transform: "scale(1)", opacity: 1 }
      ], { duration: 480, easing: "ease-out" });
      return;
    }
    if (wobSet.has(p)) {
      r.animate([
        { transform: "rotate(0deg)" }, { transform: "rotate(-3deg)" }, { transform: "rotate(2.5deg)" },
        { transform: "rotate(-1.5deg)" }, { transform: "rotate(0deg)" }
      ], { duration: 540, easing: "ease-in-out" });
      return;
    }
    const old = before.get(p);
    if (!old) {
      if (before.size) r.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: "ease-out" });
      return;
    }
    const dy = old.top - r.getBoundingClientRect().top;
    if (Math.abs(dy) > 1) {
      r.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: 440, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  });
}
/* Muda a árvore com animação: fn altera os dados, a função renderiza e anima */
function mutateTree(fn, opts) {
  const before = snapshotRows();
  fn();
  renderTree();
  animateRows(before, opts);
}
/* Faz as linhas indicadas sumirem antes de executar fn */
function outThen(paths, fn) {
  if (reduceMotion()) return fn();
  const els = paths.map((p) => $(`#tree .trow[data-path="${CSS.escape(p)}"]`)).filter(Boolean);
  if (!els.length) return fn();
  els.forEach((el) => el.animate([
    { opacity: 1, transform: "none" },
    { opacity: 0, transform: "translateX(34px) scale(.96)" }
  ], { duration: 210, easing: "ease-in", fill: "forwards" }));
  setTimeout(fn, 200);
}

/* ---------- 8c. PLAYER DE VÍDEO (cartão centralizado, qualidades) ---------- */
const PL = { list: [], index: 0, hideTimer: null, dragging: false, speed: 1, quality: "orig" };
const PL_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PL_HEIGHTS = [240, 360, 480, 720, 1080, 1440, 2160];

function openMedia(path) {
  const node = (FILES[state.openId] || []).find((n) => n.path === path);
  if (mediaKind(node) === "video") return openPlayer(path);
  return openLightbox(path);
}
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60), m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
function stemOf(name) { return name.replace(/\.[^.]+$/, ""); }

function openPlayer(path) {
  const idx = state.vidList.findIndex((n) => n.path === path);
  if (idx < 0) return;
  PL.list = state.vidList; PL.index = idx;
  $("#player").hidden = false;
  document.body.classList.add("no-scroll");
  loadPlayerVideo(true);
  showPlayerControls();
}
function closePlayer() {
  const v = $("#pl-video");
  v.pause(); v.removeAttribute("src"); v.load();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  $("#player").hidden = true;
  $("#player").classList.remove("is-loading", "is-idle");
  document.body.classList.remove("no-scroll");
  clearTimeout(PL.hideTimer);
  closeMenus();
}

/* Versões do vídeo: a original + as qualidades adicionadas, da maior para a menor */
function qualityOptions(node) {
  const opts = [{ key: "orig", label: node._origLabel || "Original", height: node._origH || 0, src: imageSrc(node) }];
  (node.qualities || []).forEach((q) => {
    if (!q._url) q._url = q.file ? URL.createObjectURL(q.file) : q.url;
    opts.push({ key: q.key, label: q.label, height: q.height, src: q._url });
  });
  return opts.sort((a, b) => (b.height || 0) - (a.height || 0));
}
function currentOption(node) {
  const opts = qualityOptions(node);
  return opts.find((o) => o.key === PL.quality) || opts.find((o) => o.key === "orig") || opts[0];
}

function loadPlayerVideo(autoplay) {
  const node = PL.list[PL.index];
  if (!node) return;
  const v = $("#pl-video");
  const opt = currentOption(node);
  PL.quality = opt.key;
  v.src = opt.src;
  v.load();
  v.playbackRate = PL.speed;
  $("#pl-stage").style.setProperty("--ar", (16 / 9).toFixed(4));
  const name = baseOf(node.path);
  $("#pl-title").textContent = stemOf(name);
  $("#pl-top-title").textContent = stemOf(name);
  const folder = parentOf(node.path) ? parentOf(node.path).split("/").join(" › ") : "Raiz do projeto";
  $("#pl-meta").textContent = `${node.size ? fmtSize(node.size) + " · " : ""}${folder}`;
  $("#pl-count").textContent = `${PL.index + 1} de ${PL.list.length}`;
  $("#pl-download").href = imageSrc(node);
  $("#pl-download").setAttribute("download", name);
  $("#pl-prev").disabled = PL.list.length < 2;
  $("#pl-next").disabled = PL.list.length < 2;
  $("#pl-time").textContent = "0:00 / 0:00";
  $("#pl-played").style.width = "0%";
  $("#pl-knob").style.left = "0%";
  $("#pl-buf").style.width = "0%";
  renderPlaylist();
  renderQualityMenu();
  updateQualityBtn();
  if (autoplay) v.play().catch(() => {});
  updatePlayIcon();
  queueVideoThumb(node);
}

/* Troca de qualidade mantendo o tempo e o estado (tocando/pausado) */
function setQuality(key) {
  const node = PL.list[PL.index];
  if (!node) return;
  const opt = qualityOptions(node).find((o) => o.key === key);
  if (!opt) return;
  const v = $("#pl-video");
  if (opt.key === PL.quality && v.getAttribute("src") === opt.src) { closeMenus(); return; }
  const t = v.currentTime, wasPlaying = !v.paused;
  PL.quality = key;
  v.src = opt.src;
  v.load();
  v.playbackRate = PL.speed;
  v.addEventListener("loadedmetadata", function restore() {
    v.removeEventListener("loadedmetadata", restore);
    if (t) v.currentTime = Math.min(t, v.duration || t);
    if (wasPlaying) v.play().catch(() => {});
  });
  closeMenus();
  renderQualityMenu();
  updateQualityBtn();
}
function addQualityFromForm() {
  const node = PL.list[PL.index];
  if (!node) return;
  const sel = $("#pl-add-h").value;
  const h = sel === "custom" ? Number($("#pl-add-custom").value) : Number(sel);
  const file = $("#pl-add-file").files[0];
  const err = $("#pl-add-err");
  if (!h || h < 144 || h > 8640) { err.textContent = "Informe uma altura entre 144 e 8640 px."; return; }
  if (!file) { err.textContent = "Escolha um arquivo de vídeo."; return; }
  if (!(file.type || "").startsWith("video/") && !CONFIG.videoExt.test(file.name)) { err.textContent = "O arquivo precisa ser de vídeo."; return; }
  err.textContent = "";
  const key = `h${h}`;
  node.qualities = (node.qualities || []).filter((q) => q.key !== key);
  node.qualities.push({ key, label: `${h}p`, height: h, file });
  $("#pl-add-form").hidden = true;
  $("#pl-add-file").value = "";
  $("#pl-add-open").hidden = false;
  setQuality(key);
  toast(`Qualidade ${h}p adicionada`);
}
function renderQualityMenu() {
  const node = PL.list[PL.index];
  if (!node) return;
  $("#pl-q-list").innerHTML = qualityOptions(node).map((o) => `
    <button data-q="${escapeHtml(o.key)}" class="${o.key === PL.quality ? "is-on" : ""}">${escapeHtml(o.label)}${o.key === "orig" ? ' <span class="pl-q-sub">original</span>' : ""}</button>`).join("");
}
function updateQualityBtn() {
  const node = PL.list[PL.index];
  if (!node) return;
  const o = currentOption(node);
  $("#pl-quality").textContent = o ? o.label : "Qualidade";
}

function stepPlayer(dir) {
  const n = PL.list.length;
  if (n < 2) return;
  PL.index = (PL.index + dir + n) % n;
  loadPlayerVideo(true);
}
function renderPlaylist() {
  const list = $("#pl-list");
  list.innerHTML = PL.list.map((n, i) => `
    <button class="pl-item ${i === PL.index ? "is-cur" : ""}" data-i="${i}">
      <span class="pl-item-thumb">${n._thumb ? `<img src="${n._thumb}" alt="">` : icon("play", "ic")}</span>
      <span class="pl-item-info">
        <span class="pl-item-name">${escapeHtml(stemOf(baseOf(n.path)))}</span>
        <span class="pl-item-sub">${escapeHtml(parentOf(n.path) || "Raiz do projeto")}${n.size ? " · " + fmtSize(n.size) : ""}</span>
      </span>
    </button>`).join("");
  $("#pl-count").textContent = `${PL.index + 1} de ${PL.list.length}`;
  const cur = list.querySelector(".is-cur");
  if (cur) cur.scrollIntoView({ block: "nearest" });
}
function togglePlay() {
  const v = $("#pl-video");
  if (v.paused) v.play().catch(() => {}); else v.pause();
  flashPlayer(v.paused ? "pause" : "play");
}
function flashPlayer(name) {
  const f = $("#pl-flash");
  f.innerHTML = icon(name === "play" ? "play" : "pause", "ic");
  f.classList.remove("is-on");
  void f.offsetWidth;
  f.classList.add("is-on");
}
function updatePlayIcon() {
  const v = $("#pl-video");
  $("#pl-play").innerHTML = icon(v.paused ? "play" : "pause", "ic");
  $("#pl-play").setAttribute("aria-label", v.paused ? "Reproduzir" : "Pausar");
  $("#player").classList.toggle("is-paused", v.paused);
}
function updateVolumeIcon() {
  const v = $("#pl-video");
  $("#pl-mute").innerHTML = icon(v.muted || v.volume === 0 ? "mute" : "volume", "ic");
  $("#pl-volume").value = v.muted ? 0 : v.volume;
}
function updateProgress() {
  const v = $("#pl-video");
  const d = v.duration;
  const ratio = d && isFinite(d) ? v.currentTime / d : 0;
  $("#pl-played").style.width = (ratio * 100) + "%";
  $("#pl-knob").style.left = (ratio * 100) + "%";
  $("#pl-time").textContent = `${fmtTime(v.currentTime)} / ${fmtTime(d)}`;
  if (v.buffered && v.buffered.length && d && isFinite(d)) {
    const end = v.buffered.end(v.buffered.length - 1);
    $("#pl-buf").style.width = (end / d * 100) + "%";
  }
}
function seekFromEvent(e) {
  const r = $("#pl-progress").getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  const v = $("#pl-video");
  if (v.duration && isFinite(v.duration)) v.currentTime = ratio * v.duration;
  updateProgress();
}
function showPlayerControls() {
  const p = $("#player");
  p.classList.remove("is-idle");
  clearTimeout(PL.hideTimer);
  if (!$("#pl-video").paused) PL.hideTimer = setTimeout(() => p.classList.add("is-idle"), 2400);
}
/* Tela cheia só no palco (vídeo + controles), o cartão fica no lugar */
function togglePlayerFullscreen() {
  if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
  const el = $("#pl-stage");
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}
function closeMenus() {
  $("#pl-speed-menu").hidden = true;
  $("#pl-quality-menu").hidden = true;
}
function setPlayerSpeed(s) {
  PL.speed = s;
  $("#pl-video").playbackRate = s;
  $("#pl-speed").textContent = s === 1 ? "1x" : `${s}x`;
  $$("#pl-speed-menu [data-speed]").forEach((b) => b.classList.toggle("is-on", Number(b.dataset.speed) === s));
  closeMenus();
}
function playerKey(e) {
  const k = e.key;
  const typing = e.target && e.target.closest && e.target.closest("input, select, textarea");
  if (k === "Escape") {
    if (!$("#pl-speed-menu").hidden || !$("#pl-quality-menu").hidden) { closeMenus(); return; }
    closePlayer(); return;
  }
  if (typing) return;
  const v = $("#pl-video");
  if (k === " " || k === "k" || k === "K") { e.preventDefault(); togglePlay(); return; }
  if (k === "ArrowRight") { e.preventDefault(); v.currentTime = Math.min(v.duration || 0, v.currentTime + 5); flashPlayer("play"); return; }
  if (k === "ArrowLeft") { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); return; }
  if (k === "ArrowUp") { e.preventDefault(); v.muted = false; v.volume = Math.min(1, v.volume + 0.1); updateVolumeIcon(); return; }
  if (k === "ArrowDown") { e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); updateVolumeIcon(); return; }
  if (k === "m" || k === "M") { v.muted = !v.muted; updateVolumeIcon(); return; }
  if (k === "f" || k === "F") { togglePlayerFullscreen(); return; }
  if (k === "n" || k === "N") { stepPlayer(1); return; }
  if (k === "p" || k === "P") { stepPlayer(-1); return; }
}
/* Abre as pastas até o item, rola até ele e destaca */
function revealRow(path) {
  const id = state.openId;
  let acc = "";
  path.split("/").slice(0, -1).forEach((part) => {
    acc = acc ? `${acc}/${part}` : part;
    EXPANDED.add(`${id}|${acc}`);
  });
  state.treeQuery = ""; state.typeFilter = "all"; state.catFilter = "";
  renderTree();
  const row = $(`#tree [data-path="${CSS.escape(path)}"]`);
  if (row) {
    row.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
    row.animate([{ background: "#3a3a3a" }, { background: "transparent" }], { duration: 1300 });
  }
}
function bindPlayer() {
  const v = $("#pl-video");
  v.addEventListener("play", () => { updatePlayIcon(); showPlayerControls(); });
  v.addEventListener("pause", () => { updatePlayIcon(); showPlayerControls(); });
  v.addEventListener("timeupdate", updateProgress);
  v.addEventListener("progress", updateProgress);
  v.addEventListener("volumechange", updateVolumeIcon);
  v.addEventListener("loadedmetadata", () => {
    const node = PL.list[PL.index];
    if (v.videoWidth && v.videoHeight) {
      $("#pl-stage").style.setProperty("--ar", (v.videoWidth / v.videoHeight).toFixed(4));
      if (node && PL.quality === "orig") { node._origH = v.videoHeight; node._origLabel = `${v.videoHeight}p`; }
    }
    updateProgress();
    renderQualityMenu();
    updateQualityBtn();
  });
  v.addEventListener("waiting", () => $("#player").classList.add("is-loading"));
  v.addEventListener("playing", () => $("#player").classList.remove("is-loading"));
  v.addEventListener("canplay", () => $("#player").classList.remove("is-loading"));
  v.addEventListener("ended", () => { if (PL.list.length > 1) stepPlayer(1); else updatePlayIcon(); });

  const stage = $("#pl-stage");
  stage.addEventListener("mousemove", showPlayerControls);
  stage.addEventListener("click", (e) => {
    if (e.target.closest(".pl-controls")) return;
    togglePlay(); showPlayerControls();
  });
  stage.addEventListener("dblclick", (e) => { if (!e.target.closest(".pl-controls")) togglePlayerFullscreen(); });
  $("#player").addEventListener("click", (e) => { if (e.target.id === "player") closePlayer(); });

  $("#pl-play").addEventListener("click", togglePlay);
  $("#pl-prev").addEventListener("click", () => stepPlayer(-1));
  $("#pl-next").addEventListener("click", () => stepPlayer(1));
  $("#pl-mute").addEventListener("click", () => {
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
    updateVolumeIcon();
  });
  $("#pl-volume").addEventListener("input", (e) => { v.muted = false; v.volume = Number(e.target.value); updateVolumeIcon(); });

  const bar = $("#pl-progress");
  bar.addEventListener("pointerdown", (e) => { PL.dragging = true; bar.setPointerCapture(e.pointerId); seekFromEvent(e); });
  bar.addEventListener("pointermove", (e) => { if (PL.dragging) seekFromEvent(e); });
  bar.addEventListener("pointerup", () => { PL.dragging = false; });

  /* velocidade */
  $("#pl-speed-menu").innerHTML = PL_SPEEDS.map((s) => `<button data-speed="${s}">${s === 1 ? "Normal" : s + "x"}</button>`).join("");
  $("#pl-speed").addEventListener("click", (e) => {
    e.stopPropagation();
    const m = $("#pl-speed-menu"), open = m.hidden;
    closeMenus(); m.hidden = !open;
  });
  $("#pl-speed-menu").addEventListener("click", (e) => {
    const b = e.target.closest("[data-speed]");
    if (b) setPlayerSpeed(Number(b.dataset.speed));
  });
  setPlayerSpeed(1);

  /* qualidade */
  $("#pl-quality").addEventListener("click", (e) => {
    e.stopPropagation();
    const m = $("#pl-quality-menu"), open = m.hidden;
    closeMenus(); m.hidden = !open;
  });
  $("#pl-q-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]");
    if (b) setQuality(b.dataset.q);
  });
  $("#pl-add-h").innerHTML = PL_HEIGHTS.map((h) => `<option value="${h}">${h}p</option>`).join("") + `<option value="custom">Outra altura…</option>`;
  $("#pl-add-h").value = "720";
  $("#pl-add-h").addEventListener("change", () => { $("#pl-add-custom-wrap").hidden = $("#pl-add-h").value !== "custom"; });
  $("#pl-add-open").addEventListener("click", () => {
    $("#pl-add-form").hidden = false;
    $("#pl-add-open").hidden = true;
    $("#pl-add-err").textContent = "";
  });
  $("#pl-add-cancel").addEventListener("click", () => {
    $("#pl-add-form").hidden = true;
    $("#pl-add-open").hidden = false;
  });
  $("#pl-add-save").addEventListener("click", addQualityFromForm);
  $("#pl-quality-menu").addEventListener("click", (e) => e.stopPropagation());
  $("#pl-speed-menu").addEventListener("click", (e) => e.stopPropagation());

  $("#pl-full").addEventListener("click", togglePlayerFullscreen);
  $("#pl-close").addEventListener("click", closePlayer);
  $("#pl-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    PL.index = Number(b.dataset.i);
    loadPlayerVideo(true);
  });
  $("#pl-reveal").addEventListener("click", () => {
    const node = PL.list[PL.index];
    closePlayer();
    if (node) revealRow(node.path);
  });
  document.addEventListener("fullscreenchange", () => {
    $("#pl-full").innerHTML = icon(document.fullscreenElement ? "minimize" : "maximize", "ic");
  });
  document.addEventListener("click", closeMenus);
  $("#pl-full").innerHTML = icon("maximize", "ic");
  $("#pl-mute").innerHTML = icon("volume", "ic");
  updatePlayIcon();
}

/* ---------- 8d. PRÉ-VISUALIZAÇÕES (frame de vídeo, trecho de texto, áudio) ---------- */
function domFor(attr, path) {
  return $$(`[${attr}]`).filter((el) => el.getAttribute(attr) === path);
}
const thumbQueue = []; let thumbBusy = false;
function queueVideoThumb(n) {
  if (n._thumb || n._thumbQ) return;
  n._thumbQ = true;
  thumbQueue.push(n);
  pumpThumbs();
}
function pumpThumbs() {
  if (thumbBusy || !thumbQueue.length) return;
  thumbBusy = true;
  const n = thumbQueue.shift();
  captureFrame(n).then((r) => {
    if (r) { n._thumb = r.thumb; n._dur = r.dur; paintVideoThumb(n); }
  }).finally(() => { thumbBusy = false; pumpThumbs(); });
}
/* Pega um quadro do vídeo (1s, ou 10% se for mais curto) e reduz para miniatura */
function captureFrame(n) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true; v.preload = "auto"; v.playsInline = true;
    let done = false;
    const finish = (res) => {
      if (done) return;
      done = true;
      v.removeAttribute("src"); v.load();
      resolve(res);
    };
    const timer = setTimeout(() => finish(null), 9000);
    v.onerror = () => { clearTimeout(timer); finish(null); };
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 1) * 0.1); };
    v.onseeked = () => {
      clearTimeout(timer);
      try {
        const w = 160, h = Math.round(160 * (v.videoHeight / v.videoWidth)) || 90;
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(v, 0, 0, w, h);
        finish({ thumb: c.toDataURL("image/jpeg", 0.75), dur: v.duration });
      } catch (e) { finish(null); }
    };
    v.src = imageSrc(n);
  });
}
function paintVideoThumb(n) {
  domFor("data-vid", n.path).forEach((el) => { el.innerHTML = `<img src="${n._thumb}" alt="">`; });
  domFor("data-vdur", n.path).forEach((el) => { el.textContent = n._dur ? fmtTime(n._dur) : ""; });
  if (!$("#player").hidden) renderPlaylist();
}

const snipQueue = []; let snipBusy = false;
function queueSnippet(n) {
  if (n._snip !== undefined || n._snipQ) return;
  n._snipQ = true;
  snipQueue.push(n);
  pumpSnip();
}
function pumpSnip() {
  if (snipBusy || !snipQueue.length) return;
  snipBusy = true;
  const n = snipQueue.shift();
  readSnippet(n).then((s) => {
    n._snip = s;
    domFor("data-snip", n.path).forEach((el) => { el.innerHTML = txtPreviewHtml(s); });
  }).finally(() => { snipBusy = false; pumpSnip(); });
}
/* 5 primeiras linhas não vazias do texto, para o preview escuro */
async function readSnippet(n) {
  try {
    let text;
    if (n.file) text = await n.file.slice(0, 3000).text();
    else text = (await (await fetch(n.url)).text()).slice(0, 3000);
    return text.split(/\r?\n/).map((l) => l.replace(/\t/g, "  ").trim()).filter((l) => l.length)
      .slice(0, 5).map((l) => l.slice(0, 120));
  } catch (e) { return []; }
}
function txtPreviewHtml(lines) {
  if (lines === undefined) return `<span class="txt-line muted">carregando…</span>`;
  if (!lines.length) return `<span class="txt-line muted">(arquivo vazio)</span>`;
  return lines.map((l) => `<span class="txt-line">${escapeHtml(l)}</span>`).join("");
}
function extOf(path) {
  const m = /\.([^./]+)$/.exec(baseOf(path));
  return m ? m[1].toUpperCase().slice(0, 4) : "ARQ";
}
/* Pasta: pilha com até 3 prévias do que tem dentro + ícone da pasta */
function folderStackHtml(nodes, path, iconId) {
  const kids = nodes.filter((k) => parentOf(k.path) === path).slice(0, 3);
  if (!kids.length) return `<span class="type-ic">${icon(iconId || "folder", "ic ic-sm")}</span>`;
  const tiles = kids.map((k) => {
    const kind = mediaKind(k);
    let inner;
    if (k.type === "folder") inner = icon("folder", "ic");
    else if (kind === "image") { const s = imageSrc(k); inner = s ? `<img src="${escapeHtml(s)}" alt="">` : icon("image", "ic"); }
    else if (kind === "video") { queueVideoThumb(k); inner = k._thumb ? `<img src="${k._thumb}" alt="">` : icon("play", "ic"); }
    else if (isAudio(k)) inner = icon("music", "ic");
    else inner = `<span class="thumb-ext sm">${escapeHtml(extOf(k.path))}</span>`;
    return `<i>${inner}</i>`;
  }).join("");
  return `<span class="thumb-stack">${tiles}<span class="thumb-stack-ic">${icon(iconId || "folder", "ic")}</span></span>`;
}
const TEXT_RE = /\.(txt|md|csv|json|js|ts|css|html?|xml|ya?ml|log|ini|py|lua|luau|sh)$/i;
const AUDIO_RE = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;
function isText(node) {
  return node.type === "file" && ((node.mime && node.mime.startsWith("text/")) || TEXT_RE.test(node.path));
}
function isAudio(node) {
  return node.type === "file" && ((node.mime && node.mime.startsWith("audio/")) || AUDIO_RE.test(node.path));
}

const AUDIO = new Audio();
let audioPath = "";
AUDIO.addEventListener("play", syncAudioButtons);
AUDIO.addEventListener("pause", syncAudioButtons);
AUDIO.addEventListener("ended", syncAudioButtons);
function audioBtnHtml(path) {
  const on = !AUDIO.paused && audioPath === path;
  return `<span class="thumb-ph audio ${on ? "is-on" : ""}">${icon(on ? "pause" : "play", "ic ic-sm")}</span>`;
}
function toggleAudio(node) {
  if (audioPath !== node.path || !AUDIO.getAttribute("src")) {
    audioPath = node.path;
    AUDIO.src = imageSrc(node);
  }
  if (AUDIO.paused) AUDIO.play().catch(() => {}); else AUDIO.pause();
  syncAudioButtons();
}
function syncAudioButtons() {
  $$("[data-audio]").forEach((b) => { b.innerHTML = audioBtnHtml(b.dataset.audio); });
}

/* ---------- 13. API PÚBLICA ---------- */
window.Projetos = {
  setProjects(list) { PROJECTS = Array.isArray(list) ? list.slice() : []; renderMain(); },
  setFiles(id, nodes) {
    FILES[id] = Array.isArray(nodes) ? nodes.slice() : [];
    if (state.openId === id) renderTree();
    const p = project(id);
    if (p) { p.files = FILES[id].filter((n) => n.type === "file").length; renderMain(); }
  },
  // Carrega ícones e categorias salvos: { "pasta/caminho": { icon, category } }
  setMeta(id, meta) {
    META[id] = meta && typeof meta === "object" ? Object.assign({}, meta) : {};
    if (state.openId === id) renderTree();
  },
  openProject(id) { if (project(id)) openProject(id); },
  back() { showMain(); },
  exportProject(opts) { if (state.openId) openExport(opts || {}); },
  confirm: (text, okLabel, opts) => ask(text, okLabel, opts)
};

/* ---------- 14. INÍCIO ---------- */
function init() {
  renderStaticText();
  bindEvents();
  renderMain();
}
document.addEventListener("DOMContentLoaded", init);
