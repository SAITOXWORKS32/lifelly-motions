# Projetos — Guia completo de instalação e funcionamento

Este pacote contém a interface de **gerenciamento de projetos** (tela "All projects") pronta para ser instalada em um site. A tela vem **sem dados de exemplo**: nenhum projeto, nenhum número, nenhum nome de usuário. Tudo que aparece na tela precisa ser preenchido com dados reais.

---

## 1. Arquivos do pacote

| Arquivo | Para que serve |
|---|---|
| `index.html` | Estrutura da tela: marca onde fica cada componente e contém a biblioteca de ícones SVG. Não tem textos nem dados fixos. |
| `styles.css` | Aparência de tudo. Cores em tons de cinza, definidas no topo do arquivo em `:root`. |
| `app.js` | Lógica da tela: textos, lista de projetos, abas, busca, estado vazio e eventos. |
| `README.md` | Este guia. |
| `PROMPT.txt` | Instruções curtas para enviar à IA que vai instalar a tela. |

Os três arquivos precisam ficar **na mesma pasta**. O `index.html` carrega `styles.css` e `app.js` automaticamente.

---

## 2. Como a tela está organizada

A tela tem duas colunas: uma **barra lateral** à esquerda e a **área principal** à direita.

### 2.1 Barra lateral (`<aside class="sidebar">`)

Fica do lado esquerdo, com fundo um pouco mais claro que o resto da tela.

- **Bloco do usuário** (`#user-box`): avatar com iniciais, nome e e-mail do usuário logado. Vem de `CONFIG.user` no `app.js`.
- **Navegação principal**: `Home` e `My projects`. Cada item é um link (`data-nav`) cujo destino é definido em `CONFIG.nav`.
- **Projetos com submenu**: `Projects` abre cinco filtros, cada um com um contador:
  - `View all`: todos os projetos.
  - `Recent`: projetos não arquivados.
  - `Favorites`: projetos marcados como favoritos.
  - `Shared`: projetos compartilhados com outras pessoas.
  - `Archived`: projetos arquivados.
  Clicar em um deles muda a lista da área principal. Os contadores são calculados automaticamente a partir da lista de projetos.
- **Outros links**: `All files`, `Team members`, `Appearance`.
- **Rodapé**: `Open in browser`, `Support`, `Settings`, e a marca com nome e versão (`CONFIG.brand`).

Em telas menores que 760 px, a barra lateral some.

### 2.2 Cabeçalho (`<header class="header">`)

- **Título** (`#page-title`): texto grande no topo, definido em `CONFIG.pageTitle`.
- **Botão "New project"** (`#btn-new-project`): cria um projeto novo. Ao ser clicado, dispara o evento `projects:new` (ver seção 5).

### 2.3 Projetos recentes (`#recent-grid`)

- Mostra até **3 cards** dos projetos mais recentes que não estão arquivados. O limite é `CONFIG.recentLimit`.
- Cada **card** tem: ícone de pasta, nome do projeto, quantidade de arquivos (`files`), avatares sobrepostos dos membros (`members`) e um botão de três pontos para mais ações.
- Se não houver nenhum projeto recente, o bloco inteiro some (fica oculto, não aparece em branco).
- Clicar no card dispara o evento `projects:open` com o `id` do projeto.

### 2.4 Abas e busca (`.toolbar`)

- **Abas** (`.tab`): `View all`, `Recent`, `Favorites`, `Shared`, `Archived`. A aba ativa fica sublinhada e em destaque. Trocar de aba filtra a lista abaixo.
- **Campo de busca** (`#search-input`): filtra a lista **enquanto o usuário digita**, pelo nome do projeto, sem diferenciar maiúsculas e minúsculas. O texto de dica vem de `CONFIG.searchPlaceholder`.
- **Botão "Filters"** (`#btn-filters`): reservado para filtros extras. Ainda não filtra nada por padrão; ligue sua lógica a ele.

### 2.5 Lista de projetos (`#project-list`)

- Mostra **uma linha por projeto** que passa pelo filtro da aba e pela busca.
- Cada linha tem ícone de pasta, nome, quantidade de arquivos e botão de mais ações.
- Clicar na linha dispara o evento `projects:open`.

### 2.6 Estado vazio (`#empty-state`)

Aparece **somente quando a lista filtrada está vazia**. Tem dois casos:

