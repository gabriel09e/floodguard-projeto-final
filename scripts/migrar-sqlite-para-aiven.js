
require('dotenv').config();

const path = require('path');
const { Sequelize } = require('sequelize');

const origem = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: false
});

const configAiven = require('../config/config.aiven.js').development;

const destino = new Sequelize(
    configAiven.database,
    configAiven.username,
    configAiven.password,
    {
        ...configAiven,
        logging: false
    }
);

const tabelas = ['Dispositivos', 'Usuarios', 'Leituras'];

async function contarRegistros(banco, tabela, transaction) {
    const [resultado] = await banco.query(
        `SELECT COUNT(*) AS total FROM \`${tabela}\``,
        transaction ? { transaction } : {}
    );

    return Number(resultado[0].total);
}

async function migrar() {
    try {
        await origem.authenticate();
        await destino.authenticate();

        const dados = {};

        for (const tabela of tabelas) {
            const [registros] = await origem.query(
                `SELECT * FROM "${tabela}" ORDER BY id ASC`
            );

            dados[tabela] = registros.map((registro) => {
                const convertido = { ...registro };

                for (const campo of ['createdAt', 'updatedAt', 'data']) {
                    if (convertido[campo] != null) {
                        const data = new Date(convertido[campo]);

                        if (Number.isNaN(data.getTime())) {
                            throw new Error(
                                `Data inválida em ${tabela}.${campo}, registro ID ${registro.id}`
                            );
                        }

                        convertido[campo] = data
                            .toISOString()
                            .slice(0, 23)
                            .replace('T', ' ');
                    }
                }

                return convertido;
            });

            console.log(
                `SQLite | ${tabela}: ${registros.length} registros`
            );
        }

        await destino.transaction(async (transaction) => {
            for (const tabela of tabelas) {
                const total = await contarRegistros(
                    destino,
                    tabela,
                    transaction
                );

                if (total !== 0) {
                    throw new Error(
                        `A tabela ${tabela} já contém ${total} registros na Aiven. Migração cancelada para evitar duplicações.`
                    );
                }
            }

            for (const tabela of tabelas) {
                const registros = dados[tabela];

                if (registros.length > 0) {
                    await destino.getQueryInterface().bulkInsert(
                        tabela,
                        registros,
                        { transaction }
                    );
                }

                console.log(
                    `Aiven | ${tabela}: ${registros.length} registros inseridos`
                );
            }

            for (const tabela of tabelas) {
                const total = await contarRegistros(
                    destino,
                    tabela,
                    transaction
                );

                if (total !== dados[tabela].length) {
                    throw new Error(
                        `Quantidade divergente na tabela ${tabela}.`
                    );
                }
            }
        });

        console.log('\nMigração concluída com sucesso!');
        console.log('O SQLite original foi preservado.');
    } catch (erro) {
        console.error('\nMigração cancelada:', erro.message);
        process.exitCode = 1;
    } finally {
        await Promise.allSettled([
            origem.close(),
            destino.close()
        ]);
    }
}

migrar();
