//arrays são tipo variáveis, só que ela pode conter mais de um valor
const rotina = [`Acordar`, `tomar café`, `sair de casa`, `voltar pra casa`];
const time = 5;
if (time === 1) {
  console.log(rotina[0]);
} else if (time === 2) {
  console.log(rotina[1]);
} else if (time === 3) {
  console.log(rotina[2]);
} else if (time === 4) {
  console.log(rotina[3]);
} else {
  console.log("informação não registrada na rotina");
}

//médodos são funções pré buildadas no java. arrays tem isso tbm
// array.push === adicionar variável na ultima posição
// array.pop === remover a ultima posição
const array = [1, 2, 3, 4, 5];
array.push(6);
console.log(array);
//array.shift === remover o primeiro elemento 
//array.unshift === adicionar 1 elemento na primeira posição
//esses ai n são mt usados n 
const segundoNumero = array.indexOf(2);
console.log(segundoNumero);