- **Com busca digitada**: mostra o texto de `CONFIG.empty.textWithSearch`, substituindo `{query}` pelo que o usuário digitou, e o botão **Clear search** (limpa a busca).
- **Sem busca**: mostra `CONFIG.empty.textNoSearch`, sem o botão Clear search.

Em ambos os casos aparece o botão **New project**.

---

## 3. Ícones

Todos os ícones estão em um bloco `<svg>` no início do `index.html`, dentro de `<symbol id="i-...">`. Para usar um ícone em qualquer lugar:

```html
<svg class="ic"><use href="#i-folder"/></svg>
```

- `class="ic"` é tamanho padrão (16 px). `class="ic ic-sm"` é menor (13 px).
- A cor do ícone é a mesma do texto ao redor (`currentColor`), então ele fica cinza ou branco conforme o estado.

Ícones disponíveis: `home`, `star`, `folder`, `files`, `users`, `palette`, `external`, `help`, `settings`, `plus`, `more`, `search`, `filter`, `archive`, `clock`, `share`, `grid`, `x`.

Para trocar um ícone, substitua o `id` em `<use href="#i-...">`.

---

## 4. Dados: como preencher os projetos

Os projetos ficam na variável `PROJECTS` dentro do `app.js`. Ela começa **vazia** (`let PROJECTS = [];`).

Cada projeto é um objeto com este formato:

```js
{
  id: "proj_001",               // identificador único (texto)
  name: "Nome do projeto",      // nome exibido
  files: 0,                     // quantidade de arquivos (número)
  members: ["CK", "AB"],        // iniciais dos membros (até 3 avatares aparecem)
  favorite: false,              // aparece em "Favorites"
  shared: false,                // aparece em "Shared"
  archived: false,              // aparece em "Archived" e some de "Recent"
  updatedAt: "2026-10-26T00:00:00Z"
}
```

Exemplo de como preencher (use somente dados reais):

```js
let PROJECTS = [
  { id: "1", name: "Projeto A", files: 12, members: ["CK"], favorite: true, shared: false, archived: false, updatedAt: "2026-10-20T10:00:00Z" }
];
```

**Importante:** a tela não cria, edita nem apaga projetos sozinha. Ela só exibe a lista que você fornecer. Para salvar essas ações, veja a seção 6.

---

## 5. Eventos (o que o site deve escutar)

A tela não sabe o que fazer ao clicar em um botão. Ela apenas **avisa** o restante do site por meio de eventos. Seu código deve escutar esses eventos:

| Evento | Quando dispara | Dados recebidos |
|---|---|---|
| `projects:new` | Clique em "New project" (cabeçalho ou estado vazio) | nenhum |
| `projects:open` | Clique em um card ou linha de projeto | `detail.id` com o id do projeto |

Exemplo:

```js
document.addEventListener("projects:new", () => {
  // abrir formulário de novo projeto
});

document.addEventListener("projects:open", (e) => {
  const id = e.detail.id;
  // ir para a página do projeto com esse id
});
```

---

## 6. Como conectar a dados reais (site real)

Hoje a lista é uma variável local. Para um site de verdade, normalmente você precisa buscar os projetos no servidor:

1. Crie um endpoint no servidor que devolva a lista de projetos no formato da seção 4.
2. No `app.js`, antes de `init()`, troque a variável `PROJECTS` por uma busca:

```js
async function loadProjects() {
  const res = await fetch("/api/projects");     // troque pela sua rota
  PROJECTS = await res.json();
  render();
}
```

3. Chame `loadProjects()` no lugar de `render()` dentro de `init()`.

Para salvar ações (criar, favoritar, arquivar), use os eventos da seção 5 e envie a requisição ao servidor. Depois de salvar, atualize `PROJECTS` e chame `render()` de novo.

---

## 7. Textos e idioma

Todos os textos visíveis ficam em **um só lugar**: o objeto `CONFIG` no topo do `app.js`.

- `CONFIG.pageTitle`, `CONFIG.newProjectLabel`, `CONFIG.recentLabel`, `CONFIG.listLabel`, `CONFIG.filtersLabel`
- `CONFIG.tabs` (nomes das abas e filtros)
- `CONFIG.empty` (título e textos do estado vazio)
- `CONFIG.user` e `CONFIG.brand`
- `CONFIG.nav` (destino de cada link do menu, troque `"#"` pela URL)

Para traduzir a tela, troque apenas esses textos. Não é preciso mexer no HTML.

---

## 8. Cores e aparência

