require('dotenv').config();

const express = require('express');
const sequelize = require('./config/database');
const Dispositivo = require('./models/Dispositivo');
const Leitura = require('./models/Leitura');
const dispositivoRoutes = require('./routes/dispositivoRoutes');
const leituraRoutes = require('./routes/leituraRoutes');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const simulacaoRoutes = require('./routes/simulacaoRoutes');
require('./mqtt/mqttClient');

const app = express();

app.use(express.static('public'));
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/dispositivos', dispositivoRoutes);
app.use('/leituras', leituraRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/simulacao', simulacaoRoutes);

const PORT = 3000;

Dispositivo.hasMany(Leitura, {
    foreignKey: 'dispositivo_id',
    as: 'leituras'
});

Leitura.belongsTo(Dispositivo, {
    foreignKey: 'dispositivo_id',
    as: 'dispositivo'
});

async function iniciarServidor() {
    try {
        await sequelize.authenticate();

        console.log('Conexão com o banco estabelecida!');

        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
        });
    } catch (error) {
        console.error('Erro ao iniciar a aplicação:', error);
        process.exitCode = 1;
    }
}

iniciarServidor();