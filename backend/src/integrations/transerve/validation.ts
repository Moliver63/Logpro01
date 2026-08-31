import { z } from "zod";

/**
 * Validação da solicitação de frete Transerve.
 *
 * Os limites de caracteres vêm da documentação oficial: endereços e
 * informacoes_extras_transporte aceitam até 1000; os demais campos de texto,
 * até 100. Validar aqui evita gastar uma chamada autenticada para receber
 * um 400 do outro lado, e devolve ao usuário um erro específico do campo.
 */

const texto100 = z.string().min(1).max(100);
const texto1000 = z.string().min(1).max(1000);

export const transerveFreightRequestSchema = z
  .object({
    endereco_completo_coleta: texto1000,
    endereco_completo_entrega: texto1000,
    volume_total_carga: texto100,
    observacao_volume_total_carga: z.string().max(100).optional(),
    peso_total_carga: texto100,
    observacao_peso_total_carga: z.string().max(100).optional(),
    carga_palletizada: texto100,
    necessita_ajudantes: z.boolean(),
    necessita_ajudantes_quantidade: z.string().max(100).nullable().optional(),
    informacoes_caminhao: texto100,
    informacoes_produto_transportado: texto100,
    tem_agendamento: z.boolean(),
    observacao_agendamento: z.string().max(100).nullable().optional(),
    modalidade_transporte: texto100,
    informacoes_extras_transporte: texto1000,
  })
  // Regras condicionais documentadas: se pede ajudantes, a quantidade é
  // obrigatória; se tem agendamento, a observação é obrigatória.
  .refine((d) => !d.necessita_ajudantes || !!d.necessita_ajudantes_quantidade, {
    message: "necessita_ajudantes_quantidade é obrigatório quando necessita_ajudantes é true",
    path: ["necessita_ajudantes_quantidade"],
  })
  .refine((d) => !d.tem_agendamento || !!d.observacao_agendamento, {
    message: "observacao_agendamento é obrigatório quando tem_agendamento é true",
    path: ["observacao_agendamento"],
  });

export const transerveOcorrenciaQuerySchema = z.object({
  // CNPJ apenas dígitos (14). A API espera sem máscara.
  cnpj_relacionado: z.string().regex(/^\d{14}$/, "cnpj_relacionado deve ter 14 dígitos, sem pontuação"),
  codigo_nota_fiscal: z.string().min(1).max(100),
});
