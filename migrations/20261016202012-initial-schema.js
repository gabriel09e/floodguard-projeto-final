'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
    async up(queryInterface) {
        const tabelas = await queryInterface.showAllTables();

        if (!tabelas.includes('Dispositivos')) {
            await queryInterface.createTable('Dispositivos', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },
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
                ativo: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                }
            });
        }

        if (!tabelas.includes('Usuarios')) {
            await queryInterface.createTable('Usuarios', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },
                nome: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                email: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    unique: true
                },
                senha: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                perfil: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    defaultValue: 'OPERADOR'
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                }
            });
        }

        if (!tabelas.includes('Leituras')) {
            await queryInterface.createTable('Leituras', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },
                altura: {
                    type: DataTypes.FLOAT,
                    allowNull: false
                },
                tendencia: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                data: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                status: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                dispositivo_id: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'Dispositivos',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                }
            });
        }
    },

    async down(queryInterface) {
    await queryInterface.dropTable('Leituras');
    await queryInterface.dropTable('Usuarios');
    await queryInterface.dropTable('Dispositivos');
    }
};