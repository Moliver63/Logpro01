# 🧭 FRAMEWORK DE EXCELÊNCIA — LogPro

Adaptado do framework equivalente da MecProAI para o domínio do LogPro:
motor de cálculo determinístico (tributário, logístico, financeiro), não
geração de conteúdo via IA. Isso muda o que "alucinação" e "qualidade"
significam aqui — não existe copy pra soar mais persuasiva, existe número
que decide se uma operação de milhões de reais fecha ou não.

## MISSÃO

Todo código, decisão de arquitetura e texto de interface do LogPro serve a
um único critério: o usuário (cerealista, corretor, trading) pode confiar
no número que aparece na tela o suficiente pra tomar uma decisão comercial
real com ele. Qualquer atalho que comprometa essa confiança — mesmo que
acelere entrega — é a decisão errada.

## REGRA 1 — ENTENDIMENTO

Antes de alterar qualquer motor (`tax_engine`, `freight_engine`,
`deal_engine`), ler o arquivo inteiro, não só a função que parece relevante.
Os três motores são deliberadamente desacoplados; uma mudança que parece
local em um pode alterar o contrato que os outros esperam dele.

## REGRA 2 — PLANEJAMENTO

Mudança em regra tributária, fórmula de cálculo ou schema de banco nunca
entra direto em produção. Ordem: entender o pedido → checar se quebra
alguma operação já calculada e persistida → implementar → validar com
dados reais (as planilhas de referência ou uma operação que o usuário
forneça) → só então subir.

## REGRA 3 — ANTI-ALUCINAÇÃO (a regra mais importante deste documento)

O `tax_engine` nunca inventa uma regra tributária para um cenário sem
cadastro. Isso não é só uma escolha de design — é a garantia central do
produto. Qualquer alteração no motor que crie um caminho onde um tributo
"assume" valor zero ou um default silencioso em vez de retornar pendência
explícita é uma regressão crítica, não um detalhe.

O mesmo princípio se estende a qualquer dado que o sistema não recebeu
diretamente do usuário, de uma regra cadastrada, ou de uma API externa
real: frete sem cotação não vira "R$ 0 estimado" silenciosamente, ele
carrega a tag `origemDado: "estimado"` até a interface, onde fica visível.

**Nunca fazer:**
- Hardcodar um valor tributário "só pra passar no teste".
- Assumir alíquota de um estado com base em outro estado parecido.
- Remover uma pendência da lista sem resolver a causa (cadastrar a regra
  ou confirmar com especialista) — só esconder o aviso é pior do que não
  ter o aviso.

## REGRA 4 — VALIDAÇÃO DE CÓDIGO

Antes de qualquer commit para o repositório:

```bash
# backend
cd backend && npm run typecheck && npm test

# frontend
cd frontend && npx tsc -b --noEmit && npx vite build
```

Os três comandos pegam coisas diferentes e nenhum substitui o outro:

- `typecheck` pega erro de tipo.
- `npm test` pega erro de comportamento. Os testes fixam os números das
  planilhas de referência — foi assim que apareceu um erro de
  arredondamento no `tax_engine` que fazia `7000.000000000001` chegar na
  memória de cálculo exibida ao usuário, invisível para typecheck e build.
- `vite build` (produção, não só typecheck) já pegou problema que o `tsc`
  sozinho não pegava.

Teste novo acompanha correção de bug. Quando um erro aparece em produção,
o teste que o reproduz entra junto com a correção — senão ele volta.

## REGRA 5 — SEGURANÇA

- Token do GitHub (ou qualquer credencial) nunca é salvo em arquivo, nunca
  aparece em log, nunca é escrito em código versionado. Existe só como
  variável de ambiente durante a chamada que precisa dele, e é descartado
  no fim da tarefa.
- Nenhuma variável de ambiente sensível tem valor real commitado — o
  `.env.example` documenta a chave, nunca o valor.
- Dado de operação real de cliente (preço pago, margem, fornecedor) não
  entra em nenhum arquivo de exemplo, seed ou documentação pública do
  repositório além do que já está nas planilhas de referência que o
  próprio Michel forneceu como dado de teste.

## REGRA 6 — CHECKLIST DE DEPLOY

Antes de marcar um deploy como concluído:

1. Testes passando (`cd backend && npm test`).
2. Build local limpo (backend `npm run build`, frontend `vite build`).
3. Push pro GitHub confirmado (branch `main` atualizada, commit certo).
4. Se o autoDeploy da Render não disparar sozinho em ~30s, disparar
   manualmente (`trigger_deploy`) — já aconteceu de não disparar sozinho,
   não assumir que subiu só porque o push foi feito.
5. Conferir o log do deploy até aparecer `live`, não só `build successful`
   — build pode passar e o start command falhar depois.
6. Pra mudança de frontend, um teste visual (screenshot ou acesso real)
   antes de considerar terminado — erro de proxy/API_URL não aparece no
   build, só em runtime.

