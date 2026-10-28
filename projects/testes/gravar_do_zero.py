import pathlib, shutil, subprocess
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path("/tmp/claude-0/-home-claude/634c3789-b639-5f85-9b44-328767e50eef/scratchpad")
GUI = (ROOT / "projetos-v4/index.html").resolve().as_uri()
DEMO = ROOT / "demo-projeto"
A = ROOT / "projetos-v4-teste/anexo"
VID = ROOT / "projetos-v42-video"
shutil.rmtree(VID, ignore_errors=True); VID.mkdir(parents=True)

HOST = """() => {
  window.__n = 0; window.__projects = [];
  document.addEventListener('projects:new', () => {
    window.__n++;
    window.__projects.unshift({ id: 'proj' + window.__n, name: 'Meu primeiro projeto', files: 0, members: [], favorite: false, shared: false, archived: false, updatedAt: new Date().toISOString() });
    window.Projetos.setProjects(window.__projects);
  });
}"""
CAP = """() => {
  const d = document.createElement('div');
  d.id = 'cap';
  d.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:999;background:rgba(12,12,12,.94);color:#f2f2f2;border:1px solid #333;padding:10px 18px;border-radius:12px;font:600 15px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.5);pointer-events:none;max-width:90vw;text-align:center';
  document.body.appendChild(d);
  window.__cap = (t) => { d.textContent = t; };
}"""
NAME_PATH = """(n) => { const r = [...document.querySelectorAll('#tree .trow')].find(x => x.querySelector('.trow-name') && x.querySelector('.trow-name').childNodes[0].textContent.trim() === n); return r ? r.dataset.path : null; }"""

