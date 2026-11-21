'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(queryInterface) {
        await queryInterface.addColumn('Dispositivos', 'latitude', {
            type: DataTypes.DECIMAL(10, 7),
            allowNull: true
        });

        await queryInterface.addColumn('Dispositivos', 'longitude', {
            type: DataTypes.DECIMAL(10, 7),
            allowNull: true
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'Dispositivos',
            'longitude'
        );

        await queryInterface.removeColumn(
            'Dispositivos',
            'latitude'
        );
    }
};