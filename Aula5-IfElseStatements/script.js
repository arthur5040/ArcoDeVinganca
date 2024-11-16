//it's a way of checkong and filtering what action we need to perform. isso só vai retornar verdadeiro ou falso
const age = 12;
if (age >= 18) {
  console.log(`you are good to go!`);
} else if (age <= 14) {
  console.log(`Tu É baby boy ainda`);
} else {
  console.log(`SAI FORA MACACO!`);
}

// iguais triplos `===` corrige bugs e n deixa erros passarem dispercebidos `=` é usado pra atribuir valor, enquanto 2/3 iguais são pra comparar valores(da forma como estamos acostumados a usar o sinal de igual na matemática.)
// E = `&&`
// OU = `||`

const dice1 = 6; 
const dice2 = 4;
if(dice1 === 6 && dice2 === 6) {
    console.log(`Mago!`);
}else {
    console.log(`Não é mago`);
}

const dice3 = 6; 
const dice4 = 4;
if(dice3 === 6 || dice4 === 6) {
    console.log(`Mago!`);
}else {
    console.log(`Não é mago`);
}