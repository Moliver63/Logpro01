import { Router } from "express";
import { GoogleGenAI, FunctionCallingConfigMode, type Content, type FunctionDeclaration, type GenerateContentResponse } from "@google/genai";
import Groq from "groq-sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { operacaoInputSchema } from "./validation.js";
import { executarCalculo } from "../services/calculoService.js";
import { pesquisarReferenciaPreco } from "../services/precoReferenciaService.js";
import { extrairDoTexto, descreverCamposFaltando } from "../services/extratorLocal.js";
import { circuitoAberto, registrarFalha, registrarSucesso, statusCircuitos } from "../services/circuitBreaker.js";
import { proximaChaveDisponivel, marcarChaveEsgotada, totalChavesConfiguradas, statusChaves } from "../services/geminiKeyPool.js";
import type { ResultadoOperacao } from "../types/domain.js";

export const chatRouter = Router();

const MODELO_GEMINI = process.env.GEMINI_CHAT_MODEL ?? "gemini-flash-latest";
const MODELO_GROQ = process.env.GROQ_CHAT_MODEL ?? "openai/gpt-oss-120b";

/** Quantas mensagens do histórico são reenviadas por turno. Ver comentário na rota POST. */
const MAX_MENSAGENS_HISTORICO = 16;

// Não cria mais um cliente único fixo — cada chamada pega a chave disponível
// no momento via geminiKeyPool, pra suportar rotação entre GEMINI_API_KEY,
// GEMINI_API_KEY2, GEMINI_API_KEY3.

/**
 * REGRA DE OURO — não negociável, vale para TODOS os provedores nesta cadeia:
 *
 * O agente NUNCA calcula margem, tributo, piso mínimo ou viabilidade por
 * conta própria, e NUNCA inventa um preço de mercado — nem no Gemini, nem
 * no Groq, nem no fallback local. Toda decisão numérica sai de uma das duas
 * ferramentas (calcular_operacao ou consultar_referencia_preco), que por
 * sua vez chamam exatamente os mesmos motores/serviços já testados que o
 * resto do LogPro usa (tax_engine, freight_engine, deal_engine, CEPEA,
 * Alpha Vantage). O agente só decide QUANDO chamar cada ferramenta e
 * conversa com o usuário — nunca inventa o resultado delas.
 *
 * CADEIA DE FALLBACK (mesmo padrão já usado na MecProAI):
 * 1. Gemini (com retry para falha temporária/503)
 * 2. Groq (se Gemini falhar ou não tiver chave)
 * 3. Extrator local por regras — sem IA nenhuma, sempre disponível
 *    (esse último nível não pesquisa preço, só extrai o que já está escrito)
 */
const SYSTEM_PROMPT = `Você é o assistente de preenchimento do LogPro, um motor de viabilidade de operações de compra e venda de grãos.

Sua função é ajudar o usuário a preencher os dados de uma operação através de conversa, em vez de um formulário. Você é um coletor de dados educado e direto — nunca um calculador, e nunca uma fonte de preço.

Campos mínimos necessários pra calcular: produto, quantidade de sacas, preço de compra por saca, preço de venda por saca, município e estado de origem, município e estado de destino.
Campos opcionais úteis: frete por tonelada, número de eixos do veículo, distância, comissões, peso da saca (padrão 60kg).

Ferramentas disponíveis:
- calcular_operacao: chame assim que tiver os campos mínimos. Não peça confirmação antes — chame direto.
- consultar_referencia_preco: use quando o usuário não souber que preço usar, pedir uma sugestão, perguntar "quanto está a saca hoje", ou parecer inseguro sobre o valor que informou. Nunca invente um preço de mercado sozinho — sempre chame essa ferramenta pra isso. Depois de consultar, deixe claro que é uma referência (não o preço físico exato da praça dele) e pergunte se ele quer usar esse valor ou informar outro.

Situações que você precisa saber lidar:
- Produto ambíguo ou não reconhecido (ex: "grão", "cereal"): pergunte qual produto especificamente (soja, milho, trigo ou sorgo).
- Pergunta fora do escopo (clima, notícia, outro assunto qualquer): responda educadamente que você só ajuda a calcular viabilidade de operação de grãos, e redirecione.
- Usuário manda vários números sem contexto claro: peça pra ele confirmar o que é o quê antes de calcular.
- Depois de calcular, se o usuário quiser mudar um valor: colete o novo dado e chame calcular_operacao de novo com os dados atualizados (incluindo os que não mudaram).
- Se a operação der não viável: não amenize nem sugira "jeitinho" — só reporte o resultado com neutralidade, é uma informação, não um problema seu pra resolver.
- Se o cálculo voltar com pendências tributárias (regra não cadastrada): mencione rapidamente que existem tributos sem regra cadastrada, mas não repita a lista toda — ela já aparece na tela.

Regras que valem sempre:
- Você NUNCA calcula, estima ou menciona um valor de margem, resultado, tributo, piso mínimo ou preço de mercado por conta própria em texto. Todo número financeiro sai exclusivamente do resultado de uma ferramenta.
- Depois que calcular_operacao retornar, resuma em 1-2 frases diretas (viável ou não, margem, resultado em R$) — os detalhes completos já aparecem numa tela separada.
- Tom: direto, sem enrolação, português do Brasil. Sem "olá! ficarei feliz em ajudar" — vai direto ao ponto.`;

