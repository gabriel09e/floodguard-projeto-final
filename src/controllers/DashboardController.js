const Dispositivo = require('../models/Dispositivo');
const Leitura = require('../models/Leitura');
const mqttClient = require('../mqtt/mqttClient');

async function resumo(req, res) {
    try {
        const dispositivo = await Dispositivo.findOne({
            where: { ativo: true },
            order: [['id', 'ASC']]
        });

        const ultimaLeitura = await Leitura.findOne({
            order: [['data', 'DESC']]
        });

        const mqtt = mqttClient.getStatus();

        return res.status(200).json({
            dispositivo: dispositivo
                ? {
                    id: dispositivo.id,
                    device_id: dispositivo.device_id,
                    nome: dispositivo.nome,
                    localizacao: dispositivo.localizacao,
                    latitude: dispositivo.latitude,
                    longitude: dispositivo.longitude,
                    ativo: dispositivo.ativo
                }
                : null,

            sistema: {
                online: true,
                mqtt: mqtt.conectado === true,
                mqttInscrito: mqtt.inscrito === true,
                ultimaMensagemMQTT: mqtt.ultimaMensagem || null,
                ultimaLeitura: ultimaLeitura
                    ? ultimaLeitura.data
                    : null
            }
        });
    } catch (error) {
        console.error('Erro ao consultar resumo do dashboard:', error);

        return res.status(500).json({
            mensagem: 'Erro ao consultar o resumo do dashboard.'
        });
    }
}

module.exports = {
    resumo
};
