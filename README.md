# LogPro

Motor de viabilidade de operações de grãos. Responde a uma pergunta:
**"essa operação fecha ou não fecha?"** — e qual combinação de preço, frete
e tributos gera a melhor margem.

Sem marketplace, sem match automático, sem negociação dentro da plataforma
nesta fase — só o motor de cálculo, com um assistente conversacional por
cima dele.

## Estrutura

```
logpro/
  backend/    Node + Express + TypeScript + Drizzle + Postgres
    src/engines/tax_engine/          motor tributário — nunca inventa regra
    src/engines/freight_engine/      motor de frete — adapters/providers
      piso_minimo/                   piso mínimo ANTT (Lei 13.703/2018)
    src/engines/deal_engine/         motor de viabilidade — junta os acima
    src/engines/price_reference/     cotação de referência (CEPEA, Alpha Vantage)
    src/services/                    lógica compartilhada entre rotas
      calculoService.ts              porta única de entrada do cálculo
      precoReferenciaService.ts      porta única da referência de preço
      extratorLocal.ts               extração por regras, sem IA
      circuitBreaker.ts              evita insistir em provedor fora do ar
      geminiKeyPool.ts               rotação entre múltiplas chaves
    src/integrations/transerve/      integração de transporte (OAuth2)
    src/db/                          schema, seed, client
    src/routes/                      API REST
    tests/                           suíte de testes (vitest)
  frontend/   React + Vite + TypeScript + Tailwind
    src/components/ChatAssistant.tsx       conversa (modo padrão)
    src/components/OperationForm/          formulário em 4 blocos
    src/components/ResultDashboard.tsx
    src/components/CalculationMemory.tsx   "ver memória de cálculo"
    src/components/ExportActions.tsx       exportacao de consulta em PDF, Excel e CSV
    src/components/ScenarioSimulator.tsx
    src/components/PriceReferenceWidget.tsx
    src/components/SettingsPanel.tsx       preferencias abertas pela lateral
```

## Como rodar localmente

**Backend**

```bash
cd backend
cp .env.example .env   # preencher as chaves que for usar
npm install
npm run seed    # cria/atualiza tabelas no Postgres e carrega as regras tributárias de referência
npm run dev     # http://localhost:3333
```

**Frontend** (em outro terminal)

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173 — proxy de /api para o backend
```

Abra `http://localhost:5173`.

Em desenvolvimento o `vite.config.ts` faz proxy de `/api` para
`localhost:3333`, então nada precisa ser configurado. Em produção não existe
proxy (frontend e backend são serviços separados na Render), e o frontend
precisa da variável `VITE_API_URL` apontando para a URL pública do backend.

Para liberar `http://localhost` no CORS do backend durante o
desenvolvimento, defina `PERMITIR_CORS_LOCALHOST=true`.

## Testes

```bash
cd backend && npm test
```

54 testes cobrindo o motor de cálculo contra os números das planilhas de
referência, a validação de entrada, o extrator local (incluindo a regressão
de inversão origem/destino), a persistência (`calculoService`, incluindo
idempotência e replay), o cálculo automático de distância rodoviária
(OpenStreetMap/OSRM, com mocks — nenhum teste bate na rede), os coeficientes
vigentes do piso mínimo ANTT e a integração Transerve. Rodar antes de
qualquer commit.

Dois bugs já escaparam de typecheck e build e só apareceram em teste ou em
runtime: um arredondamento no `tax_engine` que vazava
`7000.000000000001` para a memória de cálculo, e uma transação `async` no
`calculoService` que derrubava **toda** operação válida com erro 500. Os
dois têm teste de regressão fixando o comportamento.

## API

**Cálculo**

- `POST /api/operations/calcular` — calcula viabilidade de uma operação.
  Aceita o header opcional `Idempotency-Key`: repetir a requisição com a
  mesma chave e os mesmos dados (duplo clique, retry de rede) devolve a
  operação original em vez de gravar uma duplicata, com o header
  `Idempotent-Replayed: true` na resposta. Reusar a chave com dados
  diferentes retorna `409`. A chave é escopada por usuário e o hash
  normalizado do input fica persistido para auditoria.
- `POST /api/operations/simular` — compara até 10 cenários e aponta o melhor
  (completa a distância pela rota real quando só origem/destino são informados)