### Duas armadilhas já pagas caro — não repetir

**Nunca definir `NODE_ENV=production` no serviço da Render.** O npm passa
a pular `devDependencies`, o `typescript` não é instalado, e o
`npm run build` quebra com "Could not find a declaration file for module
'express'". Por causa disso, `typescript`, `tsx` e os `@types` moram em
`dependencies` no `package.json` do backend, com um comentário explicando.
Não "arrumar" isso movendo-os de volta para `devDependencies`.

**A API de variáveis de ambiente da Render substitui a lista inteira, não
mescla.** Enviar só uma variável apaga todas as outras — já apagou as
chaves de IA em produção. Sempre enviar o conjunto completo, ou editar
pelo dashboard.

## REGRA 7 — DOCUMENTAÇÃO

Toda sessão de trabalho que muda arquitetura, adiciona uma regra tributária
de referência, ou toma uma decisão de escopo (o que fica de fora da fase
atual) deve deixar rastro neste arquivo ou no `README.md` — não só na
conversa. Quem abrir o repositório meses depois precisa entender o "por
quê", não só o "o quê".

## REGRA 8 — SISTEMA SAAS (LogPro específico)

- Toda regra tributária carrega `fonte`, `versao` e datas de vigência —
  nunca sobrescrever uma regra existente, criar nova versão.
- Todo cálculo persistido (`operation_results`) é imutável depois de
  criado — se a regra usada mudar depois, o histórico continua mostrando
  o resultado com a regra da época, não recalculado com a atual.
- O sistema declara explicitamente a proveniência de cada número mostrado
  (`informado_usuario`, `calculado_sistema`, `api_externa`, `estimado`) —
  isso não é um detalhe de UI, é parte do contrato de confiança do
  produto.

## REGRA 13 — STOP SLOP (texto sem cara de IA)

Aplica-se a toda a interface do LogPro, não só quando pedido:

