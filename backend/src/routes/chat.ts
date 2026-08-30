import { Router } from "express";
import { GoogleGenAI, FunctionCallingConfigMode, type Content, type FunctionDeclaration, type GenerateContentResponse } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { operacaoInputSchema } from "./validation.js";
import { executarCalculo } from "../services/calculoService.js";
import { extrairDoTexto, descreverCamposFaltando } from "../services/extratorLocal.js";

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
 * freight_engine e deal_engine já testados. Isso vale tanto pro caminho
 * normal (Gemini) quanto pro fallback local — os dois só coletam dados,
 * quem calcula é sempre o mesmo motor determinístico.
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
  parametersJsonSchema: zodToJsonSchema(operacaoInputSchema, { $refStrategy: "none" }),
};

interface MensagemChat {
  role: "user" | "assistant";
  content: string;
}

function erroEhTemporario(erro: unknown): boolean {
  const texto = String((erro as { message?: string })?.message ?? erro);
  return texto.includes("503") || texto.includes("UNAVAILABLE") || texto.includes("high demand");
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Chama o Gemini com retry — só pra falha temporária (503/sobrecarga). Erros de outro tipo (chave inválida, schema, etc.) sobem direto, sem retry. */
async function chamarGeminiComRetry(
  historico: Content[],
  tentativas = 3
): Promise<GenerateContentResponse> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await genAI.models.generateContent({
        model: MODELO,
        contents: historico,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: [calcularOperacaoDeclaration] }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        },
      });
    } catch (erro) {
      ultimoErro = erro;
      if (!erroEhTemporario(erro) || i === tentativas - 1) throw erro;
      await aguardar(1200 * (i + 1)); // 1.2s, depois 2.4s
    }
  }
  throw ultimoErro;
}

/**
 * Fallback sem IA nenhuma — extrator local baseado em regras (ver
 * extratorLocal.ts). Roda inteiramente no seu servidor, sem chamada
 * externa, sempre disponível. Usado quando o Gemini falha mesmo depois do
 * retry, ou quando a chave não está configurada.
 */
async function responderComFallbackLocal(mensagens: MensagemChat[]) {
  const textoUsuario = mensagens
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  const { campos, faltando } = extrairDoTexto(textoUsuario);

  if (faltando.length > 0) {
    return {
      resposta: `Assistente de IA indisponível no momento — usando extração local simples. Ainda faltam: ${descreverCamposFaltando(
        faltando
      )}. Pode escrever de novo incluindo isso, ou usar o Formulário (funciona sempre, sem depender de IA).`,
      resultadoOperacao: null,
      operationId: null,
    };
  }

  const input = {
    mercadoria: { produto: campos.produto!, quantidadeSacas: campos.quantidadeSacas!, pesoPorSacaKg: 60 },
    compra: {
      precoPorSaca: campos.precoCompraPorSaca!,
      municipioOrigem: campos.municipioOrigem!,
      estadoOrigem: campos.estadoOrigem!,
    },
    venda: {
      precoPorSaca: campos.precoVendaPorSaca!,
      municipioDestino: campos.municipioDestino!,
      estadoDestino: campos.estadoDestino!,
    },
    logistica: campos.fretePorTonelada ? { fretePorTonelada: campos.fretePorTonelada } : {},
    tipoOperacao: "SOBRE_RODAS",
  };

  const parsed = operacaoInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      resposta:
        "Assistente de IA indisponível — tentei extrair os dados do seu texto mas algo não bateu com o formato esperado. Use o Formulário, que funciona sempre.",
      resultadoOperacao: null,
      operationId: null,
    };
  }

  const resultado = await executarCalculo(parsed.data);
  return {
    resposta: `Assistente de IA indisponível no momento — calculei com extração local a partir do que você escreveu. Confira se os dados abaixo batem com o que você quis dizer: ${
      resultado.resultado.viavel ? "operação viável" : "operação não viável"
    }, margem de ${resultado.resultado.margemPercentual.toFixed(1)}%.`,
    resultadoOperacao: resultado.resultado,
    operationId: resultado.operationId,
  };
}

chatRouter.post("/", async (req, res) => {
  const mensagens: MensagemChat[] = Array.isArray(req.body?.mensagens) ? req.body.mensagens : [];
  if (mensagens.length === 0) {
    return res.status(400).json({ erro: "Nenhuma mensagem enviada." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.json(await responderComFallbackLocal(mensagens));
  }

  try {
    const historico: Content[] = mensagens.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    let resultadoOperacao = null;
    let operationId: string | null = null;
    let textoFinal = "";

    for (let passo = 0; passo < 3; passo++) {
      const resposta = await chamarGeminiComRetry(historico);

      if (resposta.text) {
        textoFinal = resposta.text;
      }

      const chamada = resposta.functionCalls?.[0];

      if (!chamada) {
        break;
      }

      historico.push({
        role: "model",
        parts: [{ functionCall: { name: chamada.name, args: chamada.args } }],
      });

      const parsed = operacaoInputSchema.safeParse(chamada.args);
      if (!parsed.success) {
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
    console.error("Erro no chat (Gemini indisponível após retry, caindo pro fallback local):", erro);
    try {
      return res.json(await responderComFallbackLocal(mensagens));
    } catch (erroFallback) {
      console.error("Erro no fallback local:", erroFallback);
      return res.status(500).json({ erro: "Falha ao processar a conversa." });
    }
  }
});