- `GET /api/tax-rules` — lista as regras tributárias cadastradas

**Referência de preço**

- `GET /api/price-reference/:produto` — cotação de referência (SOJA, MILHO,
  TRIGO, SORGO). Tenta a CEPEA primeiro (preço físico brasileiro); se não
  cobrir o produto, cai para a Alpha Vantage (Chicago/CBOT). Produto sem
  cobertura retorna pendência explícita, nunca um valor inventado.
- `POST /api/freight-reference/antt` — calcula uma referência de piso mínimo
  ANTT quando houver quantidade, peso por saca, distância e eixos. Se a
  distância não for informada mas houver município/UF de origem e destino,
  ela é calculada pela rota rodoviária real (OpenStreetMap/OSRM, gratuito)
  e marcada como `api_externa`. Se faltar dado ou coeficiente vigente,
  retorna pendência explícita em vez de inventar frete.

**Assistente**

- `POST /api/chat` — conversa que coleta os dados da operação e chama o
  motor de cálculo. Limitado a 12 requisições por minuto por IP.
- `GET /api/chat/status` — se o assistente está disponível e em que modo.

**Transporte (Transerve)**

- `GET /api/transerve/status` — a integração está configurada?
- `GET /api/transerve/ocorrencias` — rastreamento e canhoto por nota fiscal
- `POST /api/transerve/fretes` — solicita um frete, devolve o código

Sem credenciais configuradas, as rotas Transerve respondem `503` com
mensagem explícita.

## O assistente

O chat é o modo padrão da interface. Ele **não calcula nada por conta
própria** — coleta os dados conversando e chama exatamente o mesmo motor
que o formulário usa. Todo número financeiro na tela vem de
`calcular_operacao` ou `consultar_referencia_preco`, nunca do texto gerado.

Por trás dele há uma cadeia de três níveis: um provedor principal de IA,
um reserva que assume automaticamente se o primeiro falhar, e um extrator
determinístico por regras que funciona sem nenhuma IA e sem custo. Os
fornecedores são detalhe interno — a interface e a API não expõem quais
são, e trocá-los não quebra nada externo.

