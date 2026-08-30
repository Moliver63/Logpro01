import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { operacaoInputSchema } from "./validation.js";
import { executarCalculo } from "../services/calculoService.js";

export const chatRouter = Router();

const MODELO = process.env.ANTHROPIC_CHAT_MODEL ?? "claude-sonnet-5";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

/**
 * REGRA DE OURO — não negociável:
 *
 * O assistente de chat NUNCA calcula margem, tributo, piso mínimo ou
 * viabilidade por conta própria. A única fonte de verdade para qualquer
 * número financeiro é a chamada da ferramenta `calcular_operacao`, que roda
 * o mesmo `executarCalculo` usado pela rota REST — os mesmos tax_engine,
 * freight_engine e deal_engine já testados.
 *
 * O papel da IA aqui é estritamente conversacional: entender o que o
 * usuário quer, perguntar o que falta, e chamar a ferramenta quando tiver
 * dado suficiente. Se o modelo tentar "estimar" um resultado em texto sem
 * chamar a ferramenta, isso é uma falha de design a corrigir no prompt —
 * nunca algo a aceitar silenciosamente.
 */
const SYSTEM_PROMPT = `Você é o assistente de preenchimento do LogPro, um motor de viabilidade de operações de compra e venda de grãos.

Sua função é ajudar o usuário a preencher os dados de uma operação através de conversa, em vez de um formulário. Você é só um coletor de dados educado e direto — nunca um calculador.

Regras que você segue sempre:
- Pergunte apenas o que falta. Não repita perguntas já respondidas.
- Campos mínimos necessários: produto, quantidade de sacas, preço de compra por saca, preço de venda por saca, município e estado de origem, município e estado de destino.
- Campos opcionais úteis mas não obrigatórios: frete por tonelada, número de eixos do veículo, distância, comissões, peso da saca (padrão 60kg).
- Assim que tiver os campos mínimos, chame a ferramenta calcular_operacao. Não pergunte confirmação antes de chamar — chame direto.
- Você NUNCA calcula, estima ou menciona um valor de margem, resultado, tributo ou viabilidade por conta própria em texto. Todo número financeiro sai exclusivamente do resultado da ferramenta.
- Depois que a ferramenta retornar, resuma o resultado em 1-2 frases diretas (viável ou não, margem, resultado em R$) — os detalhes completos já aparecem numa tela separada, você não precisa repetir tudo.
- Se o usuário pedir pra mudar um valor depois de já ter calculado, colete o novo dado e chame a ferramenta de novo com os dados atualizados.
- Tom: direto, sem enrolação, português do Brasil. Sem "olá! ficarei feliz em ajudar" — vai direto ao ponto.`;

const calcularOperacaoTool: Anthropic.Tool = {
  name: "calcular_operacao",
  description:
    "Calcula a viabilidade de uma operação de compra e venda de grãos com os dados coletados até agora. Só chame quando tiver ao menos produto, sacas, preço de compra, preço de venda, origem e destino.",
  input_schema: zodToJsonSchema(operacaoInputSchema, "OperacaoInput").definitions![
    "OperacaoInput"
  ] as Anthropic.Tool.InputSchema,
};

interface MensagemChat {
  role: "user" | "assistant";
  content: string;
}

chatRouter.post("/", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ erro: "Chat indisponível — ANTHROPIC_API_KEY não configurada no backend." });
  }

  const mensagens: MensagemChat[] = Array.isArray(req.body?.mensagens) ? req.body.mensagens : [];
  if (mensagens.length === 0) {
    return res.status(400).json({ erro: "Nenhuma mensagem enviada." });
  }

  try {
    const historico: Anthropic.MessageParam[] = mensagens.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let resultadoOperacao = null;
    let operationId: string | null = null;
    let textoFinal = "";

    // Loop de tool use: no máximo 3 idas e voltas por requisição, pra não
    // deixar a chamada rodando indefinidamente se algo sair do esperado.
    for (let passo = 0; passo < 3; passo++) {
      const resposta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [calcularOperacaoTool],
        messages: historico,
      });

      const blocoTexto = resposta.content.find((b) => b.type === "text");
      if (blocoTexto && blocoTexto.type === "text") {
        textoFinal = blocoTexto.text;
      }

      const blocoFerramenta = resposta.content.find((b) => b.type === "tool_use");

      if (!blocoFerramenta || blocoFerramenta.type !== "tool_use") {
        // Modelo respondeu só texto — não precisa mais rodar a ferramenta, encerra o loop.
        break;
      }

      historico.push({ role: "assistant", content: resposta.content });

      const parsed = operacaoInputSchema.safeParse(blocoFerramenta.input);
      if (!parsed.success) {
        // Dado insuficiente ou mal formado — devolve o erro pro modelo tentar de novo pedindo o que falta.
        historico.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: blocoFerramenta.id,
              content: `Dados incompletos ou inválidos: ${JSON.stringify(parsed.error.flatten())}. Peça ao usuário os campos que faltam.`,
              is_error: true,
            },
          ],
        });
        continue;
      }

      const resultado = await executarCalculo(parsed.data);
      resultadoOperacao = resultado.resultado;
      operationId = resultado.operationId;

      historico.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: blocoFerramenta.id,
            content: JSON.stringify(resultado.resultado),
          },
        ],
      });
    }

    return res.json({ resposta: textoFinal, resultadoOperacao, operationId });
  } catch (erro) {
    console.error("Erro no chat:", erro);
    return res.status(500).json({ erro: "Falha ao processar a conversa." });
  }
});
