const { processarLeitura } = require('../services/leituraService');

async function simular(req, res) {
    try {
        const { device_id, distancia, altura, tendencia, data } = req.body;

        if (!device_id || altura === undefined || distancia === undefined || !tendencia) {
            return res.status(400).json({
                mensagem: 'Dispositivo, distância, altura e tendência são obrigatórios.'
            });
        }

        const leitura = await processarLeitura({
            device_id,
            distancia: Number(distancia),
            altura: Number(altura),
            tendencia,
            data: data || new Date().toISOString()
        });

        return res.status(201).json({
            ...leitura.toJSON(),
            simulada: true
        });
    } catch (error) {
        console.error('Erro ao simular leitura:', error);

        return res.status(400).json({
            mensagem: error.message || 'Não foi possível registrar a simulação.'
        });
    }
}

module.exports = { simular };