const PARAMETROS_CALCULO = zodToJsonSchema(operacaoInputSchema, { $refStrategy: "none" });

const PARAMETROS_REFERENCIA_PRECO = {
  type: "object",
  properties: {
    produto: { type: "string", enum: ["SOJA", "MILHO", "TRIGO", "SORGO"] },
  },
  required: ["produto"],
};

const DESCRICAO_CALCULAR =
  "Calcula a viabilidade de uma operação de compra e venda de grãos com os dados coletados até agora. Só chame quando tiver ao menos produto, sacas, preço de compra, preço de venda, origem e destino.";
const DESCRICAO_REFERENCIA =
  "Consulta uma referência de preço de mercado (CEPEA para o mercado físico brasileiro, ou Chicago/CBOT como alternativa) pra ajudar o usuário a saber se um preço é razoável. Não é o preço exato da praça dele — é só uma referência.";

const declaracoesGemini: FunctionDeclaration[] = [
  { name: "calcular_operacao", description: DESCRICAO_CALCULAR, parametersJsonSchema: PARAMETROS_CALCULO },
  { name: "consultar_referencia_preco", description: DESCRICAO_REFERENCIA, parametersJsonSchema: PARAMETROS_REFERENCIA_PRECO },
];

const ferramentasGroq = [
  { type: "function" as const, function: { name: "calcular_operacao", description: DESCRICAO_CALCULAR, parameters: PARAMETROS_CALCULO as Record<string, unknown> } },
  { type: "function" as const, function: { name: "consultar_referencia_preco", description: DESCRICAO_REFERENCIA, parameters: PARAMETROS_REFERENCIA_PRECO } },
];

export interface MensagemChat {
  role: "user" | "assistant";
  content: string;
}

interface RespostaChat {
  resposta: string;
  resultadoOperacao: ResultadoOperacao | null;
  operationId: string | null;
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function erroEhTemporario(erro: unknown): boolean {
  const texto = String((erro as { message?: string })?.message ?? erro);
  return (
    texto.includes("503") ||
    texto.includes("429") ||
    texto.includes("UNAVAILABLE") ||
    texto.includes("high demand") ||
    texto.includes("rate limit")
  );
}

/**
 * Cota diária esgotada (ex: "20 requests/day" no free tier) é diferente de
 * sobrecarga passageira — não adianta tentar de novo em 45s, só volta a
 * funcionar depois que a cota resetar. Detecta isso separadamente pra abrir
 * o circuito por horas, não minutos, e não desperdiçar tentativa nenhuma
 * enquanto isso.
 */
function erroEhCotaDiariaEsgotada(erro: unknown): boolean {
  const texto = String((erro as { message?: string })?.message ?? erro);
  return texto.includes("RESOURCE_EXHAUSTED") || texto.includes("exceeded your current quota");
}

const COOLDOWN_COTA_DIARIA_MS = 3 * 60 * 60_000; // 3h — não sabemos o horário exato de reset da cota, usa uma janela conservadora

/* ---------------- Provedor 1: Gemini ---------------- */

async function chamarGeminiComRetry(historico: Content[], tentativas = 4): Promise<GenerateContentResponse> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    const chave = proximaChaveDisponivel();
    if (!chave) {
      // Todas as chaves configuradas estão com cota esgotada agora — não
      // adianta insistir, sobe o erro pra cair no Groq.
      throw ultimoErro ?? new Error("Nenhuma chave Gemini disponível (todas com cota esgotada no momento).");
    }

    try {
      const cliente = new GoogleGenAI({ apiKey: chave });
      return await cliente.models.generateContent({
        model: MODELO_GEMINI,
        contents: historico,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: declaracoesGemini }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        },
      });
    } catch (erro) {
      ultimoErro = erro;
      if (erroEhCotaDiariaEsgotada(erro)) {
        // Essa chave específica esgotou — marca ela e tenta a próxima
        // disponível já na iteração seguinte, sem esperar backoff (o
        // problema não é sobrecarga passageira, é cota, não resolve com
        // espera curta).
        marcarChaveEsgotada(chave);
        continue;
      }
      if (!erroEhTemporario(erro) || i === tentativas - 1) throw erro;
      await aguardar(1200 * (i + 1));
    }
  }
  throw ultimoErro;
}