Todas as cores estão no topo do `styles.css`, dentro de `:root`:

- `--bg`: fundo principal
- `--panel`: fundo da barra lateral
- `--surface`: fundo dos cards
- `--border`: linhas e bordas
- `--text`: texto principal
- `--muted`: texto secundário
- `--btn-primary`: fundo do botão principal (claro)
- `--radius`: arredondamento dos cards

A tela usa **somente tons de cinza**. Para mudar a cor de uma parte, altere a variável correspondente. Não é preciso procurar cores espalhadas pelo arquivo.

---

## 9. Responsividade

- Acima de 760 px: duas colunas (barra lateral e conteúdo).
- Abaixo de 760 px: a barra lateral some, os cards viram uma coluna só e a busca ocupa a largura toda.

Para mostrar a barra lateral no celular, remova a regra `.sidebar{display:none}` dentro de `@media` no `styles.css` e crie um botão que abra o menu.

---

## 10. Como instalar no site

1. Coloque `index.html`, `styles.css`, `app.js` na mesma pasta do site (por exemplo, `/projetos/`).
2. Acesse a página `index.html` pelo navegador para conferir se a tela abre sem erros.
3. Se o site já tiver seu próprio layout, copie apenas o conteúdo de `<div class="app">` para dentro da sua página e mantenha o bloco `<svg>` de ícones e as referências a `styles.css` e `app.js`.
4. Conecte os dados reais (seção 6) e os eventos (seção 5).
5. Teste em celular e computador.

---

## 11. Checklist de verificação

- [ ] A tela abre sem erros no console do navegador (F12).
- [ ] Sem dados, aparece o estado vazio e os contadores mostram `0`.
- [ ] Com projetos reais, os cards mostram nome, arquivos e avatares corretos.
- [ ] Cada aba mostra apenas os projetos certos.
- [ ] A busca filtra enquanto digita e o botão "Clear search" limpa o campo.
- [ ] "New project" e clicar em um projeto disparam os eventos da seção 5.
- [ ] Os links do menu levam aos destinos corretos (`CONFIG.nav`).
- [ ] Nenhum texto de exemplo aparece na tela.
- [ ] Layout funciona no celular.

---

## 12. Resumo rápido das regras

- Não existe dado de exemplo: tudo vem de `PROJECTS` e `CONFIG`.
- Textos ficam em `CONFIG`, cores em `:root`, lógica em `app.js`, estrutura em `index.html`.
- A tela não cria nem salva nada sozinha. Ela avisa por eventos (`projects:new`, `projects:open`).
- Todos os ícones são SVG reutilizáveis, em tons de cinza.

---

## 15. Novidades: importar pasta, árvore editável, imagens e .zip

Esta versão acrescenta telas dentro da mesma janela. Continuam sem dados de exemplo.

### 15.1 Importar pasta
- Botão **Importar pasta** no topo da lista, ou dentro de um projeto aberto.
- Abre a tela **Importar pasta**, com seletor de pasta do computador. Nada é enviado antes de confirmar.
- Mostra a prévia: nome da pasta, quantidade de arquivos, pastas, imagens e tamanho total, com a árvore completa já aberta.
- Ignora automaticamente `node_modules`, `.git`, `.DS_Store`, `Thumbs.db`, `__pycache__`, `.idea` e `.vscode`, e informa quantos itens foram ignorados. A lista fica em `CONFIG.skipPattern`.
- Ao confirmar, o projeto é criado com o nome da pasta raiz e abre direto na árvore.

### 15.2 Árvore de arquivos (dentro do projeto)
- Pastas abrem e fecham com a setinha.
- Em cada linha: **+** (nova pasta dentro, só em pastas), **lápis** (renomear), **seta** (mover) e **lixeira** (excluir).
- **Nova pasta** no topo cria uma pasta na raiz.
- Renomear e mover atualizam também o que está dentro das pastas.
- Excluir pede confirmação em um cartão dentro da própria tela. Pasta com itens avisa quantos itens serão apagados junto.

### 15.3 Pré-visualização de imagens
- Arquivos de imagem (PNG, JPG, GIF, WebP, SVG, BMP, AVIF) mostram miniatura na linha.
- Clicar na miniatura abre o visualizador, com contador ("2 de 5"), setas (ou as teclas ← e →) e fechar com Esc ou clicando fora.

