'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(queryInterface) {
        await queryInterface.addColumn('Leituras', 'distancia', {
            type: DataTypes.FLOAT,
            allowNull: true
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('Leituras', 'distancia');
    }
};