async function tentarComGemini(mensagens: MensagemChat[]): Promise<RespostaChat> {
  const historico: Content[] = mensagens.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let resultadoOperacao: ResultadoOperacao | null = null;
  let operationId: string | null = null;
  let textoFinal = "";

  for (let passo = 0; passo < 4; passo++) {
    const resposta = await chamarGeminiComRetry(historico);
    if (resposta.text) textoFinal = resposta.text;

    const chamada = resposta.functionCalls?.[0];
    if (!chamada) break;

    historico.push({ role: "model", parts: [{ functionCall: { name: chamada.name, args: chamada.args } }] });

    if (chamada.name === "consultar_referencia_preco") {
      const produto = String((chamada.args as { produto?: string } | undefined)?.produto ?? "").toUpperCase();
      const referencia = await pesquisarReferenciaPreco(produto);
      historico.push({
        role: "user",
        parts: [{ functionResponse: { name: "consultar_referencia_preco", response: referencia as unknown as Record<string, unknown> } }],
      });
      continue;
    }

    const parsed = operacaoInputSchema.safeParse(chamada.args);
    if (!parsed.success) {
      historico.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: "calcular_operacao",
              response: { erro: "Dados incompletos ou inválidos", detalhes: parsed.error.flatten(), instrucao: "Peça ao usuário os campos que faltam." },
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
      parts: [{ functionResponse: { name: "calcular_operacao", response: resultado.resultado as unknown as Record<string, unknown> } }],
    });
  }

  return { resposta: textoFinal, resultadoOperacao, operationId };
}

/* ---------------- Provedor 2: Groq (fallback) ---------------- */

async function chamarGroqComRetry(groq: Groq, historico: Groq.Chat.ChatCompletionMessageParam[], tentativas = 2) {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await groq.chat.completions.create({
        model: MODELO_GROQ,
        messages: historico,
        tools: ferramentasGroq,
        tool_choice: "auto",
        temperature: 0.3,
      });
    } catch (erro) {
      ultimoErro = erro;
      if (!erroEhTemporario(erro) || i === tentativas - 1) throw erro;
      await aguardar(1200 * (i + 1));
    }
  }
  throw ultimoErro;
}

async function tentarComGroq(mensagens: MensagemChat[]): Promise<RespostaChat> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const historico: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...mensagens.map((m) => ({ role: m.role, content: m.content }) as Groq.Chat.ChatCompletionMessageParam),
  ];

  let resultadoOperacao: ResultadoOperacao | null = null;
  let operationId: string | null = null;
  let textoFinal = "";

  for (let passo = 0; passo < 4; passo++) {
    const resposta = await chamarGroqComRetry(groq, historico);
    const msg = resposta.choices[0].message;
    if (msg.content) textoFinal = msg.content;

    const chamada = msg.tool_calls?.[0];
    if (!chamada) break;

    historico.push(msg);

    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(chamada.function.arguments);
    } catch {
      // args inválido — zod ou o handler abaixo tratam
    }

    if (chamada.function.name === "consultar_referencia_preco") {
      const produto = String(args.produto ?? "").toUpperCase();
      const referencia = await pesquisarReferenciaPreco(produto);
      historico.push({ role: "tool", tool_call_id: chamada.id, content: JSON.stringify(referencia) });
      continue;
    }

    const parsed = operacaoInputSchema.safeParse(args);
    if (!parsed.success) {
      historico.push({
        role: "tool",
        tool_call_id: chamada.id,
        content: JSON.stringify({ erro: "Dados incompletos ou inválidos", detalhes: parsed.error.flatten() }),
      });
      continue;
    }

    const resultado = await executarCalculo(parsed.data);
    resultadoOperacao = resultado.resultado;
    operationId = resultado.operationId;

    historico.push({ role: "tool", tool_call_id: chamada.id, content: JSON.stringify(resultado.resultado) });
  }

  return { resposta: textoFinal, resultadoOperacao, operationId };
}

/* ---------------- Provedor 3: extrator local (sem IA nenhuma) ---------------- */

