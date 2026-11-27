"""Tira a Resposta de oponente dos livros de SAGA 0.7 (PDF).

Uso: python3 tirar_resposta.py <pasta-dos-pdfs-originais> <pasta-de-saida> <pasta-das-fontes>
"""
import sys
from collections import Counter
from pathlib import Path

import pymupdf as fitz

ORIG, SAIDA, FONTES = (Path(a) for a in sys.argv[1:4])
SAIDA.mkdir(parents=True, exist_ok=True)

PESO = {
    "R": ("LexR", FONTES / "Lexend-Regular.ttf"),
    "SB": ("LexSB", FONTES / "Lexend-SemiBold.ttf"),
    "B": ("LexB", FONTES / "Lexend-Bold.ttf"),
    "XB": ("LexXB", FONTES / "Lexend-ExtraBold.ttf"),
}
METRICA = {k: fitz.Font(fontfile=str(v[1])) for k, v in PESO.items()}
SEPARADOR_CARTAO = (0.804, 0.749, 0.639)
log = []


def rgb(c):
    return ((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255


def perto(a, b, tol=0.02):
    return a is not None and all(abs(x - y) <= tol for x, y in zip(a, b))


# ------------------------------------------------------------------ leitura
def linhas(page):
    out = []
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            sp = []
            for s in l["spans"]:
                t = "".join(c["c"] for c in s["chars"])
                if t.strip():
                    sp.append(dict(texto=t, bbox=fitz.Rect(s["bbox"]), origin=s["origin"], size=s["size"],
                                   color=s["color"], font=s["font"]))
            if sp:
                out.append(dict(bbox=fitz.Rect(l["bbox"]), spans=sp, texto="".join(s["texto"] for s in sp)))
    return out


def achar(page, trecho, n=0):
    achadas = [l for l in linhas(page) if trecho in l["texto"]]
    if len(achadas) <= n:
        raise SystemExit(f"Não achei '{trecho}' na pág. {page.number + 1}")
    return achadas[n]


def cor_do_fundo(page, rect):
    """Cor mais comum numa faixa (pra pintar por cima sem deixar marca)."""
    pix = page.get_pixmap(clip=rect, dpi=72)
    cores = Counter()
    for y in range(pix.height):
        for x in range(pix.width):
            cores[pix.pixel(x, y)[:3]] += 1
    c = cores.most_common(1)[0][0]
    return tuple(v / 255 for v in c)


# ------------------------------------------------------------------ escrita
def escrever(page, x, y, runs, size, cor):
    """runs: [(texto, peso, cor_ou_None)] escritos lado a lado na linha de base y."""
    for texto, peso, c in runs:
        nome, arq = PESO[peso]
        page.insert_text((x, y), texto, fontname=nome, fontfile=str(arq), fontsize=size,
                         color=rgb(c if c is not None else cor))
        x += METRICA[peso].text_length(texto, fontsize=size)


def apagar_texto(page, rects):
    for r in rects:
        page.add_redact_annot(r)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                          text=fitz.PDF_REDACT_TEXT_REMOVE)


def encolher(r, dy=1.6):
    return fitz.Rect(r.x0 - 0.3, r.y0 + dy, r.x1 + 0.3, r.y1 - dy)


def reescrever(page, trecho, novas, primeiro_span=0):
    """Troca a linha que tem `trecho` e as seguintes (len(novas) linhas) por `novas`.
    Cada item de `novas` é uma lista de runs (texto, peso[, cor]); [] apaga a linha."""
    todas = linhas(page)
    if trecho.startswith("="):
        i = next(k for k, l in enumerate(todas) if l["texto"].strip() == trecho[1:])
    else:
        i = next(k for k, l in enumerate(todas) if trecho in l["texto"])
    base = todas[i]
    bb = base["bbox"]
    coluna = [l for l in todas if l is base or (
        l["bbox"].y0 > bb.y1 - 3 and l["bbox"].x0 >= bb.x0 - 60 and l["bbox"].x0 < bb.x1 and l["bbox"].x1 > bb.x0)]
    coluna.sort(key=lambda l: l["bbox"].y0)
    alvo = coluna[:len(novas)]
    ref = base["spans"][primeiro_span]
    cor, size = ref["color"], ref["size"]
    rects = []
    for k, l in enumerate(alvo):
        r = fitz.Rect(l["bbox"])
        if k == 0 and primeiro_span:
            r.x0 = ref["bbox"].x0
        rects.append(encolher(r))
    apagar_texto(page, rects)
    for k, (l, runs) in enumerate(zip(alvo, novas)):
        if not runs:
            continue
        sp = l["spans"][primeiro_span if k == 0 else 0]
        x = ref["origin"][0] if k == 0 else l["spans"][0]["origin"][0]
        escrever(page, x, sp["origin"][1], [(r[0], r[1], r[2] if len(r) > 2 else None) for r in runs], size, cor)
    log.append(f"p{page.number + 1}: reescrito «{trecho}»")


def cobrir(page, rect, cor=None):
    cor = cor or cor_do_fundo(page, fitz.Rect(rect.x0, rect.y0 - 4, rect.x1, rect.y0 - 0.5))
    apagar_texto(page, [rect])
    page.draw_rect(rect, color=None, fill=cor, overlay=True)


# ------------------------------------------------------------------ mover um pedaço da página pra cima
def fonte_recortada(doc_original, pno, clip):
    """Cópia da página com só o texto de dentro de `clip` (evita texto duplicado escondido)."""
    tmp = fitz.open()
    tmp.insert_pdf(doc_original, from_page=pno, to_page=pno)
    p = tmp[0]
    W, H = p.rect.width, p.rect.height
    for r in (fitz.Rect(0, 0, W, clip.y0), fitz.Rect(0, clip.y1, W, H),
              fitz.Rect(0, clip.y0, clip.x0, clip.y1), fitz.Rect(clip.x1, clip.y0, W, clip.y1)):
        if not r.is_empty:
            p.add_redact_annot(r)
    p.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
    return tmp


def subir(page, original, x0, x1, y_destino, y_origem, y_fim, cor_sobra, cor_fundo=None):
    """Move o conteúdo de [x0, y_origem, x1, y_fim] pra começar em y_destino.
    A faixa que sobra embaixo é pintada com cor_sobra."""
    h = y_origem - y_destino
    clip = fitz.Rect(x0, y_origem, x1, y_fim)
    fonte = fonte_recortada(original, page.number, clip)
    area = fitz.Rect(x0, y_destino, x1, y_fim)
    apagar_texto(page, [area])
    if cor_fundo:
        page.draw_rect(area, color=None, fill=cor_fundo, overlay=True)
    page.show_pdf_page(fitz.Rect(x0, y_destino, x1, y_fim - h), fonte, 0, clip=clip)
    page.draw_rect(fitz.Rect(x0, y_fim - h, x1, y_fim), color=None, fill=cor_sobra, overlay=True)


# ------------------------------------------------------------------ cartões de oponente
def tags_resposta(page):
    out = []
    for l in linhas(page):
        for s in l["spans"]:
            t = s["texto"].replace(" ", "")
            if t == "RESPOSTA" and "Bold" in s["font"] and s["size"] < 7.5:
                out.append(s)
    return out


def tirar_linha_resposta(page, original, tag):
    desenhos = page.get_drawings()
    seps = [d["rect"] for d in desenhos if perto(d.get("fill"), SEPARADOR_CARTAO) and d["rect"].height < 1.5
            and d["rect"].y1 <= tag["bbox"].y0 + 1 and d["rect"].x0 - 2 <= tag["bbox"].x0 + 8 and d["rect"].x1 > tag["bbox"].x1 + 100]
    if not seps:
        # cartão sem linhas (ex.: exemplo de jogo): só apaga o texto da linha
        l = next(l for l in linhas(page) if any(s is tag or s["bbox"] == tag["bbox"] for s in l["spans"]))
        apagar_texto(page, [encolher(l["bbox"], 0.5)])
        return "texto"
    sep = max(seps, key=lambda r: r.y1)
    cores_especial = [(0.859, 0.918, 0.922), (0.953, 0.882, 0.831)]
    esp = [d for d in desenhos if d.get("fill") and any(perto(d["fill"], c) for c in cores_especial)
           and d["rect"].height > 15 and d["rect"].width > 150
           and d["rect"].x0 <= tag["bbox"].x0 and d["rect"].x1 >= tag["bbox"].x1 + 100
           and -1 <= d["rect"].y0 - tag["bbox"].y1 <= 30]
    if esp:
        e = min(esp, key=lambda d: d["rect"].y0)
        E = e["rect"]
        cor_corpo = cor_do_fundo(page, fitz.Rect(sep.x0 + 80, sep.y0 - 3, sep.x1 - 60, sep.y0 - 0.6))
        subir(page, original, E.x0, E.x1, sep.y0, E.y0, E.y1, tuple(e["fill"]), cor_corpo)
        return "subiu Especial"
    # última linha do cartão: pinta com a cor do corpo
    ls = [l for l in linhas(page) if l["bbox"].y0 >= sep.y0 - 0.5 and sep.x0 - 10 <= l["bbox"].x0 <= sep.x1]
    ls.sort(key=lambda l: l["bbox"].y0)
    fim = tag["bbox"].y1
    for l in ls:
        if l["bbox"].y0 - fim < 4:
            fim = max(fim, l["bbox"].y1)
    cor_corpo = cor_do_fundo(page, fitz.Rect(sep.x0 + 80, sep.y0 - 3, sep.x1 - 60, sep.y0 - 0.6))
    cobrir(page, fitz.Rect(sep.x0 - 1, sep.y0, sep.x1 + 1, fim + 2.5), cor_corpo)
    return "última linha"


def limpar_cartoes(page, original):
    for tag in sorted(tags_resposta(page), key=lambda s: (s["bbox"].y0, s["bbox"].x0)):
        pass
    # refaz a busca a cada remoção: a página muda depois de cada uma
    feitos = 0
    while True:
        tags = tags_resposta(page)
        if not tags:
            break
        modo = tirar_linha_resposta(page, original, tags[0])
        feitos += 1
        log.append(f"p{page.number + 1}: Resposta tirada do cartão ({modo})")
        if feitos > 20:
            raise SystemExit("laço")
    return feitos


# ================================================================== LIVRO DE OPONENTES
def oponentes():
    caminho = next(ORIG.glob("*Livro_de_Oponentes.pdf"))
    original = fitz.open(caminho)
    doc = fitz.open(caminho)

    # pág. 2: a caixa "RESPOSTA · NÃO ESPERA A VEZ" inteira (com a sombra)
    p = doc[1]
    cobrir(p, fitz.Rect(320.5, 514.0, 599.0, 745.3), cor_do_fundo(p, fitz.Rect(330, 746.5, 590, 752)))
    log.append("p2: caixa da Resposta removida")

    # pág. 3: Especial
    reescrever(doc[2], "não usa Golpe nem Resposta", [[("move, não usa Golpe. O Árbitro", "R")]])

    # pág. 4: tabela de tiers e nota
    p = doc[3]
    reescrever(p, "de Naipes, Resposta", [[("de Naipes", "R")]])
    reescrever(p, "Golpes, Resposta,", [[("Golpes,", "R")]])
    reescrever(p, "Golpes, Resposta,", [[("Golpes,", "R")]])
    reescrever(p, "Resposta: 1× por rodada", [
        [("Com duas ações, os Golpes precisam ser diferentes, ou", "R")],
        [("os alvos. Dá pra repetir um Golpe em outra pessoa.", "R")],
        [],
    ])

    # pág. 5: tabela "O Cartão" (sobe a linha do Especial) e Autógrafos
    p = doc[4]
    bg = cor_do_fundo(p, fitz.Rect(140, 300, 560, 304))
    subir(p, original, 27.0, 571.5, 239.2, 262.5, 301.6, bg, bg)
    log.append("p5: linha Resposta tirada da tabela O Cartão")
    reescrever(p, "jogador pega uma linha (Golpe ou Resposta) de", [[("jogador pega um Golpe de", "R")]])

    # bestiário e moldes
    for pno in range(len(doc)):
        limpar_cartoes(doc[pno], original)

    doc.save(SAIDA / "SAGA 0.7 - Livro de Oponentes.pdf", garbage=4, deflate=True)


# ================================================================== LIVRO DO JOGADOR
def jogador():
    caminho = next(ORIG.glob("*Livro_do_Jogador.pdf"))
    original = fitz.open(caminho)
    doc = fitz.open(caminho)

    # pág. 5: regra da Resposta: as duas últimas linhas do painel verde das condições
    p = doc[4]
    r1 = achar(p, "Um oponente pode reagir")
    r2 = achar(p, "e te dar 1 Naipe")
    painel = cor_do_fundo(p, fitz.Rect(30, r1["bbox"].y0 - 6, 250, r1["bbox"].y0 - 1))
    cobrir(p, fitz.Rect(20.0, r1["bbox"].y0 - 1.5, 288.0, r2["bbox"].y1 + 1.5), painel)
    log.append("p5: regra da Resposta removida")

    # pág. 5: Chefão na Execução + exemplo
    reescrever(p, "do cartão que essa parte carregava (um Golpe, a Resposta", [
        [("do cartão que essa parte carregava (um Golpe ou o", "R")],
        [("Especial). Ele continua Ferido e lutando, só que sem", "R")],
    ])
    reescrever(p, "Arranco a asa", [
        [("\"Arranco a mandíbula.\" O Árbitro risca Bocada. O", "R")],
        [("dragão não morde mais, e agora está furioso.", "R")],
    ], primeiro_span=1)

    # pág. 9: exemplo de jogo
    p = doc[8]
    reescrever(p, "Zonzo, o Cobrador solta a tampa", [
        [("Zonzo, o Cobrador solta a tampa e fica olhando pros lados, perdido. Vez dos trolls: o da churrasqueira levanta o punho", "R")],
        [("pra você, Bartolomeu.", "R")],
    ])
    limpar_cartoes(p, original)

    # pág. 15: Autógrafos
    p = doc[14]
    reescrever(p, "=Escolha um Golpe ou a", [
        [("Escolha um Golpe do", "R")],
        [("cartão. Diga o que", "R")],
        [("fazia aquilo.", "R")],
    ])
    reescrever(p, "Escolha um Golpe ou a Resposta do cartão e diga o que", [
        [("Escolha um ", "R"), ("Golpe", "SB"), (" do cartão e diga o que", "R")],
    ])
    reescrever(p, "Naipe. Sem rolagem, não tem Resposta", [
        [("Naipe. Depois de usado, ele se", "R")],
    ])
    reescrever(p, "A asa do Dragão Carmesim", [
        [("\"A mandíbula do Dragão Carmesim. Mordo uma vez só, e", "R")],
        [("o alvo vai pro chão.\"", "R")],
    ])

    # pág. 17: Companheiros
    p = doc[16]
    reescrever(p, "Proteja com Interceptar. Se você tirou", [
        [("Proteja com Interceptar. Não tem Assinatura:", "R")],
        [("quando morre, morre.", "R")],
        [],
        [],
    ])

    doc.save(SAIDA / "SAGA 0.7 - Livro do Jogador.pdf", garbage=4, deflate=True)


# ================================================================== REFERÊNCIA DO ÁRBITRO
def referencia():
    caminho = next(ORIG.glob("*Refer*.pdf"))
    original = fitz.open(caminho)
    doc = fitz.open(caminho)

    p = doc[1]
    reescrever(p, "uma linha (Golpe ou Resposta) e a parte", [[("oponente caído: um Golpe do cartão e a parte", "R")]])
    reescrever(p, "Oponentes podem usar a Resposta nele", [[("5. Não se defende: proteja com Interceptar.", "R")]])

    p = doc[2]
    reescrever(p, "Golpe nem Resposta. Descreva", [[("Golpe. Descreva o sinal e mostre a área.", "R")]])
    reescrever(p, "2 Golpes, Resposta", [[("2 Golpes", "R")]])
    l1 = achar(p, "jogador tirou Parcial ou Falha? Um oponente reage")
    l3 = achar(p, "Vale contra Companheiros")
    cobrir(p, fitz.Rect(15.0, l1["bbox"].y0 - 1.5, 290.0, l3["bbox"].y1 + 1.5),
           cor_do_fundo(p, fitz.Rect(15, l1["bbox"].y0 - 5, 290, l1["bbox"].y0 - 3)))
    log.append("p3: regra da Resposta removida das Peças")
    limpar_cartoes(p, original)

    p = doc[4]
    reescrever(p, "Golpes + Resposta", [[("2 Golpes", "R")]])

    doc.save(SAIDA / "SAGA 0.7 - Referência do Árbitro.pdf", garbage=4, deflate=True)


oponentes()
jogador()
referencia()
print("\n".join(log))
