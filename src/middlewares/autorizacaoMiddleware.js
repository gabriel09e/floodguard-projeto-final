const PERFIS_VALIDOS = ['ADMIN', 'OPERADOR'];

function autorizar(...perfisPermitidos) {
    const perfisInvalidos = perfisPermitidos.filter(
        perfil => !PERFIS_VALIDOS.includes(perfil)
    );

    if (perfisPermitidos.length === 0 || perfisInvalidos.length > 0) {
        throw new Error('Configuração inválida de perfis de autorização.');
    }

    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                mensagem: 'Usuário não autenticado.'
            });
        }

        if (!PERFIS_VALIDOS.includes(req.usuario.perfil)) {
            return res.status(403).json({
                mensagem: 'Perfil de usuário inválido.'
            });
        }

        if (!perfisPermitidos.includes(req.usuario.perfil)) {
            return res.status(403).json({
                mensagem: 'Você não tem permissão para executar esta ação.'
            });
        }

        return next();
    };
}

module.exports = {
    autorizar
};