async function responderComFallbackLocal(mensagens: MensagemChat[]): Promise<RespostaChat> {
  const textoUsuario = mensagens.filter((m) => m.role === "user").map((m) => m.content).join(" ");
  const { campos, faltando } = extrairDoTexto(textoUsuario);

  if (faltando.length > 0) {
    return {
      resposta: `Estou no modo simplificado agora. Ainda faltam: ${descreverCamposFaltando(
        faltando
      )}. Pode escrever de novo incluindo isso, ou usar o Formulário (funciona sempre, sem depender de IA).`,
      resultadoOperacao: null,
      operationId: null,
    };
  }

  const input = {
    mercadoria: { produto: campos.produto!, quantidadeSacas: campos.quantidadeSacas!, pesoPorSacaKg: 60 },
    compra: { precoPorSaca: campos.precoCompraPorSaca!, municipioOrigem: campos.municipioOrigem!, estadoOrigem: campos.estadoOrigem! },
    venda: { precoPorSaca: campos.precoVendaPorSaca!, municipioDestino: campos.municipioDestino!, estadoDestino: campos.estadoDestino! },
    logistica: campos.fretePorTonelada ? { fretePorTonelada: campos.fretePorTonelada } : {},
    tipoOperacao: "SOBRE_RODAS",
  };

  const parsed = operacaoInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      resposta:
        "Não consegui entender os dados do jeito que foram escritos. O formulário funciona sempre e é o caminho mais direto agora.",
      resultadoOperacao: null,
      operationId: null,
    };
  }

  const resultado = await executarCalculo(parsed.data);
  return {
    resposta: `Calculei com o que você escreveu. Vale conferir se os dados abaixo batem: ${
      resultado.resultado.viavel ? "operação viável" : "operação não viável"
    }, margem de ${resultado.resultado.margemPercentual.toFixed(1)}%.`,
    resultadoOperacao: resultado.resultado,
    operationId: resultado.operationId,
  };
}

/* ---------------- Rota ---------------- */

/**
 * GET /api/chat/status — diagnóstico de disponibilidade.
 *
 * Não expõe qual fornecedor de IA está por trás nem qual modelo — isso é
 * detalhe interno de implementação. Publicamente o assistente é só "o
 * assistente do LogPro"; os provedores são referidos como "principal" e
 * "reserva", e podem ser trocados a qualquer momento sem que nada externo
 * dependa desses nomes.
 */
chatRouter.get("/status", (_req, res) => {
  const principal = statusCircuitos().gemini;
  const reserva = statusCircuitos().groq;

  const assistenteDisponivel =
    (totalChavesConfiguradas() > 0 && !principal?.aberto) || (!!process.env.GROQ_API_KEY && !reserva?.aberto);

  res.json({
    assistenteDisponivel,
    // Modo de operação atual, sem citar fornecedor:
    // "assistente" = IA respondendo; "local" = extrator determinístico.
    modo: assistenteDisponivel ? "assistente" : "local",
  });
});

chatRouter.post("/", async (req, res) => {
  const recebidas: MensagemChat[] = Array.isArray(req.body?.mensagens) ? req.body.mensagens : [];
  if (recebidas.length === 0) {
    return res.status(400).json({ erro: "Nenhuma mensagem enviada." });
  }

  // Mantém só as últimas trocas. O histórico inteiro é reenviado a cada
  // turno, então sem esse corte a conversa fica progressivamente mais cara
  // e mais lenta. Coleta de dados de uma operação não precisa de contexto
  // longo — o que importa está nas mensagens recentes.
  const mensagens = recebidas.slice(-MAX_MENSAGENS_HISTORICO);

  if (totalChavesConfiguradas() > 0 && !circuitoAberto("gemini")) {
    try {
      const resultado = await tentarComGemini(mensagens);
      registrarSucesso("gemini");
      return res.json(resultado);
    } catch (erro) {
      registrarFalha("gemini", erroEhCotaDiariaEsgotada(erro) ? COOLDOWN_COTA_DIARIA_MS : undefined);
      console.error("[assistente] provedor principal indisponível, tentando reserva:", erro);
    }
  } else if (totalChavesConfiguradas() > 0) {
    console.log("[assistente] provedor principal em cooldown — indo direto pro reserva.");
  }

  if (process.env.GROQ_API_KEY && !circuitoAberto("groq")) {
    try {
      const resultado = await tentarComGroq(mensagens);
      registrarSucesso("groq");
      return res.json(resultado);
    } catch (erro) {
      registrarFalha("groq", erroEhCotaDiariaEsgotada(erro) ? COOLDOWN_COTA_DIARIA_MS : undefined);
      console.error("[assistente] provedor reserva indisponível, caindo pro extrator local:", erro);
    }
  } else if (process.env.GROQ_API_KEY) {
    console.log("[assistente] provedor reserva em cooldown — indo direto pro extrator local.");
  }

  try {
    return res.json(await responderComFallbackLocal(mensagens));
  } catch (erro) {
    console.error("Erro no fallback local:", erro);
    return res.status(500).json({ erro: "Falha ao processar a conversa." });
  }
});
