//fumção = a set of code you write that does a task

function logger() {
  console.log("Party Starter");
  console.log("Party Starter");
  console.log("Party Starter");
}

logger();

//variaveis no escopo global podem ser uusadas dentro de funçao. Variaveis dentro de funão não podem ser puxadas pro escpo lobal

function adder(num1, num2) {
  console.log(num1 + num2);
}
adder(5, 10);
//função pra transformar o texto em maiúsculo:

const namee = "Dev art";
const youtuber = "Hamza";
function jooj(text) {
  const LetraGrande = text.toUpperCase();
  console.log(LetraGrande);
}
jooj(namee);
jooj(youtuber);

// outra forma de escrever funçòes é fazer como uma constante:
const lider = "Jesus";
const FazerTextoMaiusculo = (text) => {
  const letraGrande = text.toUpperCase();
  console.log(letraGrande);
};
FazerTextoMaiusculo(lider);
