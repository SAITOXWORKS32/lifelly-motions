import base64, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path("/tmp/claude-0/-home-claude/634c3789-b639-5f85-9b44-328767e50eef/scratchpad")
GUI = (ROOT / "projetos-v4/index.html").resolve().as_uri()
OUT = ROOT / "projetos-v4-prints"; OUT.mkdir(exist_ok=True)
A = ROOT / "projetos-v4-teste/anexo"
def du(p, mime): return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()
NODES = [
    {"path": "Video anexo.mp4", "type": "file", "size": 2715182, "mime": "video/mp4", "url": du(A/"video-anexo.mp4", "video/mp4")},
    {"path": "Trilha.mp3", "type": "file", "size": 601323, "mime": "audio/mpeg", "url": du(A/"audio-trilha.mp3", "audio/mpeg")},
    {"path": "Roteiro.txt", "type": "file", "size": 117, "mime": "text/plain", "url": du(A/"roteiro.txt", "text/plain")},
]
PROJ = [{"id": "p1", "name": "Teste v4.1", "files": 3, "members": ["CK"], "favorite": False, "shared": False, "archived": False}]
errs = []
def check(c, m): print(("OK    " if c else "FALHA ") + m)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GUI)
    pg.evaluate("([a,f]) => { window.Projetos.setProjects(a); window.Projetos.setFiles('p1', f); window.Projetos.setMeta('p1', {}); }", [PROJ, NODES])
    pg.click("#project-list .project-row"); pg.wait_for_timeout(3000)

    check(pg.locator(".thumb-vid-in img").count() == 1, "miniatura real do vídeo (frame) aparece na árvore")
    check(pg.inner_text(".thumb-dur").strip() == "0:37", f"duração na miniatura = {pg.inner_text('.thumb-dur')!r}")
    check("Roteiro da cena" in pg.inner_text("[data-snip='Roteiro.txt']"), "texto mostra trecho do conteúdo")
    check(pg.locator("[data-audio='Trilha.mp3']").count() == 1, "áudio tem botão de tocar na linha")
    pg.click("[data-audio='Trilha.mp3']"); pg.wait_for_timeout(400)
    check(pg.evaluate("() => AUDIO.paused") is False, "tocar áudio pela linha funciona")
    pg.click("[data-audio='Trilha.mp3']"); pg.wait_for_timeout(200)
    pg.screenshot(path=str(OUT / "v41-arvore-previews.png"))

    pg.click("#tree [data-lb='Video anexo.mp4']"); pg.wait_for_timeout(2500)
    ar = pg.evaluate("() => document.querySelector('#pl-stage').style.getPropertyValue('--ar')")
    sw = pg.evaluate("() => document.querySelector('#pl-stage').getBoundingClientRect().width")
    sh = pg.evaluate("() => document.querySelector('#pl-stage').getBoundingClientRect().height")
    check(abs(float(ar) - 0.5625) < 0.01 and sh < 760, f"palco segue a proporção vertical do vídeo (ar={ar}, {sw:.0f}x{sh:.0f})")
    card = pg.evaluate("() => { const r=document.querySelector('.pl-card').getBoundingClientRect(); return [r.width, r.height] }")
    check(card[0] < 1280 and card[1] < 800, f"player é cartão centralizado, não tela toda ({card[0]:.0f}x{card[1]:.0f})")
    check(pg.inner_text("#pl-quality") == "1024p", f"qualidade original = {pg.inner_text('#pl-quality')!r}")
    pg.screenshot(path=str(OUT / "v41-player-original.png"))

    pg.wait_for_timeout(500)
    wake = lambda: (pg.mouse.move(400, 300), pg.wait_for_timeout(60))
    wake(); pg.click("#pl-play"); pg.wait_for_timeout(200)  # pausa
    wake(); pg.click("#pl-play"); pg.wait_for_timeout(2000)  # toca de novo
    t_before = pg.evaluate("() => document.querySelector('#pl-video').currentTime")

    wake(); pg.click("#pl-quality"); pg.wait_for_timeout(150)
    check(pg.is_visible("#pl-quality-menu"), "menu de qualidade abre")
    pg.click("#pl-add-open"); pg.wait_for_timeout(120)
    pg.set_input_files("#pl-add-file", str(A/"video-720.mp4"))
    pg.click("#pl-add-save"); pg.wait_for_timeout(1800)
    check(pg.inner_text("#pl-quality") == "720p", f"adicionar 720p troca a qualidade ({pg.inner_text('#pl-quality')!r})")
    st = pg.evaluate("() => { const v=document.querySelector('#pl-video'); return [v.currentTime, v.paused, v.videoHeight] }")
    check(st[1] is False and st[0] >= t_before - 0.6, f"troca mantém o tempo ({t_before:.1f}s → {st[0]:.1f}s) e continua tocando")
    dims = pg.evaluate("() => { const v=document.querySelector('#pl-video'); return [v.videoWidth, v.videoHeight, v.readyState, v.currentSrc.slice(0,30)] }")
    check(dims[0] == 406, f"o vídeo carregado é o de 720p (largura {dims[0]}, original tem 576)")
    pg.screenshot(path=str(OUT / "v41-player-720.png"))

    wake(); pg.click("#pl-quality"); pg.wait_for_timeout(120)
    pg.click("#pl-add-open"); pg.wait_for_timeout(120)
    pg.select_option("#pl-add-h", "custom"); pg.fill("#pl-add-custom", "900")
    pg.set_input_files("#pl-add-file", str(A/"video-360.mp4"))
    pg.click("#pl-add-save"); pg.wait_for_timeout(1500)
    check(pg.inner_text("#pl-quality") == "900p", f"altura personalizada (900p) funciona ({pg.inner_text('#pl-quality')!r})")
    labels = pg.evaluate("() => Array.from(document.querySelectorAll('#pl-q-list [data-q]')).map(b=>b.textContent.trim())")
    check(len(labels) == 3, f"lista de qualidades = {labels}")

    wake(); pg.click("#pl-quality"); pg.wait_for_timeout(120)
    wake(); pg.click("#pl-q-list [data-q='orig']"); pg.wait_for_timeout(1500)
    check(pg.inner_text("#pl-quality") == "1024p" and pg.evaluate("() => document.querySelector('#pl-video').videoHeight") == 1024, "voltar para original funciona")

    wake(); pg.click("#pl-quality"); pg.wait_for_timeout(120)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(120)
    check(not pg.is_visible("#pl-quality-menu") and pg.is_visible("#player"), "Esc fecha só o menu, o player continua aberto")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(120)
    check(not pg.is_visible("#player"), "Esc fecha o player")

    pg.click("#tree [data-lb='Video anexo.mp4']"); pg.wait_for_timeout(1500)
    pg.mouse.click(8, 8); pg.wait_for_timeout(150)
    check(not pg.is_visible("#player"), "clicar fora do cartão fecha o player")

    m = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    m.on("pageerror", lambda e: errs.append(str(e)))
    m.goto(GUI)
    m.evaluate("([a,f]) => { window.Projetos.setProjects(a); window.Projetos.setFiles('p1', f); window.Projetos.setMeta('p1', {}); }", [PROJ, NODES])
    m.click("#project-list .project-row"); m.wait_for_timeout(1500)
    m.click("#tree [data-lb='Video anexo.mp4']"); m.wait_for_timeout(1800)
    m.screenshot(path=str(OUT / "v41-player-celular.png"))
    check(m.evaluate("() => document.documentElement.scrollWidth") <= 390, "celular: sem rolagem horizontal")
    b.close()
print("\nErros de JS:", errs or "nenhum")
