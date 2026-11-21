const express = require('express');
const router = express.Router();

const DispositivoController = require('../controllers/DispositivoController');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizar } = require('../middlewares/autorizacaoMiddleware');

router.use(autenticar);

router.get('/', DispositivoController.listar);
router.get('/:id', DispositivoController.buscarPorId);

router.post(
    '/',
    autorizar('ADMIN'),
    DispositivoController.cadastrar
);

router.put(
    '/:id',
    autorizar('ADMIN'),
    DispositivoController.atualizar
);

router.delete(
    '/:id',
    autorizar('ADMIN'),
    DispositivoController.excluir
);

module.exports = router;