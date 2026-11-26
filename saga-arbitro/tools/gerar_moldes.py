"""Gera saga_moldes.json e moldes.js a partir de tools/moldes.txt.

Uso: python3 tools/gerar_moldes.py   (rodar dentro de saga-arbitro/)
O formato segue saga_moldes.d.ts.
"""
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
NAIPES = ["Caído", "Atordoado", "Ardendo", "Exposto"]
FORMAS = ["Explosão", "Pânico", "Reforço", "Terreno", "Captura"]

TIERS = [
    {"id": "fraco", "nome": "Fraco", "vida": 2, "vida_por_jogador": False, "dano": 1, "acoes": 1, "pecas": "Golpe"},
    {"id": "medio", "nome": "Médio", "vida": 5, "vida_por_jogador": False, "dano": 2, "acoes": 1, "pecas": "Golpe de Dano, Golpe de Naipes, Resposta"},
    {"id": "forte", "nome": "Forte", "vida": 5, "vida_por_jogador": True, "dano": 3, "acoes": 2, "pecas": "Golpes, Resposta, Especial"},
    {"id": "chefao", "nome": "Chefão", "vida": 6, "vida_por_jogador": True, "dano": 4, "acoes": 2, "pecas": "Golpes, Resposta, Especial"},
]

NAIPES_OPONENTE = [
    {"id": "caido", "nome": "Caído", "efeito": "O jogador não sai do lugar até o fim do próximo turno dele. Se quiser, o oponente empurra ele até 2 espaços antes."},
    {"id": "atordoado", "nome": "Atordoado", "efeito": "A próxima rolagem do jogador tem Desvantagem."},
    {"id": "ardendo", "nome": "Ardendo", "efeito": "Na hora, o jogador perde 1 de Vida. A Couraça não reduz."},
    {"id": "exposto", "nome": "Exposto", "efeito": "O próximo golpe nele não pode ser defendido, só Interceptado."},
]

FORMAS_ESPECIAL = [
    {"id": "explosao", "nome": "Explosão", "acontece": "Dano do tier em todos na área.", "pela_metade": "Metade do dano."},
    {"id": "panico", "nome": "Pânico", "acontece": "2 Naipes em todos na área, sem dano.", "pela_metade": "Só o Naipe com !."},
    {"id": "reforco", "nome": "Reforço", "acontece": "Entra uma Gangue de Fracos na área, um membro por jogador.", "pela_metade": "Metade dos membros."},
    {"id": "terreno", "nome": "Terreno", "acontece": "O lugar vira perigo até alguém fazer o \"Para se\". Quem começa o turno ali sofre o Naipe do cartão.", "pela_metade": "Dura só até o fim da próxima rodada."},
    {"id": "captura", "nome": "Captura", "acontece": "Um alvo é engolido, levado ou preso: sai do mapa e perde 1 de Vida todo turno. Só pode agir pra se soltar (Pleno sai), ou sai quando alguém faz o \"Para se\".", "pela_metade": "O alvo só fica Caído."},
]

CATEGORIAS = [
    {"id": "pancadaria", "numero": 1, "nome": "Pancadaria", "descricao": "corpo a corpo, sem rodeio", "pagina": 11},
    {"id": "tiro", "numero": 2, "nome": "Tiro de Longe", "descricao": "atacam de longe, com paciência", "pagina": 12},
    {"id": "terreno", "numero": 3, "nome": "Terreno Perigoso", "descricao": "o chão e o espaço viram arma", "pagina": 13},
    {"id": "bando", "numero": 4, "nome": "Em Bando", "descricao": "um ajuda o outro", "pagina": 14},
    {"id": "emboscada", "numero": 5, "nome": "Emboscada", "descricao": "somem, roubam, enganam", "pagina": 15},
    {"id": "estranha", "numero": 6, "nome": "Coisa Estranha", "descricao": "regras próprias, difíceis de matar", "pagina": 16},
]


def naipes_de(texto):
    achados = []
    for m in re.finditer(r"(Caído|Atordoado|Ardendo|Exposto)(!?)", texto):
        nome = m.group(1)
        if not any(n["nome"] == nome for n in achados):
            achados.append({"nome": nome, "principal": m.group(2) == "!"})
    return achados


