const Leitura = require('../models/Leitura');
const Dispositivo = require('../models/Dispositivo');
const { calcularRisco } = require('../services/riscoService');

async function cadastrar(req, res) {
    try {
        const { device_id, distancia, altura, tendencia, data } = req.body;

        if (
            device_id === undefined ||
            distancia === undefined ||
            altura === undefined ||
            !tendencia ||
            !data
        ) {
            return res.status(400).json({
                mensagem: 'Todos os campos são obrigatórios.'
            });
        }

        if (
            typeof altura !== 'number' ||
            !Number.isFinite(altura) ||
            altura < 0
        ) {
            return res.status(400).json({
                mensagem: 'A altura deve ser um número válido e não negativo.'
            });
        }

        if (
            typeof distancia !== 'number' ||
            !Number.isFinite(distancia) ||
            distancia < 0
        ) {
            return res.status(400).json({
                mensagem: 'A distância deve ser um número válido e não negativo.'
            });
        }

        if (!['subindo', 'estavel', 'descendo'].includes(tendencia)) {
            return res.status(400).json({
                mensagem: 'Tendência inválida.'
            });
        }

        if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(data) || !Number.isFinite(Date.parse(data)) || !/(Z|[+-]\d{2}:\d{2})$/.test(data)) {
            return res.status(400).json({
                mensagem: 'Data inválida. Informe uma data ISO 8601 com fuso horário.'
            });
        }

        const dispositivo = await Dispositivo.findOne({
            where: { device_id }
        });

        if (!dispositivo) {
            console.error(`Leitura rejeitada: dispositivo ${device_id} não cadastrado.`);

            return res.status(404).json({
                mensagem: 'Dispositivo não cadastrado.'
            });
        }

        if (!dispositivo.ativo) {
            return res.status(409).json({
                mensagem: 'O dispositivo está inativo.'
            });
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

        return res.status(201).json(leitura);
    } catch (error) {
        console.error('Erro ao cadastrar leitura:', error);

        return res.status(500).json({
            mensagem: 'Erro interno ao cadastrar leitura.'
        });
    }
}

async function listar(req, res) {
    try {
        const leituras = await Leitura.findAll({
            include: [{
                model: Dispositivo,
                as: 'dispositivo',
                attributes: ['device_id', 'nome', 'localizacao']
            }],
            order: [['data', 'DESC']]
        });

        return res.status(200).json(leituras);
    } catch (error) {
        console.error('Erro ao consultar leituras:', error);

        return res.status(500).json({
            mensagem: 'Erro interno ao consultar leituras.'
        });
    }
}

module.exports = {
    cadastrar,
    listar
};