### 15.4 Baixar em .zip
- Botão **Baixar .zip** gera um arquivo `.zip` com a estrutura de pastas do projeto, feito no próprio navegador.
- Só entram os arquivos que têm conteúdo disponível (importados nesta sessão ou com `url`). Os demais são ignorados.

### 15.5 API pública (`window.Projetos`)
```js
Projetos.setProjects([...]);            // lista de projetos
Projetos.setFiles("id", [               // árvore de um projeto
  { path: "site", type: "folder" },
  { path: "site/index.html", type: "file", size: 2048, mime: "text/html" },
  { path: "site/img/logo.png", type: "file", size: 512, mime: "image/png", url: "https://..." }
]);
Projetos.openProject("id");             // abre a árvore de um projeto
Projetos.back();                        // volta para a lista
Projetos.confirm("Texto", "Excluir", { danger: true });  // cartão de confirmação, retorna Promise<boolean>
```

### 15.6 Eventos novos
| Evento | Quando | Detalhe |
|---|---|---|
| `project:import` | Confirma uma importação (nova ou para dentro de um projeto) | `{ projectId, name, nodes, skipped }`. Em `nodes`, arquivos importados trazem `file` (File do navegador) para o site enviar |
| `file:folder-create` | Cria pasta | `{ projectId, path }` |
| `file:rename` | Renomeia arquivo ou pasta | `{ projectId, from, to }` |
| `file:move` | Move para outra pasta | `{ projectId, from, to, type }` |
| `file:delete` | Exclui arquivo ou pasta (depois de confirmar) | `{ projectId, path, type }` |
| `project:download` | Gera o .zip | `{ projectId, files, skipped }` |
| `projects:open` | Abre um projeto | `{ id }` (continua disponível) |

O site é quem grava as mudanças: a GUI atualiza a tela na hora e avisa pelo evento. Se a gravação falhar, chame `Projetos.setFiles` com a lista certa de novo.

## Versão 3 — pesquisa, categorias, seleção, agrupar e exportação

Arquivos: `index.html`, `app.js`, `styles.css`. Tudo continua em HTML, CSS e JavaScript puros, sem dependências.

### Pesquisa e filtros dentro do projeto
- **Pesquisar nesta pasta**: filtra pelo nome. As pastas que contêm um resultado são abertas automaticamente.
- **Tipo**: Todos, Imagens, Vídeos, Outros. Pastas só aparecem quando contêm itens do tipo escolhido.
- **Categorias**: chips com as categorias em uso e a contagem de itens. Clique para filtrar, clique de novo para limpar.

### Ícones e categorias
- **⋯ > Trocar ícone** (pastas): escolha entre 12 ícones (padrão, imagens, vídeos, áudio, código, arte, documentos, favoritos, privado, pacote, jogo, testes). Ajuste a lista em `CONFIG.folderIcons`.
- **⋯ > Categoria** (pastas e arquivos): escolha uma categoria existente ou crie uma nova. Sugestões ficam em `CONFIG.categories`.

### Seleção múltipla, agrupar e desagrupar
- **Selecionar**: mostra as caixas de seleção. Com a seleção ligada, clicar na linha marca ou desmarca o item.
- **Barra da seleção**: Selecionar visíveis, Agrupar, Categoria, Exportar seleção, Excluir e Concluir.
- **Agrupar**: cria uma pasta nova com o nome digitado e move os itens selecionados para dentro dela. Se todos estiverem na mesma pasta, o grupo é criado ali; caso contrário, na raiz.
- **⋯ > Desagrupar** (pastas): leva o conteúdo para o nível de cima e remove a pasta. Nomes repetidos ganham " (2)".

### Exportação
- Botão **Exportar** no cabeçalho, ou **⋯ > Exportar esta pasta**, ou **Exportar seleção** na barra de seleção.
- **O que exportar**: projeto inteiro, uma pasta ou a seleção atual.
- **Tipos**: imagens, vídeos e outros arquivos, em qualquer combinação.
- **Categoria**: opcional.
- **Formato**: `.zip` com os arquivos (pode incluir `ximmer-metadados.json`, com ícones e categorias), ou `.txt` com a lista da estrutura.
- Ao exportar uma pasta, o zip começa pela própria pasta.

### Visualizador
- Imagens e vídeos abrem no visualizador. As setas percorrem só o que está visível na árvore (depois de filtrar).

