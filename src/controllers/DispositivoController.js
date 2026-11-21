const Dispositivo = require('../models/Dispositivo');

async function listar(req, res) {
    try {
        const dispositivos = await Dispositivo.findAll();

        return res.status(200).json(dispositivos);
    } catch (error) {
        return res.status(500).json({
            mensagem: 'Erro ao consultar dispositivos.'
        });
    }
}

async function cadastrar(req, res) {
    try {
        const { device_id, nome, localizacao, latitude, longitude, ativo } = req.body;

        if (!device_id || !nome || !localizacao) {
            return res.status(400).json({
                mensagem: 'Todos os campos são obrigatórios.'
            });
        }

        const dispositivoExistente = await Dispositivo.findOne({
            where: { device_id }
        });

        if (dispositivoExistente) {
            return res.status(409).json({
                mensagem: 'Já existe um dispositivo com esse identificador.'
            });
        }

        if (latitude !== undefined && latitude !== null && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) {
            return res.status(400).json({ mensagem: 'Latitude inválida.' });
        }

        if (longitude !== undefined && longitude !== null && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) {
            return res.status(400).json({ mensagem: 'Longitude inválida.' });
        }

        if (ativo !== undefined && typeof ativo !== 'boolean') {
            return res.status(400).json({ mensagem: 'O campo ativo deve ser true ou false.' });
        }

        const dispositivo = await Dispositivo.create({
            device_id: device_id.trim(),
            nome: nome.trim(),
            localizacao: localizacao.trim(),
            latitude: latitude === null || latitude === undefined ? null : Number(latitude),
            longitude: longitude === null || longitude === undefined ? null : Number(longitude),
            ativo: ativo === undefined ? true : ativo
        });

        return res.status(201).json(dispositivo);
    } catch (error) {
        console.error('Erro ao cadastrar dispositivo:', error);

        return res.status(500).json({
            mensagem: 'Erro interno ao cadastrar dispositivo.'
        });
    }
}

async function buscarPorId(req, res) {
    try {
        const dispositivo = await Dispositivo.findByPk(req.params.id);

        if (!dispositivo) {
            return res.status(404).json({
                mensagem: 'Dispositivo não encontrado.'
            });
        }

        return res.status(200).json(dispositivo);
    } catch (error) {
        console.error('Erro ao consultar dispositivo:', error);

        return res.status(500).json({
            mensagem: 'Erro interno ao consultar dispositivo.'
        });
    }
}

async function atualizar(req, res) {
    try {
        const dispositivo = await Dispositivo.findByPk(req.params.id);

        if (!dispositivo) {
            return res.status(404).json({
                mensagem: 'Dispositivo não encontrado.'
            });
        }

        const { nome, localizacao, latitude, longitude, ativo } = req.body;

        if (
            nome === undefined &&
            localizacao === undefined &&
            latitude === undefined &&
            longitude === undefined &&
            ativo === undefined
        ) {
            return res.status(400).json({
                mensagem: 'Informe pelo menos um campo para atualizar.'
            });
        }

        if (
            nome !== undefined &&
            (typeof nome !== 'string' || nome.trim() === '')
        ) {
            return res.status(400).json({
                mensagem: 'O nome deve ser um texto não vazio.'
            });
        }

        if (
            localizacao !== undefined &&
            (typeof localizacao !== 'string' || localizacao.trim() === '')
        ) {
            return res.status(400).json({
                mensagem: 'A localização deve ser um texto não vazio.'
            });
        }

        if (ativo !== undefined && typeof ativo !== 'boolean') {
            return res.status(400).json({
                mensagem: 'O campo ativo deve ser true ou false.'
            });
        }

        if (latitude !== undefined && latitude !== null && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) {
            return res.status(400).json({ mensagem: 'Latitude inválida.' });
        }

        if (longitude !== undefined && longitude !== null && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) {
            return res.status(400).json({ mensagem: 'Longitude inválida.' });
        }

        const dadosAtualizados = {};

        if (nome !== undefined) {
            dadosAtualizados.nome = nome.trim();
        }

        if (localizacao !== undefined) {
            dadosAtualizados.localizacao = localizacao.trim();
        }

        if (latitude !== undefined) {
            dadosAtualizados.latitude = latitude === null ? null : Number(latitude);
        }

        if (longitude !== undefined) {
            dadosAtualizados.longitude = longitude === null ? null : Number(longitude);
        }

        if (ativo !== undefined) {
            dadosAtualizados.ativo = ativo;
        }

        await dispositivo.update(dadosAtualizados);

        return res.status(200).json(dispositivo);
    } catch (error) {
        console.error('Erro ao atualizar dispositivo:', error);

        return res.status(500).json({
            mensagem: 'Erro interno ao atualizar dispositivo.'
        });
    }
}
async function excluir(req, res) {
    try {
        const dispositivo = await Dispositivo.findByPk(req.params.id);

        if (!dispositivo) {
            return res.status(404).json({
                mensagem: 'Dispositivo não encontrado.'
            });
        }

        await dispositivo.destroy();

        return res.status(200).json({
            mensagem: 'Dispositivo excluído com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao excluir dispositivo:', error);

        return res.status(500).json({
            mensagem: 'Erro interno ao excluir dispositivo.'
        });
    }
}

module.exports = {
    listar,
    cadastrar,
    buscarPorId,
    atualizar,
    excluir
};