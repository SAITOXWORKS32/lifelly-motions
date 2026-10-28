# Projetos — instruções de funcionamento (versão 4.2)

GUI de gerenciamento de projetos e arquivos, em HTML, CSS e JavaScript puros (sem dependências). Abra `index.html` no navegador. Os arquivos são `index.html`, `app.js` e `styles.css`.

## 1. Como integrar com o seu sistema

A GUI não guarda dados sozinha. Quem alimenta e reage a ela é o aplicativo host, usando a API global `window.Projetos`.

| Chamada | O que faz |
|---|---|
| `Projetos.setProjects([...])` | Define a lista de projetos da tela inicial. |
| `Projetos.setFiles(id, [...])` | Define os arquivos e pastas de um projeto. |
| `Projetos.setMeta(id, {...})` | Define ícones e categorias: `{ "pasta/caminho": { icon, category } }`. |
| `Projetos.openProject(id)` | Abre um projeto. |
| `Projetos.back()` | Volta para a lista de projetos. |
| `Projetos.exportProject(opts)` | Abre a tela de exportação do projeto aberto. |
| `Projetos.confirm(texto, rótuloOK, opts)` | Mostra o cartão de confirmação da GUI e devolve uma Promise com `true` ou `false`. |

Formato de um projeto:
```js
{ id: "p1", name: "Jogo de plataforma", files: 9, members: ["CK"],
  favorite: false, shared: false, archived: false, updatedAt: "2026-10-28T03:00:00Z" }
```

Formato de um arquivo ou pasta (o caminho usa `/` e é a chave de tudo):
```js
{ path: "Cena/intro.mp4", type: "file", size: 2715182, mime: "video/mp4", url: "https://..." }
{ path: "Cena", type: "folder", size: 0 }
```
- `url` é o endereço do arquivo. Também aceita `file` (um objeto `File`, do upload local).
- Imagens e vídeos são reconhecidos pelo `mime` ou pela extensão.

## 2. Eventos que a GUI dispara (escute em `document`)

Todos são `CustomEvent`s. O host decide o que fazer com eles e salva no seu banco.

| Evento | Quando | `detail` |
|---|---|---|
| `projects:new` | Clique em "New project". O host deve criar o projeto e chamar `setProjects`. | — |
| `projects:open` | Um projeto foi aberto. | `{ id }` |
| `file:folder-create` | Nova pasta criada. | `{ projectId, path }` |
| `file:rename` | Arquivo ou pasta renomeado. | `{ projectId, from, to }` |
| `file:move` | Item movido para outra pasta. | `{ projectId, from, to, type }` |
| `file:group` | Itens selecionados agrupados em uma nova pasta. | `{ projectId, folder, paths }` |
| `file:ungroup` | Pasta desfeita (conteúdo sobe um nível). | `{ projectId, path, moved }` |
| `file:icon` | Ícone de pasta alterado. | `{ projectId, path, icon }` |
| `file:category` | Categoria aplicada. `category` é `null` quando removida. | `{ projectId, paths, category }` |
| `file:delete` | Exclusão confirmada. | `{ projectId, path, type }` ou `{ projectId, paths }` |
| `project:import` | Pasta importada do computador (novo projeto ou dentro de um existente). | `{ projectId, name, nodes, skipped }` |
| `project:export` | Exportação feita. | `{ projectId, scope, folder, format, files, skipped }` |

Exemplo:
```js
document.addEventListener("file:rename", (e) => {
  const { projectId, from, to } = e.detail;
  // salvar no seu banco
});
```

## 3. Funcionalidades

**Lista de projetos**
- Cards ou linhas, botão "New project" e "Importar pasta" (cria um projeto a partir de uma pasta do computador).
- Tela vazia quando não há projetos.

**Árvore de arquivos (dentro do projeto)**
- Pastas abrem e fecham. Ao abrir uma pasta, ela mostra o conteúdo; ao fechar, o conteúdo some.
- Ações por linha: renomear, mover (escolhe a pasta de destino), excluir e "Mais ações" (nova pasta dentro, trocar ícone, desagrupar, exportar a pasta, categoria, selecionar).
- "Nova pasta" na barra superior.
- "Importar pasta" dentro do projeto (adiciona os arquivos ao projeto existente).

**Pesquisa e filtros**
- Campo de pesquisa na pasta atual.
- Filtro por tipo: Todos, Imagens, Vídeos, Outros.
- Filtro por categoria (chips).

**Seleção múltipla**
- Botão "Selecionar" mostra uma caixinha em cada linha.
- Barra de ações: selecionar visíveis, agrupar, categoria, exportar, excluir.

**Ícones e categorias**
- Ícones de pasta: escolha na lista de ícones (ex.: pasta, filme, música, paleta, código). A linha balança ao trocar.
- Categorias: crie uma nova ou escolha uma existente; o item balança ao mudar.

**Pré-visualizações (na árvore)**
- Imagem: miniatura real. Clique abre o visualizador (setas e teclado).
- Vídeo: frame real com a duração. Clique abre o player.
- Áudio: botão de tocar na própria linha.
- Texto (txt, md, json, csv, código): bloco escuro com as 5 primeiras linhas.
- Pasta: pilha com até 3 prévias do conteúdo e o ícone da pasta.
- Outros tipos: cartão com a extensão (ex.: ZIP).

**Player de vídeo**
- Cartão centralizado; o palco segue a proporção do vídeo (vertical ou horizontal).
- Play/pausa, anterior/próximo, volume, velocidade (0.5x a 2x), tela cheia, download.
- Lista lateral com os outros vídeos da pasta.
- Qualidade: lista das versões do vídeo; "+ Adicionar qualidade" aceita resolução de 144p a 2160p ou altura personalizada em px (ex.: 1820) e um arquivo daquela versão. Trocar de qualidade mantém o tempo e o estado de reprodução.
- Botão de pasta: fecha o player e mostra o vídeo na árvore.
- Atalhos: Espaço/K pausa; ←/→ voltam/avançam 5 s; ↑/↓ volume; M silencia; F tela cheia; N/P próximo/anterior; Esc fecha.
- Limitação: as qualidades adicionadas existem só na sessão atual da GUI. Elas não entram na exportação ainda.

**Exportação**
- Escopo: projeto inteiro, uma pasta ou a seleção atual.
- Filtros por tipo (imagens, vídeos, outros) e por categoria.
- Formato: `.zip` com os arquivos, ou `.txt` com a lista da estrutura.
- Opção de incluir ícones e categorias (`ximmer-metadados.json`).

**Animações**
- Pasta criada: entra com um pop.
- Mover, renomear, agrupar, desagrupar: as linhas deslizam para a nova posição.
- Ícone, categoria ou nome alterado: a linha balança.
- Exclusão e desagrupar: a linha sai deslizando antes de sumir.
- Respeita `prefers-reduced-motion` (sem animações para quem pede menos movimento).

## 4. Pontos de atenção para quem integra

- Toda mudança feita na GUI dispara um evento. O host precisa persistir essas mudanças; a GUI não salva nada no servidor.
- Use caminhos com `/` e sem barra no início. Pastas são nós do tipo `folder`.
- Ao renomear ou mover uma pasta, todos os caminhos dentro dela mudam. A GUI já faz isso na memória e avisa com o evento correspondente.
- Ao exportar, o nome do projeto e o da pasta têm os caracteres `\ / : * ? " < > |` trocados por `-` (o nome do arquivo gerado fica seguro para o sistema de arquivos).
- Para testes sem backend, o projeto traz `testes/teste_v4.py`, `testes/teste_v42.py` e `testes/gravar_do_zero.py` (Playwright).
