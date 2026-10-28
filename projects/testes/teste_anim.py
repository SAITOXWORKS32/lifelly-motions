import pathlib
src = open("projetos-v4-teste/teste_v4.py", encoding="utf-8").read()
exec(src.split("with sync_playwright() as p:")[0])
COUNT = "() => Array.from(document.querySelectorAll('#tree .trow')).reduce((a,r)=>a+r.getAnimations().length,0)"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = new_page(b, 1100, 760)
    pg.click("#tree [data-toggle='Cena']"); pg.wait_for_timeout(500)

    # 1) pasta criada: entra com pop
    pg.click("#btn-new-folder"); pg.wait_for_timeout(150)
    pg.fill(".inline-input", "Nova pasta")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(60)
    check(pg.evaluate(COUNT) > 0, "criar pasta: animação de entrada")
    pg.wait_for_timeout(600)
    pg.screenshot(path=str(OUT / "anim-pasta-criada.png"))

    # 2) ícone trocado: wobble na linha
    pg.click("#tree [data-more='Referencias']"); pg.wait_for_timeout(150)
    pg.click(".menu-item[data-act='icon']"); pg.wait_for_timeout(120)
    pg.click(".icon-opt[data-icon='code']")
    check(pg.evaluate(COUNT) > 0, "trocar ícone: wobble na linha")
    pg.wait_for_timeout(600)

    # 3) agrupar: linhas deslizam para dentro da nova pasta
    pg.click("#btn-select"); pg.wait_for_timeout(150)
    pg.click("#tree [data-toggle='Referencias']"); pg.wait_for_timeout(500)
    pg.click("#tree [data-select='Sem pasta.png']")
    pg.click("#tree [data-select='Referencias/paleta.png']")
    pg.click("#sel-bar [data-sel='group']"); pg.wait_for_timeout(120)
    pg.fill(".inline-input", "Agrupado")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(60)
    check(pg.evaluate(COUNT) > 0, "agrupar: animação de reorganização")
    pg.wait_for_timeout(600)
    pg.screenshot(path=str(OUT / "anim-agrupado.png"))

    # 4) excluir com saída animada: a linha desliza para fora e só depois é removida
    pg.hover("#tree [data-path='Agrupado']")
    pg.click("#tree [data-delete='Agrupado']"); pg.wait_for_timeout(150)
    pg.click("#confirm-ok"); pg.wait_for_timeout(60)
    check(pg.evaluate("() => { const r=document.querySelector(\"#tree [data-path='Agrupado']\"); return r ? r.getAnimations().length : 0 }") > 0, "excluir: linha anima a saída")
    pg.wait_for_timeout(600)
    check(pg.locator("#tree [data-path='Agrupado']").count() == 0, "excluir: item removido ao final")

    b.close()
print("\nErros de JS:", errs if errs else "nenhum")
