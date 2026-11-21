
const express = require('express');
const router = express.Router();

const LeituraController = require('../controllers/LeituraController');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizar } = require('../middlewares/autorizacaoMiddleware');
const validarSchema = require('../middlewares/validarSchema');
const { leituraSchema } = require('../schemas/leituraSchema');

router.use(autenticar);

router.get(
    '/',
    LeituraController.listar
);

router.post(
    '/',
    autorizar('ADMIN', 'OPERADOR'),
    validarSchema(leituraSchema),
    LeituraController.cadastrar
);

module.exports = router;