with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, record_video_dir=str(VID), record_video_size={"width": 1280, "height": 800}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: print("ERRO JS:", e))
    pg.goto(GUI)
    pg.evaluate(HOST)
    pg.evaluate("() => window.Projetos.setProjects([])")
    pg.evaluate(CAP)
    def cap(t, ms=1800):
        pg.evaluate("(t) => window.__cap(t)", t); pg.wait_for_timeout(ms)
    def path_of(name):
        return pg.evaluate(NAME_PATH, name)
    def open_all():
        for _ in range(12):
            c = pg.locator("#tree [data-toggle][aria-label='Abrir']")
            if c.count() == 0: break
            c.first.click(); pg.wait_for_timeout(350)

    cap("Começando sem nenhum projeto", 2600)
    cap("1. Criar um projeto novo (New project)", 1200)
    pg.click("#btn-new-project-empty"); pg.wait_for_timeout(1400)
    cap("2. Abrir o projeto (ainda vazio)", 1200)
    pg.click("#project-list .project-row"); pg.wait_for_timeout(1500)
    cap("3. Nova pasta: 'Rascunhos' (animação de entrada)", 1000)
    pg.click("#btn-new-folder"); pg.wait_for_timeout(500)
    pg.type(".inline-input", "Rascunhos", delay=70); pg.wait_for_timeout(300)
    pg.keyboard.press("Enter"); pg.wait_for_timeout(1500)
    cap("4. Importar pasta do computador (demo-projeto)", 1000)
    pg.click("#btn-import-into"); pg.wait_for_timeout(900)
    pg.set_input_files("#folder-input", str(DEMO)); pg.wait_for_timeout(1500)
    pg.click("#btn-import-go"); pg.wait_for_timeout(2000)
    cap("5. Abrir as pastas: prévias de texto, vídeo, áudio, imagens e pilhas de pastas", 1200)
    open_all(); pg.wait_for_timeout(2500)
    pg.evaluate("() => { const t=document.querySelector('#tree'); t.scrollTop = 0; }")
    pg.wait_for_timeout(1500)
    cap("6. Pesquisar 'heroi'", 800)
    pg.fill("#tree-search", "heroi"); pg.wait_for_timeout(1400)
    pg.fill("#tree-search", ""); pg.wait_for_timeout(700)
    cap("7. Filtrar por tipo: vídeos", 800)
    pg.click("#type-chips [data-type='video']"); pg.wait_for_timeout(1400)
    pg.click("#type-chips [data-type='all']"); pg.wait_for_timeout(800)
    cap("8. Trocar o ícone da pasta (a linha balança)", 900)
    pg.click(f"#tree [data-more='{path_of('Referencias')}']"); pg.wait_for_timeout(500)
    pg.click(".menu-item[data-act='icon']"); pg.wait_for_timeout(700)
    pg.click(".icon-opt[data-icon='film']"); pg.wait_for_timeout(1200)
    cap("9. Criar a categoria 'Referências' e filtrar por ela", 900)
    pg.click(f"#tree [data-more='{path_of('Referencias')}']"); pg.wait_for_timeout(500)
    pg.click(".menu-item[data-act='cat']"); pg.wait_for_timeout(500)
    pg.fill(".cat-new input", "Referências"); pg.click(".cat-new button"); pg.wait_for_timeout(1300)
    pg.click("#cat-chips [data-cat-filter='Referências']"); pg.wait_for_timeout(1300)
    pg.click("#cat-chips [data-cat-filter='Referências']"); pg.wait_for_timeout(700)
    cap("10. Renomear um arquivo", 900)
    pg.click(f"#tree [data-rename='{path_of('nuvem.png')}']"); pg.wait_for_timeout(500)
    pg.fill(".inline-input", "nuvem-noite.png"); pg.keyboard.press("Enter"); pg.wait_for_timeout(1400)
    cap("11. Mover um arquivo para outra pasta", 900)
    pg.click(f"#tree [data-move='{path_of('Sem pasta.png')}']"); pg.wait_for_timeout(600)
    pg.select_option(".move-panel select", index=1); pg.wait_for_timeout(1500)
    cap("12. Selecionar vários arquivos e agrupar em uma pasta", 900)
    pg.click("#btn-select"); pg.wait_for_timeout(500)
    pg.click(f"#tree [data-select='{path_of('roteiro.txt')}']"); pg.wait_for_timeout(300)
    pg.click(f"#tree [data-select='{path_of('pacote.zip')}']"); pg.wait_for_timeout(400)
    pg.click("#sel-bar [data-sel='group']"); pg.wait_for_timeout(500)
    pg.type(".inline-input", "Documentos", delay=70); pg.keyboard.press("Enter"); pg.wait_for_timeout(1600)
    pg.click("#sel-bar [data-sel='exit']"); pg.wait_for_timeout(700)
    cap("13. Desagrupar a pasta", 900)
    docs = path_of("Documentos")
    pg.click(f"#tree [data-more='{docs}']"); pg.wait_for_timeout(500)
    pg.click(".menu-item[data-act='ungroup']"); pg.wait_for_timeout(900)
    if pg.locator("#confirm-ok").is_visible(): pg.click("#confirm-ok")
    pg.wait_for_timeout(1600)
    cap("14. Excluir um arquivo (pede confirmação)", 900)
    pg.click(f"#tree [data-delete='{path_of('trilha.mp3')}']"); pg.wait_for_timeout(900)
    pg.click("#confirm-ok"); pg.wait_for_timeout(1600)
    cap("15. Visualizar uma imagem em tela cheia", 900)
    pg.click(f"#tree [data-lb='{path_of('ceu.png')}']"); pg.wait_for_timeout(2200)
    pg.click("#lb-close"); pg.wait_for_timeout(700)
    cap("16. Player de vídeo: velocidade, qualidade e lista", 1000)
    pg.click(f"#tree [data-lb='{path_of('intro.mp4')}']"); pg.wait_for_timeout(2600)
    pg.mouse.move(400, 300); pg.wait_for_timeout(200)
    pg.click("#pl-speed"); pg.wait_for_timeout(600)
    pg.click("#pl-speed-menu [data-speed='1.5']"); pg.wait_for_timeout(1200)
    pg.mouse.move(400, 300); pg.wait_for_timeout(150)
    pg.click("#pl-quality"); pg.wait_for_timeout(700)
    pg.click("#pl-add-open"); pg.wait_for_timeout(600)
    pg.set_input_files("#pl-add-file", str(A/"video-720.mp4")); pg.wait_for_timeout(400)
    pg.click("#pl-add-save"); pg.wait_for_timeout(2400)
    pg.mouse.move(400, 300); pg.wait_for_timeout(150)
    pg.click("#pl-quality"); pg.wait_for_timeout(700)
    pg.click("#pl-q-list [data-q='orig']"); pg.wait_for_timeout(2200)
    pg.mouse.move(400, 300); pg.wait_for_timeout(150)
    pg.click("#pl-close"); pg.wait_for_timeout(900)
    cap("17. Exportar o projeto", 900)
    pg.click("#btn-export"); pg.wait_for_timeout(1000)
    pg.click("#ex-go"); pg.wait_for_timeout(1600)
    if pg.locator("#ex-close").is_visible(): pg.click("#ex-close")
    pg.wait_for_timeout(800)
    cap("Pronto: tudo criado do zero pela interface", 3000)
    ctx.close(); b.close()

src_v = sorted(VID.glob("*.webm"), key=lambda f: f.stat().st_mtime)[-1]
out = VID / "demo-do-zero-v4.2.mp4"
subprocess.run(["ffmpeg","-y","-loglevel","error","-i",str(src_v),"-c:v","libx264","-pix_fmt","yuv420p","-crf","23","-preset","veryfast",str(out)], check=True)
print("video:", out, out.stat().st_size)