def peca(linha, ordem_golpe):
    tipo_letra, resto = linha.split(" ", 1)
    sempre = tipo_letra.endswith("!")
    tipo_letra = tipo_letra.rstrip("!")
    nome, efeito = resto.split(": ", 1)
    nome = nome.strip()
    item = nome.endswith("*")

    if tipo_letra == "E":
        forma = "Explosão"
        m = re.search(r"\s*\((" + "|".join(FORMAS) + r")\)$", nome)
        if m:
            forma = m.group(1)
            nome = nome[: m.start()].strip()
        para_se = None
        if ">>" in efeito:
            efeito, para_se = [p.strip() for p in efeito.split(">>", 1)]
        return {
            "tipo": "especial",
            "nome": nome,
            "tier_minimo": "fraco" if sempre else "forte",
            "dano": bool(re.match(r"D\b", efeito)),
            "naipes": naipes_de(efeito),
            "roubo": False,
            "item": item,
            "forma": forma,
            "efeito": efeito,
            "nota": None,
            "para_se": para_se,
        }

    nota = None
    m = re.search(r"\s*\(([^()]*)\)$", efeito)
    if m:
        nota = m.group(1)
        efeito = efeito[: m.start()].strip()
    dano = bool(re.match(r"D\b", efeito))
    roubo = efeito.startswith("Roubo")
    if "recupera" in efeito:
        subtipo = "cura"
    elif roubo:
        subtipo = "roubo"
    elif dano:
        subtipo = "dano"
    else:
        subtipo = "naipes"
    if tipo_letra == "G":
        tier = "fraco" if ordem_golpe == 0 else "medio"
    else:
        tier = "medio"
    return {
        "tipo": "golpe" if tipo_letra == "G" else "resposta",
        "subtipo": subtipo,
        "nome": nome,
        "tier_minimo": tier,
        "dano": dano,
        "naipes": naipes_de(efeito),
        "roubo": roubo,
        "item": item,
        "efeito": efeito,
        "nota": nota,
    }


def ler():
    moldes = []
    atual = None
    golpes = 0
    for bruta in (RAIZ / "tools" / "moldes.txt").read_text(encoding="utf-8").splitlines():
        linha = bruta.strip()
        if not linha or linha.startswith("#"):
            continue
        if linha.startswith("@"):
            num, mid, nome, cat, pos = [p.strip() for p in linha[1:].split("|")]
            atual = {
                "id": mid,
                "numero": int(num),
                "nome": nome,
                "categoria": cat,
                "posicao": pos,
                "resumo": "",
                "na_luta": "",
                "nao_pega": None,
                "pecas": [],
            }
            if "___" in nome:
                atual["nome_placeholder"] = True
            moldes.append(atual)
            golpes = 0
        elif linha.startswith("resumo:"):
            atual["resumo"] = linha.split(":", 1)[1].strip()
        elif linha.startswith("luta:"):
            atual["na_luta"] = linha.split(":", 1)[1].strip()
        elif linha.startswith("naopega:"):
            naipe, motivo = [p.strip() for p in linha.split(":", 1)[1].split("|")]
            atual["nao_pega"] = {"naipe": naipe, "motivo": motivo}
        else:
            p = peca(linha, golpes)
            if p["tipo"] == "golpe":
                golpes += 1
            atual["pecas"].append(p)
    return moldes


def main():
    moldes = ler()
    assert len(moldes) == 36, len(moldes)
    for m in moldes:
        tipos = [p["tipo"] for p in m["pecas"]]
        assert tipos == ["golpe", "golpe", "resposta", "especial"], (m["id"], tipos)
    dados = {
        "sistema": "SAGA",
        "versao": "0.7",
        "fonte": "SAGA 0.7 — Livro de Oponentes, págs. 10–16",
        "tiers": TIERS,
        "naipes_do_oponente": NAIPES_OPONENTE,
        "formas_do_especial": FORMAS_ESPECIAL,
        "categorias": CATEGORIAS,
        "moldes": moldes,
    }
    texto = json.dumps(dados, ensure_ascii=False, indent=2)
    (RAIZ / "saga_moldes.json").write_text(texto + "\n", encoding="utf-8")
    (RAIZ / "moldes.js").write_text(
        "// Gerado por tools/gerar_moldes.py. Não edite à mão.\nwindow.SAGA_MOLDES = " + texto + ";\n",
        encoding="utf-8",
    )
    print("ok:", len(moldes), "moldes")


if __name__ == "__main__":
    main()
