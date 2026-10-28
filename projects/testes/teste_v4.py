# Teste da GUI Projetos v4: player estilo YouTube + animações. Dados falsos só para teste.
import base64, io, pathlib
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path("/tmp/claude-0/-home-claude/634c3789-b639-5f85-9b44-328767e50eef/scratchpad")
GUI = (ROOT / "projetos-v4/index.html").resolve().as_uri()
TEST = ROOT / "projetos-v4-teste"
OUT = ROOT / "projetos-v4-prints"
OUT.mkdir(parents=True, exist_ok=True)

def b64(path): return base64.b64encode(path.read_bytes()).decode()
def png_url(color, label):
    im = Image.new("RGB", (320, 200), color)
    ImageDraw.Draw(im).text((12, 12), label, fill=(255, 255, 255))
    buf = io.BytesIO(); im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

V1 = "data:video/mp4;base64," + b64(TEST / "cena-intro.mp4")
V2 = "data:video/mp4;base64," + b64(TEST / "trailer-jogo.mp4")
NODES = [
    {"path": "Cena", "type": "folder", "size": 0},
    {"path": "Cena/Fundo", "type": "folder", "size": 0},
    {"path": "Cena/Fundo/ceu.png", "type": "file", "size": 48000, "mime": "image/png", "url": png_url((60,60,90), "ceu")},
    {"path": "Cena/intro.mp4", "type": "file", "size": 2400000, "mime": "video/mp4", "url": V1},
    {"path": "Referencias", "type": "folder", "size": 0},
    {"path": "Referencias/trailer.mp4", "type": "file", "size": 1800000, "mime": "video/mp4", "url": V2},
    {"path": "Referencias/paleta.png", "type": "file", "size": 12000, "mime": "image/png", "url": png_url((90,60,60), "paleta")},
    {"path": "Sem pasta.png", "type": "file", "size": 9000, "mime": "image/png", "url": png_url((50,50,50), "raiz")},
]
PROJECTS = [{"id": "p1", "name": "Jogo de plataforma", "files": 8, "members": ["CK"], "favorite": True, "shared": False, "archived": False}]
META = {"Cena": {"icon": "film", "category": "Arte"}, "Referencias": {"category": "Referências"}}

SEED = """([projects, files, meta]) => {
  window.Projetos.setProjects(projects);
  window.Projetos.setFiles('p1', files);
  window.Projetos.setMeta('p1', meta);
}"""

errs = []
def new_page(b, w, h, mobile=False):
    ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, record_video_dir=None)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
    pg.goto(GUI)
    pg.evaluate(SEED, [PROJECTS, NODES, META])
    pg.click("#project-list .project-row")
    pg.wait_for_timeout(300)
    return pg

