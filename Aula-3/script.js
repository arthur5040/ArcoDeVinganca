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

const name = "Dev art";

function jooj(text) {
  const upperCased = text.toUpperCase();
  console.log(upperCased);
}
jooj(name);
