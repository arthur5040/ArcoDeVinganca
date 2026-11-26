# SAGA · Mesa do Árbitro

Site pro Árbitro de SAGA 0.7. Abra `index.html` no navegador, sem instalar nada.

- **Histórias (perfis):** cada história tem a parte de História e os Esquadrões.
- **História:** as Cinco Batidas do Livro do Árbitro (Começo, Complicação, Reviravolta, Crise, Final) com as marcas + / −, ou um bloco de notas livre. Salva sozinha.
- **Esquadrões:** tema, número de jogadores e os oponentes de cima pra baixo. Cada oponente sai de um Molde e tem tier (Fraco, Médio, Forte, Chefão), Moral (6, 7 ou 8), nome e nomes dos golpes editáveis. O `D` vira o dano do tier. O esquadrão só vai pra história quando você clica em **Salvar esquadrão**.
- **Moldes:** os 36 do Livro de Oponentes, por categoria, com busca e "Rolar d66".

Tudo fica guardado no navegador (localStorage). Use **Exportar** na lista de histórias pra fazer backup e **Importar** pra trazer de volta.

## Arquivos

- `saga_moldes.json` / `moldes.js`: os moldes no formato de `saga_moldes.d.ts`. São gerados a partir de `tools/moldes.txt` com `python3 tools/gerar_moldes.py`.
- `assets/mao.png`: a mão da capa do Livro de Oponentes, recolorida em vermelho.
