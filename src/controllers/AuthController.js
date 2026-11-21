const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function cadastrar(req, res) {
    try {
        const { nome, email, senha } = req.body;

        if (
            typeof nome !== 'string' ||
            typeof email !== 'string' ||
            typeof senha !== 'string' ||
            !nome.trim() ||
            !email.trim() ||
            !senha
        ) {
            return res.status(400).json({
                mensagem: 'Nome, e-mail e senha são obrigatórios e devem ser válidos.'
            });
        }

        if (typeof senha !== 'string' || senha.length < 8) {
            return res.status(400).json({
                mensagem: 'A senha deve ter pelo menos 8 caracteres.'
            });
        }


        const emailNormalizado = email.trim().toLowerCase();

        const usuarioExistente = await Usuario.findOne({
            where: { email: emailNormalizado }
        });

        if (usuarioExistente) {
            return res.status(409).json({
                mensagem: 'Este e-mail já está cadastrado.'
            });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const usuario = await Usuario.create({
            nome: nome.trim(),
            email: emailNormalizado,
            senha: senhaHash,
            perfil:'OPERADOR'
        });

        return res.status(201).json({
            mensagem: 'Usuário cadastrado com sucesso.',
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil
            }
        });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);

        return res.status(500).json({
            mensagem: 'Erro interno ao cadastrar usuário.'
        });
    }
}

async function login(req, res) {
    try {
        const { email, senha } = req.body;

        if (
            typeof email !== 'string' ||
            typeof senha !== 'string' ||
            !email.trim() ||
            !senha
        ) {
            return res.status(400).json({
                mensagem: 'E-mail e senha são obrigatórios e devem ser válidos.'
            });
        }

        const usuario = await Usuario.findOne({
            where: {
                email: email.trim().toLowerCase()
            }
        });

        if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
            return res.status(401).json({
                mensagem: 'E-mail ou senha incorretos.'
            });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                perfil: usuario.perfil
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '1h'
            }
        );

        return res.status(200).json({
            mensagem: 'Login realizado com sucesso.',
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil
            }
        });
    } catch (error) {
        console.error('Erro ao realizar login:', error);

        return res.status(500).json({
            mensagem: 'Erro interno ao realizar login.'
        });
    }
}

module.exports = {
    cadastrar,
    login
};