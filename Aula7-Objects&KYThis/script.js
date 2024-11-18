// para criar um objeto, escreva como se fosse uma função, mas o título será uma "classe" q posssui elementos dentro dela. Esses elementos da classe tem um nome e seguem com ":" depois do valor no nome dado por nós. por ex:

const usuario = {
  nome: "Joao",
  idade: 20,
  cidade: "São Paulo",
};
console.log(usuario.idade);

//Métodos = funções dentro de objetos
//THIS by default is going to refer to the Window object. When you assign THIS to a method inside an OBJECT AND evoke the method THIS is the OBJECT, SO the best way to identify what THIS is, is by looking where the function it´s inside was evoked and look to the left term.
const pessoa = {
  nome: "Joao",
  idade: 20,
  cidade: "São Paulo",
  saudar: function () {
    console.log(`Olá, meu nome é ${this.nome}!`);
  },
};
pessoa.saudar();

const loja = {
  nome: `Guanabara`,
  produtos: [`batata`, `cenoura`, `cenoura`],
  precos: [4, 6, 7],
  falaRecepcao: function () {
    console.log(`Opa amiguninho! bem vindo ao ${this.nome}!`);
  },
  falarProdutos: function () {
    console.log(`Estamos com os seguintes produtos:${this.produtos}.`);
  },
};
loja.falaRecepcao();
loja.falarProdutos();