const Leitura = require('../models/Leitura');
const Dispositivo = require('../models/Dispositivo');
const { calcularRisco } = require('./riscoService');

async function processarLeitura(dados) {
    const { device_id, distancia, altura, tendencia, data } = dados;

    if (
        !device_id ||
        distancia === undefined ||
        altura === undefined ||
        !tendencia ||
        !data
    ) {
        throw new Error('Todos os campos são obrigatórios.');
    }

    if (
        typeof altura !== 'number' ||
        !Number.isFinite(altura) ||
        altura < 0
    ) {
        throw new Error('A altura deve ser um número válido e não negativo.');
    }

    if (
        typeof distancia !== 'number' ||
        !Number.isFinite(distancia) ||
        distancia < 0
    ) {
        throw new Error(
            'A distância deve ser um número válido e não negativo.'
        );
    }

    if (!['subindo', 'estavel', 'descendo'].includes(tendencia)) {
        throw new Error('Tendência inválida.');
    }

    if (
        typeof data !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T/.test(data) ||
        !Number.isFinite(Date.parse(data)) ||
        !/(Z|[+-]\d{2}:\d{2})$/.test(data)
    ) {
        throw new Error('Data inválida. Informe uma data ISO 8601 com fuso horário.');
    }

    const dispositivo = await Dispositivo.findOne({
        where: { device_id }
    });

    if (!dispositivo) {
        throw new Error(`Dispositivo ${device_id} não cadastrado.`);
    }

    if (!dispositivo.ativo) {
        throw new Error('O dispositivo está inativo.');
    }

    const status = calcularRisco(altura);

    const leitura = await Leitura.create({
        dispositivo_id: dispositivo.id,
        distancia,
        altura,
        tendencia,
        data: new Date(data),
        status
    });

    return leitura;
}

module.exports = {
    processarLeitura
};