def check(cond, msg):
    print(("OK   " if cond else "FALHA"), msg)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    pg = new_page(b, 1100, 760)
    pg.evaluate("() => { const r = document.querySelector('#tree [data-toggle][data-toggle=\"Cena\"]'); }")
    # abre a pasta Cena e Referências para ver os vídeos
    pg.click("#tree [data-toggle='Cena']"); pg.wait_for_timeout(120)
    pg.click("#tree [data-toggle='Referencias']"); pg.wait_for_timeout(600)

    # animação de abrir/fechar pasta (mutateTree -> animateRows)
    pg.click("#tree [data-toggle='Cena']")
    n_anim = pg.evaluate("() => document.querySelectorAll('#tree .trow').length && Array.from(document.querySelectorAll('#tree .trow')).reduce((a,r)=>a+r.getAnimations().length,0)")
    check(n_anim > 0, f"animação ao fechar pasta dispara ({n_anim} animações em linhas)")
    pg.wait_for_timeout(600)
    pg.click("#tree [data-toggle='Cena']"); pg.wait_for_timeout(600)

    pg.click("#tree [data-lb='Cena/intro.mp4']")
    pg.wait_for_timeout(500)
    check(pg.is_visible("#player"), "player abre ao clicar no vídeo")
    check(pg.inner_text("#pl-title") == "intro", f"título = {pg.inner_text('#pl-title')!r}")
    check(pg.inner_text("#pl-count") == "1 de 2", f"contagem = {pg.inner_text('#pl-count')!r}")
    check(pg.locator("#pl-list .pl-item").count() == 2, "lista lateral tem 2 vídeos")

    pg.wait_for_timeout(800)
    dur = pg.evaluate("() => document.querySelector('#pl-video').duration")
    check(dur and dur > 1, f"vídeo carregou (duração {dur})")
    pg.wait_for_timeout(900)
    paused = pg.evaluate("() => document.querySelector('#pl-video').paused")
    check(paused is False, "vídeo começa sozinho ao abrir (autoplay)")
    pg.click("#pl-play"); pg.wait_for_timeout(300)
    check(pg.evaluate("() => document.querySelector('#pl-video').paused") is True, "botão play/pause alterna para pausado")
    pg.click("#pl-play"); pg.wait_for_timeout(300)
    t1 = pg.evaluate("() => document.querySelector('#pl-video').currentTime")
    check(t1 > 0, f"tempo avança ({t1:.2f}s)")
    pg.wait_for_timeout(700)
    pg.screenshot(path=str(OUT / "player-tocando.png"))

    pg.evaluate("() => document.activeElement && document.activeElement.blur()")
    pg.keyboard.press("Space"); pg.wait_for_timeout(200)
    check(pg.evaluate("() => document.querySelector('#pl-video').paused") is True, "Espaço pausa")
    pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(200)
    t2 = pg.evaluate("() => document.querySelector('#pl-video').currentTime")
    check(t2 > t1, f"seta direita avança 5s ({t1:.2f} → {t2:.2f})")

    pg.click("#pl-speed"); pg.wait_for_timeout(120)
    check(pg.is_visible("#pl-speed-menu"), "menu de velocidade abre")
    pg.click("#pl-speed-menu [data-speed='1.5']"); pg.wait_for_timeout(120)
    check(pg.inner_text("#pl-speed") == "1.5x", f"velocidade = {pg.inner_text('#pl-speed')!r}")
    check(pg.evaluate("() => document.querySelector('#pl-video').playbackRate") == 1.5, "playbackRate aplicado")

    pg.click("#pl-next"); pg.wait_for_timeout(500)
    check(pg.inner_text("#pl-title") == "trailer", f"próximo vídeo = {pg.inner_text('#pl-title')!r}")
    check(pg.inner_text("#pl-count") == "2 de 2", "contagem atualizada")
    check(pg.evaluate("() => document.querySelector('#pl-video').playbackRate") == 1.5, "velocidade mantida ao trocar vídeo")
    pg.keyboard.press("n"); pg.wait_for_timeout(300)
    check(pg.inner_text("#pl-title") == "intro", "tecla N volta ao primeiro (lista circular)")

    pg.click("#pl-progress", position={"x": 300, "y": 2}); pg.wait_for_timeout(300)
    seeked = pg.evaluate("() => { const v=document.querySelector('#pl-video'); return v.currentTime/v.duration; }")
    check(0.1 < seeked < 0.6, f"clique na barra busca posição ({seeked:.2f})")

    pg.screenshot(path=str(OUT / "player-desktop.png"))
    pg.click("#pl-reveal"); pg.wait_for_timeout(600)
    check(not pg.is_visible("#player"), "'mostrar na árvore' fecha o player")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / "arvore-destacada.png"))

    pg.click("#tree [data-lb='Referencias/trailer.mp4']"); pg.wait_for_timeout(400)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check(not pg.is_visible("#player"), "Escape fecha o player")

    # celular
    m = new_page(b, 390, 844, mobile=True)
    m.click("#tree [data-toggle='Cena']"); m.wait_for_timeout(500)
    m.click("#tree [data-lb='Cena/intro.mp4']"); m.wait_for_timeout(900)
    m.screenshot(path=str(OUT / "player-celular.png"))
    sw = m.evaluate("() => document.documentElement.scrollWidth")
    check(sw <= 390, f"sem rolagem horizontal no celular (largura {sw})")
    m.close()

    # sem animação quando o usuário pede reduzir movimento
    r = b.new_context(viewport={"width": 1000, "height": 700}, reduced_motion="reduce")
    rp = r.new_page(); rp.on("pageerror", lambda e: errs.append(str(e)))
    rp.goto(GUI); rp.evaluate(SEED, [PROJECTS, NODES, META]); rp.click("#project-list .project-row"); rp.wait_for_timeout(200)
    rp.click("#tree [data-toggle='Cena']"); rp.wait_for_timeout(80)
    rn = rp.evaluate("() => Array.from(document.querySelectorAll('#tree .trow')).reduce((a,r)=>a+r.getAnimations().length,0)")
    check(rn == 0, f"reduced-motion: sem animações ({rn})")

    b.close()

print("\nErros de JS:", errs if errs else "nenhum")
