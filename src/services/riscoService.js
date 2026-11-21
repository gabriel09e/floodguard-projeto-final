const LIMITE_ATENCAO_CM = 5;
const LIMITE_ALERTA_CM = 10;
const LIMITE_EVACUACAO_CM = 15;
const ALTURA_MAXIMA_CM = 30;

function calcularRisco(altura) {
    if (altura < LIMITE_ATENCAO_CM) {
        return 'normal';
    }

    if (altura < LIMITE_ALERTA_CM) {
        return 'atencao';
    }

    if (altura < LIMITE_EVACUACAO_CM) {
        return 'alerta';
    }

    return 'evacuacao';
}

function calcularScoreRisco(altura, velocidade = 0) {
    const nivel = Math.max(0, Math.min(altura, ALTURA_MAXIMA_CM));

    let scoreNivel = (nivel / LIMITE_EVACUACAO_CM) * 80;

    if (velocidade > 0) {
        scoreNivel += Math.min(20, velocidade * 5);
    }

    return Math.round(Math.max(0, Math.min(scoreNivel, 100)));
}

module.exports = {
    calcularRisco,
    calcularScoreRisco,
    LIMITE_ATENCAO_CM,
    LIMITE_ALERTA_CM,
    LIMITE_EVACUACAO_CM,
    ALTURA_MAXIMA_CM
};