### API adicional
```js
Projetos.setMeta("id-do-projeto", {
  "Cena": { icon: "film", category: "Arte" },
  "Musica": { icon: "music", category: "Áudio" }
});
Projetos.exportProject({ scope: "folder", folder: "Cena" }); // abre o modal de exportação
```

### Eventos novos (`document`)
- `file:group` — `{ projectId, folder, paths }`
- `file:ungroup` — `{ projectId, path, moved }`
- `file:icon` — `{ projectId, path, icon }`
- `file:category` — `{ projectId, paths, category }`
- `project:export` — `{ projectId, scope, folder, format, files, skipped }`
- `file:delete` — também chega com `{ projectId, paths }` quando a exclusão é em lote.

## v4 — Player estilo YouTube e animações

### Player de vídeo
Clicar no vídeo (na árvore ou no thumbnail) abre um player em tela cheia dentro da GUI.
- Barra de progresso com buffer, arraste para buscar e bolinha que aparece no hover.
- Play/pausa (também clicando no vídeo), anterior/próximo, volume com slider que expande no hover.
- Velocidade: 0.5x, 0.75x, 1x, 1.25x, 1.5x e 2x (a velocidade fica ao trocar de vídeo).
- Tela cheia, controles que somem sozinhos durante a reprodução.
- Lista lateral com os outros vídeos da pasta/pesquisa atual.
- Botão de pasta: fecha o player e mostra o vídeo na árvore (abre as pastas, rola até ele e destaca).
- Botão de baixar.
- Atalhos: Espaço/K pausa, ←/→ voltam/avançam 5s, ↑/↓ volume, M silencia, F tela cheia, N/P próximo/anterior, Esc fecha.

### Animações da árvore
- Pasta criada (ou item agrupado): entra com um pop.
- Mover, renomear, agrupar, desagrupar: as linhas deslizam da posição antiga para a nova (FLIP).
- Trocar ícone, categoria ou nome: a linha balança (wobble).
- Excluir e desagrupar: a linha sai deslizando antes de ser removida.
- Abrir/fechar pasta: as linhas entram e saem suavemente.
- Respeita `prefers-reduced-motion`: sem animações para quem pede menos movimento.

### Código novo
- `app.js`: seção 8b (animações: `snapshotRows`, `animateRows`, `mutateTree`, `outThen`) e 8c (player: `openPlayer`, `loadPlayerVideo`, `togglePlay`, `seekFromEvent`, `playerKey`, `revealRow`, `bindPlayer`).
- `index.html`: bloco `#player` antes do cartão de confirmação e ícones novos (pause, next, prev, volume, mute, maximize, minimize).
- `styles.css`: bloco "v4 — PLAYER ESTILO YOUTUBE" no final.

API pública, eventos e exportação são iguais à v3.

## v4.1 — Player em cartão, qualidades e pré-visualizações

### Player
- Abre como um cartão centralizado sobre a GUI (não ocupa a tela toda). Clique fora ou Esc fecha.
- O palco segue a proporção do próprio vídeo: vertical (ex.: 576×1024) fica vertical, horizontal fica 16:9.
- Tela cheia expande só o palco, com os controles.

### Qualidade
- Botão de qualidade na barra do player. Lista as versões do vídeo, da maior para a menor (ex.: 1024p original, 720p, 900p).
- "+ Adicionar qualidade": escolha a resolução (144p a 2160p) ou "Outra altura…" para qualquer valor em px (ex.: 1820), e anexe o arquivo daquela versão.
- Trocar de qualidade mantém o tempo e o estado (tocando/pausado) e a velocidade escolhida.
- As versões adicionadas ficam na sessão atual da GUI. Elas não entram na exportação ainda.

### Pré-visualizações na árvore
- Vídeo: frame real do vídeo como miniatura, com a duração no canto.
- Imagem: miniatura maior (clique abre o visualizador).
- Áudio: botão de tocar direto na linha.
- Texto (txt, md, json, csv, código): trecho do conteúdo logo abaixo do nome.

## v4.2 — Pré-visualizações para tudo

- Texto (txt, md, json, csv, código): bloco escuro com as 5 primeiras linhas do que foi escrito, logo abaixo do nome.
- Imagem: miniatura real (clique abre o visualizador).
- Vídeo: frame real do vídeo, com a duração.
- Áudio: botão para tocar direto na linha.
- Pasta: pilha com até 3 prévias do que tem dentro, mais o ícone da pasta no canto.
- Outros tipos (zip, pdf etc.): cartão com a extensão do arquivo.
