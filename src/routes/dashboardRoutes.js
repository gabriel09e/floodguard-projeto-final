const express = require('express');
const router = express.Router();

const DashboardController = require('../controllers/DashboardController');
const { autenticar } = require('../middlewares/authMiddleware');

router.use(autenticar);

router.get('/resumo', DashboardController.resumo);

module.exports = router;
