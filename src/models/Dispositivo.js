const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Dispositivo = sequelize.define('Dispositivo', {
    device_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    nome: {
        type: DataTypes.STRING,
        allowNull: false
    },
    localizacao: {
        type: DataTypes.STRING,
        allowNull: false
    },

    latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true
    },

    longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true
    },

    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
});

module.exports = Dispositivo;