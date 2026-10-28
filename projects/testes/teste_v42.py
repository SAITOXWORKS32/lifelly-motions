import pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path("/tmp/claude-0/-home-claude/634c3789-b639-5f85-9b44-328767e50eef/scratchpad")
GUI = (ROOT / "projetos-v4/index.html").resolve().as_uri()
DEMO = ROOT / "demo-projeto"
OUT = ROOT / "projetos-v4-prints"; OUT.mkdir(exist_ok=True)
# o host (aplicativo) é quem cria projetos: aqui simulamos o ouvinte do evento projects:new
HOST = """() => {
  window.__n = 0;
  document.addEventListener('projects:new', () => {
    window.__n++;
    const list = window.__projects || [];
    list.unshift({ id: 'novo' + window.__n, name: 'Projeto ' + window.__n, files: 0, members: [], favorite: false, shared: false, archived: false });
    window.__projects = list;
    window.Projetos.setProjects(list);
  });
}"""
errs = []
def check(c, m): print(("OK    " if c else "FALHA ") + m)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GUI)
    pg.evaluate(HOST)
    pg.evaluate("() => window.Projetos.setProjects([])")
    pg.wait_for_timeout(300)
    check(pg.is_visible("#empty-state"), "começa sem nenhum projeto (estado vazio)")
    pg.click("#btn-new-project-empty"); pg.wait_for_timeout(400)
    check(pg.locator("#project-list .project-row").count() == 1, "criar projeto pelo botão New project")
    pg.click("#btn-import"); pg.wait_for_timeout(300)
    pg.set_input_files("#folder-input", str(DEMO)); pg.wait_for_timeout(800)
    check(pg.locator("#import-tree .trow").count() > 0, "importar pasta mostra a árvore")
    pg.screenshot(path=str(OUT / "v42-importar.png"))
    pg.click("#btn-import-go"); pg.wait_for_timeout(1200)
    check(pg.locator("#tree .trow").count() > 0, "importação cria o projeto com a árvore")
    for _ in range(8):
        closed = pg.locator("#tree [data-toggle][aria-label='Abrir']")
        if closed.count() == 0: break
        closed.first.click(); pg.wait_for_timeout(250)
    pg.wait_for_timeout(2500)
    pg.screenshot(path=str(OUT / "v42-arvore-previews.png"))
    check(pg.locator("#tree .txt-prev").count() >= 1, "texto mostra preview escuro")
    lines = pg.locator("#tree .txt-prev .txt-line").count()
    check(lines == 5, f"preview de texto tem 5 linhas (tem {lines})")
    check(pg.locator("#tree .thumb-stack").count() >= 1, "pastas mostram pilha de prévias")
    check(pg.locator("#tree .thumb-ext").count() >= 1, "outros tipos mostram cartão com a extensão")
    check(pg.locator("#tree .thumb-vid-in img").count() >= 1, "vídeo mostra frame real")
    check(pg.locator("#tree [data-audio]").count() == 1, "áudio tem preview tocável")
    b.close()
print("\nErros de JS:", errs or "nenhum")
