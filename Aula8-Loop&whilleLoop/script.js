//o for faz termos rodarem separadamente. ex

const numeros = [1, 2, 3, 4, 5, 6];
for (numero of numeros) {
  // pelo q eu entendi, o termo antes do `of` é o nome que você dá pro loop
  console.log(`Candidato número ${numero}`);
  if (numero === 4) {
    console.log(`Candidato número ${numero}: aprovado!`);
    break;
  }
}

//usando o while agr:
let loading = 0;
while (loading < 100) {
  console.log(`Carregando...`);
  loading++;
}
console.log(`Carregamento concluído`);
