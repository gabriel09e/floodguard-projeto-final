const { z } = require('zod');

const leituraSchema = z.object({
    device_id: z
        .string()
        .trim()
        .min(1, 'O ID do dispositivo é obrigatório.'),

    distancia: z
        .number()
        .finite()
        .nonnegative('A distância não pode ser negativa.'),

    altura: z
        .number()
        .finite()
        .nonnegative('A altura não pode ser negativa.'),

    tendencia: z.enum([
        'subindo',
        'estavel',
        'descendo'
    ]),

    data: z.iso.datetime({
        offset: true,
        message: 'Informe uma data ISO 8601 com fuso horário.'
    })
});

module.exports = {
    leituraSchema
};