const express = require('express');
const router = express.Router();

const SimulacaoController = require('../controllers/SimulacaoController');
const { autenticar } = require('../middlewares/authMiddleware');
const { autorizar } = require('../middlewares/autorizacaoMiddleware');

router.use(autenticar);
router.post('/', autorizar('ADMIN'), SimulacaoController.simular);

module.exports = router;
