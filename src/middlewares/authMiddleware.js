const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

async function autenticar(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).json({
            mensagem: 'Token de autenticação não informado.'
        });
    }

    const partes = authorization.split(' ');

    if (
        partes.length !== 2 ||
        partes[0] !== 'Bearer' ||
        !partes[1]
    ) {
        return res.status(401).json({
            mensagem: 'Formato do token inválido.'
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET não está configurado.');

        return res.status(500).json({
            mensagem: 'Erro interno de configuração da autenticação.'
        });
    }

    try {
        const payload = jwt.verify(
            partes[1],
            process.env.JWT_SECRET
        );

        if (
            !Number.isInteger(payload.id) ||
            !['ADMIN', 'OPERADOR'].includes(payload.perfil)
        ) {
            return res.status(401).json({
                mensagem: 'Conteúdo do token inválido.'
            });
        }

        const usuario = await Usuario.findByPk(payload.id);

        if (!usuario) {
            return res.status(401).json({
                mensagem: 'Usuário não encontrado.'
            });
        }

        if (usuario.perfil !== payload.perfil) {
            return res.status(401).json({
                mensagem: 'O perfil do usuário foi alterado. Faça login novamente.'
            });
        }

        req.usuario = {
            id: usuario.id,
            perfil: usuario.perfil
        };

        return next();
    } catch (error) {
        console.error('Erro ao autenticar:', error.message);

        return res.status(401).json({
            mensagem: 'Token inválido ou expirado.'
        });
    }
}

module.exports = {
    autenticar
};