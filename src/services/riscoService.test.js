const { calcularRisco } = require('./riscoService');

console.log(calcularRisco(0.5) === 'normal');
console.log(calcularRisco(1.0) === 'atencao');
console.log(calcularRisco(2.0) === 'alerta');
console.log(calcularRisco(3.0) === 'evacuacao');