- Sem travessão usado como conector de frase (". X — que faz Y — permite
  Z" vira duas frases diretas).
- Sem "além disso", "vale ressaltar", "não só... mas também", tom
  motivacional genérico.
- Avisos legais e mensagens de erro são diretos e específicos, não em tom
  de disclaimer padrão — "essas regras ainda não foram confirmadas com um
  especialista" em vez de "usar por sua conta e risco, o sistema não se
  responsabiliza".
- "MVP" e jargão de processo interno (roadmap, fase 2, backlog) não
  aparecem na interface voltada ao usuário — isso é conversa entre Michel
  e quem constrói o produto, não algo que o corretor de grãos usando o
  sistema precisa ler.

## REGRA 14 — UI/UX PRO MAX

- Paleta e tipografia seguem a identidade da logo oficial do LogPro (navy
  `#0B1F3D`, azul `#004CF7`, ciano `#02D5FD`) — qualquer novo componente
  usa os tokens já definidos em `tailwind.config.ts`, não cores ad-hoc.
- Status crítico (operação viável/não viável) mantém verde/vermelho
  semânticos mesmo dentro de uma marca predominantemente azul — clareza
  do status vem antes de consistência cromática estrita.
- Todo número financeiro usa fonte monoespaçada (`font-mono`,
  tabular-nums) — alinhamento de dígitos importa mais em uma tela de
  decisão financeira do que em qualquer outro tipo de conteúdo.

## DECISÕES ARQUITETURAIS CONFIRMADAS

### Três motores desacoplados, não um monólito de cálculo
`tax_engine`, `freight_engine` e `deal_engine` são módulos independentes
que só se comunicam pelos tipos em `types/domain.ts`. Trocar o provider de
frete (manual → Sapiens Agro) ou a fonte das regras tributárias (seed →
banco → API de terceiro) não deve exigir tocar no `deal_engine`.

### O assistente coleta, o motor calcula

O chat nunca produz um número financeiro. Ele conversa, extrai os dados e
chama as ferramentas (`calcular_operacao`, `consultar_referencia_preco`),
que por sua vez usam exatamente os mesmos serviços que a rota REST usa.
Se um modelo "estimar" uma margem em texto sem chamar a ferramenta, isso é
falha de prompt a corrigir, nunca comportamento a aceitar.

Isso vale igualmente para os três níveis da cadeia — provedor principal,
reserva e extrator local. Nenhum deles calcula; todos chamam o mesmo motor.

### Fornecedores de IA são detalhe interno

Nem a interface nem a API expõem qual fornecedor está atendendo. O
endpoint `/api/chat/status` devolve só disponibilidade e modo. Nos logs,
os provedores são "principal" e "reserva". Trocar de fornecedor não deve
exigir mudança em nada externo — e não deve aparecer para o usuário.

Provedor fora do ar não é tentado de novo a cada mensagem: o
`circuitBreaker` mantém um cooldown com backoff, e distingue sobrecarga
passageira (minutos) de cota diária esgotada (horas), porque insistir no
segundo caso não resolve até a cota resetar.

### O extrator local nunca adivinha

O fallback sem IA identifica origem e destino pelo verbo que os acompanha
("compro em X", "vendo em Y"), nunca pela ordem em que aparecem no texto.
A versão anterior pegava os dois primeiros locais na ordem da frase, o que
invertia a rota quando o usuário escrevia a venda antes da compra —
calculando tributos de SP→MT em vez de MT→SP, sem nenhum aviso. Erro
silenciosamente errado é o pior tipo possível neste produto; existe teste
de regressão fixando esse comportamento.

### Transerve não é um FreightProvider

A API da Transerve solicita frete e rastreia entrega, mas não devolve
cotação de preço. Implementá-la como `FreightProvider` obrigaria a
inventar um valor por tonelada para cumprir a interface — exatamente o que
a Regra 3 proíbe. Ela vive em `integrations/`, separada do
`freight_engine`. O frete continua vindo do que o usuário informa.

### Endpoints protegidos por padrão

O CORS é restrito à origem do frontend (`FRONTEND_ORIGIN`) e há rate limit
em todas as rotas, mais apertado no chat porque cada mensagem consome cota
externa finita. Rota nova entra protegida; abrir o CORS "só para testar" é
como o endpoint de chat ficou exposto a qualquer origem por um tempo.

### Erro em rota async precisa de next(erro)

O Express 4 não captura exceção lançada dentro de handler `async`. Sem
`try/catch` + `next(erro)`, a requisição fica pendurada sem resposta (o
usuário vê "Calculando…" para sempre) e o processo gera unhandled
rejection. Toda rota async encaminha erro para o handler central do
`server.ts`.

### SQLite local como ponte, não como decisão final de produção
A escolha de SQLite via Drizzle foi para rodar sem infraestrutura externa
na fase inicial. O schema já é escrito para migrar a Postgres com mudança
mínima (troca de driver, não de modelagem). Enquanto o backend rodar em
disco efêmero da Render sem volume persistente, operações calculadas não
sobrevivem a um redeploy — isso é uma limitação conhecida, não um bug a
esconder do usuário.

### Backend e frontend como serviços separados na Render
Web Service (backend, Node) e Static Site (frontend, build estático) são
dois serviços distintos, não um monólito servindo os dois. O frontend fala
com o backend por URL pública configurada via `VITE_API_URL`, nunca por
caminho relativo — os dois vivem em domínios `.onrender.com` diferentes.

### Cadeia de commit via GitHub API
Mesmo padrão da MecProAI: blob → tree → commit → PATCH ref, usando token
recebido na conversa, nunca persistido. Depois de qualquer push, o
autoDeploy da Render pode não disparar sozinho — checar e disparar
manualmente se necessário antes de considerar o deploy concluído.

## PENDÊNCIAS TÉCNICAS ABERTAS

**Críticas — bloqueiam uso comercial**

- Regras seed precisam de validação com especialista tributário/contábil.
  Pendência declarada desde a criação do motor, ainda não resolvida.
- Piso mínimo ANTT com vigência **deliberadamente expirada** (12/03/2026,
  véspera da Portaria SUROC nº 3/2026). Isso força pendência explícita em
  vez de calcular com coeficiente velho. Confirmar os valores vigentes em
  `calculadorafrete.antt.gov.br` e cadastrar nova versão da regra.
- Dados da CEPEA são CC BY-NC 4.0 (não comercial). O uso atual foi
  autorizado como projeto de estudo. Virando produto comercial, essa fonte
  precisa ser renegociada com a CEPEA.

**Abertas**

- Regras tributárias cobrem só os dois cenários das planilhas de
  referência (soja MT→SP, milho MT→MT) — qualquer outra combinação de UF
  retorna pendência por design, não é bug.
- Sem disco persistente na Render — histórico de operações calculadas não
  sobrevive a redeploy do backend.
- Credenciais Transerve (`TRANSERVE_CLIENT_ID` / `TRANSERVE_CLIENT_SECRET`)
  ainda não fornecidas; sem elas as rotas respondem 503 explícito.
- Sorgo não tem regra tributária nem fonte de cotação (a B3 não tem
  contrato futuro de sorgo e a CEPEA não publica indicador) — o produto
  existe no sistema e retorna pendência nos dois casos, por design.
- Cotação de soja e sorgo em R$/saca não tem API gratuita e comercialmente
  utilizável. Alpha Vantage cobre só milho e trigo, via Chicago.
- Rotas Transerve de relatórios, viagens, CT-e e NF-e não implementadas —
  dependem de contratação e liberação técnica da Transerve.

**Resolvidas**

- Serviço antigo `Logpro01` mal configurado — suspenso por Michel.
