const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Leitura = sequelize.define('Leitura', {
    distancia: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    altura: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    tendencia: {
        type: DataTypes.ENUM('subindo', 'estavel', 'descendo'),
        allowNull: false
    },
    data: {
        type: DataTypes.DATE,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('normal', 'atencao', 'alerta', 'evacuacao'),
        allowNull: false
    }
});

module.exports = Leitura;