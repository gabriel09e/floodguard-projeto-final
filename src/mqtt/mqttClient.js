const mqtt = require('mqtt');
const { processarLeitura } = require('../services/leituraService');

const BROKER_URL = 'mqtt://broker.hivemq.com:1883';
const TOPICO = 'floodguard/leituras';

const client = mqtt.connect(BROKER_URL);

let mqttConectado = false;
let ultimaMensagem = null;
let inscritoNoTopico = false;

client.on('connect', () => {
    mqttConectado = true;

    console.log('Conectado ao broker MQTT!');

    client.subscribe(TOPICO, (error) => {
        if (error) {
            inscritoNoTopico = false;

            console.error(
                'Erro ao se inscrever no tópico:',
                error.message
            );

            return;
        }

        inscritoNoTopico = true;

        console.log(
            `Inscrito no tópico ${TOPICO}`
        );
    });
});

client.on('message', async (topic, message) => {
    ultimaMensagem = new Date();

    console.log('MQTT recebido:', message.toString());

    try {
        const dados = JSON.parse(message.toString());

        const leitura = await processarLeitura(dados);

        console.log('Leitura MQTT salva com sucesso:', leitura.id);
        console.log('Status calculado:', leitura.status);
    } catch (error) {
        console.error('Mensagem MQTT rejeitada:', error.message);
    }
});

client.on('error', (error) => {
    console.error('Erro na conexão MQTT:', error.message);
});

client.on('close', () => {
    mqttConectado = false;
    inscritoNoTopico = false;
});

client.on('offline', () => {
    mqttConectado = false;
});

module.exports = {
    client,
    getStatus() {
        return {
            conectado: mqttConectado,
            inscrito: inscritoNoTopico,
            ultimaMensagem
        };
    }
};