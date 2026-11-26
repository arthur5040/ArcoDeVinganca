// Tipos do arquivo saga_moldes.json (SAGA 0.7 — Livro de Oponentes, págs. 11–16)

export type TierId = "fraco" | "medio" | "forte" | "chefao";
export type Posicao = "frente" | "meio" | "tras";
export type CondicaoNome = "Caído" | "Atordoado" | "Ardendo" | "Exposto";
export type FormaEspecial = "Explosão" | "Pânico" | "Reforço" | "Terreno" | "Captura";

export interface Tier {
  id: TierId;
  nome: string;
  vida: number;              // se vida_por_jogador = true, multiplique pelo nº de jogadores
  vida_por_jogador: boolean;
  dano: number;              // valor de "D" nas peças
  acoes: number;
  pecas: string;             // quais peças o tier usa
}

export interface NaipeNaPeca {
  nome: CondicaoNome;
  principal: boolean;        // true = marcado com "!" (passa mesmo na Defesa Parcial)
}

interface PecaBase {
  nome: string;
  tier_minimo: Exclude<TierId, "chefao">; // a peça aparece desse tier pra cima
  dano: boolean;             // true = causa D (o dano do tier)
  naipes: NaipeNaPeca[];
  roubo: boolean;            // true = Golpe de Roubo
  item: boolean;             // true = marcado com "*" (vem de um item; Desarmar tira)
  efeito: string;            // texto do efeito como está no cartão
  nota: string | null;       // texto em itálico entre parênteses
}

export interface Golpe extends PecaBase {
  tipo: "golpe";
  subtipo: "dano" | "naipes" | "roubo" | "cura";
}

export interface Resposta extends PecaBase {
  tipo: "resposta";
  subtipo: "dano" | "naipes" | "roubo" | "cura";
}

export interface Especial extends PecaBase {
  tipo: "especial";
  forma: FormaEspecial;
  para_se: string | null;    // o que faz o Especial parar
}

export type Peca = Golpe | Resposta | Especial;

export interface Molde {
  id: string;
  numero: number;            // número d66 da tabela de moldes (11–66)
  nome: string;
  nome_placeholder?: true;   // "Enxame de ___": o Árbitro completa o nome
  categoria: string;         // id em categorias[]
  posicao: Posicao;
  resumo: string;            // a frase curta embaixo do nome
  na_luta: string;           // como ele se comporta na luta
  nao_pega: { naipe: string; motivo: string } | null; // Naipe do jogador que não funciona nele
  pecas: Peca[];             // sempre 2 Golpes, 1 Resposta e 1 Especial
}

export interface Categoria {
  id: string;
  numero: number;
  nome: string;
  descricao: string;
  pagina: number;            // página no Livro de Oponentes
}

// Referência do Árbitro, pág. 5 — Combos Prontos e a tabela "Quantos".
export interface Combo {
  id: string;
  nome: string;
  maioria: string;           // id do molde que vem em maior número
  destaque: string;          // id do molde que vem um só
}

export interface Encontro {
  id: "aquecimento" | "padrao" | "dificil" | "chefe";
  nome: string;
  descricao: string;
  maioria: { tier: TierId; gangue: boolean; qtd: [number, number, number, number] }; // por 2, 3, 4, 5 jogadores
  destaque: { tier: TierId; qtd: number } | null;
}

export interface SagaMoldes {
  sistema: "SAGA";
  versao: string;
  fonte: string;
  tiers: Tier[];
  naipes_do_oponente: { id: string; nome: CondicaoNome; efeito: string }[];
  formas_do_especial: { id: string; nome: FormaEspecial; acontece: string; pela_metade: string }[];
  categorias: Categoria[];
  moldes: Molde[];
  combos: Combo[];
  encontros: Encontro[];
}
