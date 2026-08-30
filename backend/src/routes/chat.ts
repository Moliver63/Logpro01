import { Router } from "express";
import { GoogleGenAI, FunctionCallingConfigMode, type Content, type FunctionDeclaration } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { operacaoInputSchema } from "./validation.js";
import { executarCalculo } from "../services/calculoService.js";

export const chatRouter = Router();

const MODELO = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

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

const calcularOperacaoDeclaration: FunctionDeclaration = {
  name: "calcular_operacao",
  description:
    "Calcula a viabilidade de uma operação de compra e venda de grãos com os dados coletados até agora. Só chame quando tiver ao menos produto, sacas, preço de compra, preço de venda, origem e destino.",
  // $refStrategy: "none" é essencial aqui — o schema tem campos que reaproveitam
  // o mesmo validador Zod (ex: precoPorSaca em compra e venda), e por padrão a
  // biblioteca fatora isso em referências ($ref) para um objeto "definitions".
  // Como mandamos só o schema do OperacaoInput pro Gemini (sem esse objeto
  // externo), qualquer $ref vira uma referência quebrada. Com "none", tudo
  // fica expandido por extenso, sem $ref nenhuma.
  parametersJsonSchema: zodToJsonSchema(operacaoInputSchema, { $refStrategy: "none" }),
};

interface MensagemChat {
  role: "user" | "assistant";
  content: string;
}

chatRouter.post("/", async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ erro: "Chat indisponível — GEMINI_API_KEY não configurada no backend." });
  }

  const mensagens: MensagemChat[] = Array.isArray(req.body?.mensagens) ? req.body.mensagens : [];
  if (mensagens.length === 0) {
    return res.status(400).json({ erro: "Nenhuma mensagem enviada." });
  }

  try {
    // Gemini usa role "model" em vez de "assistant" e agrupa texto em "parts".
    const historico: Content[] = mensagens.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    let resultadoOperacao = null;
    let operationId: string | null = null;
    let textoFinal = "";

    // Loop de tool use: no máximo 3 idas e voltas por requisição, pra não
    // deixar a chamada rodando indefinidamente se algo sair do esperado.
    for (let passo = 0; passo < 3; passo++) {
      const resposta = await genAI.models.generateContent({
        model: MODELO,
        contents: historico,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: [calcularOperacaoDeclaration] }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        },
      });

      if (resposta.text) {
        textoFinal = resposta.text;
      }

      const chamada = resposta.functionCalls?.[0];

      if (!chamada) {
        // Modelo respondeu só texto — não precisa mais rodar a ferramenta, encerra o loop.
        break;
      }

      // Guarda o turno do modelo (com a function call) no histórico.
      historico.push({
        role: "model",
        parts: [{ functionCall: { name: chamada.name, args: chamada.args } }],
      });

      const parsed = operacaoInputSchema.safeParse(chamada.args);
      if (!parsed.success) {
        // Dado insuficiente ou mal formado — devolve o erro pro modelo tentar de novo pedindo o que falta.
        historico.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "calcular_operacao",
                response: {
                  erro: "Dados incompletos ou inválidos",
                  detalhes: parsed.error.flatten(),
                  instrucao: "Peça ao usuário os campos que faltam.",
                },
              },
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
        parts: [
          {
            functionResponse: {
              name: "calcular_operacao",
              response: resultado.resultado as unknown as Record<string, unknown>,
            },
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