Quando cai no extrator local, ele segue a mesma regra do resto do sistema:
se não consegue identificar um campo com confiança, declara o que falta em
vez de adivinhar. Origem e destino são identificados pelo verbo ("compro
em X", "vendo em Y"), não pela ordem no texto.

## Validado com dados reais

Os cálculos do `tax_engine` e `deal_engine` foram conferidos contra a
operação real de soja Alto Taquari-MT → Rancharia-SP (50.000 sacas, compra
R$ 38, venda R$ 70) das planilhas de referência, e batem com os valores
originais linha a linha (ICMS, PIS, COFINS, FETHAB, SENAR, resultado
final). Esses números estão fixados em `tests/dealEngine.test.ts` — se
mudarem sem intenção, o teste quebra.

O frete é obrigatório para o cálculo valer. Operação sem `logistica` ou com
frete zerado é rejeitada na validação da API, e o piso mínimo ANTT, quando
aplicável, impede viabilidade se o frete informado ficar abaixo dele — um
número de margem calculado sobre frete inexistente seria enganoso, não
otimista.

## Exportacao de consultas

Todo resultado calculado pode ser exportado pelo frontend em tres formatos:

- PDF: abre um relatorio pronto para impressao. O usuario salva como PDF pelo navegador.
- Excel: baixa uma planilha `.xls` compativel com Excel e LibreOffice.
- CSV: baixa dados separados por ponto e virgula, bom para ERPs, TMS e planilhas.

Os arquivos usam apenas os valores que ja vieram do motor de calculo e preservam pendencias operacionais. No fluxo por formulario, tambem incluem os dados estruturados da operacao. No fluxo por chat, quando a operacao estruturada nao esta disponivel no frontend, exportam o resultado, memoria, frete, tributos, custos e pendencias.

## Regras tributárias de referência

As regras em `backend/src/engines/tax_engine/rules.seed.ts` foram extraídas
**literalmente** das duas planilhas fornecidas (uma operação de soja
MT→SP, uma de milho MT→MT). Elas representam uma operação específica em um
período específico — **não são uma tabela tributária validada
juridicamente**. Cada regra carrega `fonte: "planilha_referencia:..."`
exatamente para deixar isso rastreável.

**Pendência explícita antes de qualquer uso comercial:** validar essas
regras (alíquotas, fundos, benefícios fiscais como Prodeic-MT e TARE-GO)
com um especialista tributário/contábil. O `tax_engine` foi desenhado para
nunca inventar uma regra — quando não há cadastro para um cenário
(produto/origem/destino/tipo de operação), ele retorna uma pendência
explícita em vez de omitir o tributo silenciosamente.

## Licença dos dados de preço

Os dados da CEPEA/Esalq são licenciados sob **CC BY-NC 4.0** — atribuição
obrigatória e **uso não comercial**. O uso atual foi autorizado como
projeto de estudo. Se o LogPro virar produto comercial cobrando de
clientes, essa fonte precisa ser renegociada diretamente com a CEPEA antes
de continuar em uso. A atribuição visível na interface é exigência da
licença, não escolha estética.

## Piso mínimo ANTT e distância da rota

O piso mínimo (Lei 13.703/2018) usa os coeficientes da **Resolução ANTT
nº 6.084, de 16/07/2026** (Tabela A, granel sólido), versionados em
`backend/src/engines/freight_engine/piso_minimo/rules.seed.ts` — a versão
anterior ficou intacta e expirada, como manda a regra de nunca sobrescrever
regra vigente. Conforme a Resolução ANTT nº 6.076/2026, contam todos os
eixos, inclusive suspensos.

Quando a operação informa eixos mas não informa distância, o sistema tenta
calculá-la pela **rota rodoviária real** entre os municípios de origem e
destino, usando serviços públicos e gratuitos: geocodificação
[Nominatim](https://nominatim.openstreetmap.org) e roteirização
[OSRM](https://router.project-osrm.org), ambos sobre dados OpenStreetMap.
A distância calculada entra no resultado marcada como `api_externa` (nunca
se confunde com valor informado pelo usuário), com cache em memória para
respeitar o limite de uso dos serviços. Se a consulta falhar, o piso não é
verificado e a operação recebe pendência explícita — nunca uma distância
estimada.

Dados de geocodificação e rota: **© OpenStreetMap contributors**, licença
ODbL.

## O que foi deixado de fora de propósito

Marketplace público, match automático comprador↔vendedor, negociação na
plataforma, pagamento, escrow, contratação automática de frete, emissão
fiscal, integração direta com corretoras, e IA decidindo sem confirmação do
usuário. A arquitetura (adapters de frete, `tax_engine` versionado e
configurável) foi pensada para permitir essas evoluções sem reescrever o
motor de cálculo.

Das rotas da Transerve, foram implementadas apenas rastreamento e
solicitação de frete. Relatórios, viagens, CT-e e NF-e dependem de
contratação e liberação técnica específica — implementar antes disso seria
escrever código contra endpoints possivelmente indisponíveis.

## Próximos passos técnicos sugeridos

1. Validar as regras tributárias seed com um contador/especialista antes de
   qualquer uso com cliente real.
2. ~~Confirmar os coeficientes vigentes do piso mínimo ANTT~~ — **feito**:
   cadastrados os coeficientes da Resolução ANTT nº 6.084, de 16/07/2026
   (DOU de 17/07/2026), Tabela A, granel sólido, como regra versão 2. A ANTT
   reajusta os valores semestralmente (janeiro/julho) e por gatilho de
   diesel (±5%), então a regra v2 tem `vigenciaFim` e o sistema volta a
   retornar pendência explícita quando ela expirar — nunca calcula com
   coeficiente vencido. Renovar em janeiro/2027 (ou antes, se houver
   reajuste por diesel) cadastrando uma **nova versão**, sem editar a v2.
3. Cadastrar mais combinações de origem/destino/produto — hoje só há
   cobertura para os dois cenários das planilhas fornecidas; qualquer outra
   UF retorna pendência (comportamento esperado, não é bug).
4. Consolidar migrations versionadas do Postgres — hoje o schema é criado e
   atualizado por SQL idempotente no seed, sem histórico versionado de
   mudanças.
5. Obter as credenciais Transerve para ativar a integração de transporte.
