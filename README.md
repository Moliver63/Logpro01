# LogPro — MVP

Motor de viabilidade de operações de grãos. Responde a uma pergunta:
**"essa operação fecha ou não fecha?"** — e qual combinação de preço, frete
e tributos gera a melhor margem.

Construído seguindo o prompt de especificação `LOGPRO MVP | MOTOR DE
VIABILIDADE DE OPERAÇÕES DE GRÃOS`: sem marketplace, sem match automático,
sem negociação dentro da plataforma nesta fase — só o motor de cálculo.

## Estrutura

```
logpro/
  backend/    Node + Express + TypeScript + Drizzle + SQLite
    src/engines/tax_engine/     motor tributário — nunca inventa regra
    src/engines/freight_engine/ motor de frete — adapters/providers
    src/engines/deal_engine/    motor de viabilidade — junta os dois acima
    src/db/                     schema, seed, client
    src/routes/                 API REST
  frontend/   React + Vite + TypeScript + Tailwind
    src/components/OperationForm/  formulário em 5 blocos
    src/components/ResultDashboard.tsx
    src/components/CalculationMemory.tsx  "ver memória de cálculo"
    src/components/ScenarioSimulator.tsx
```

## Como rodar localmente

**Backend**

```bash
cd backend
npm install
npm run seed    # cria o banco SQLite local e carrega as regras tributárias de referência
npm run dev     # http://localhost:3333
```

**Frontend** (em outro terminal)

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173 — proxy de /api para o backend
```

Abra `http://localhost:5173`.

## O que já funciona (validado com dados reais)

Os cálculos do `tax_engine` e `deal_engine` foram conferidos contra a
operação real de soja Alto Taquari-MT → Rancharia-SP (50.000 sacas, compra
R$ 38, venda R$ 70) das planilhas de referência, e batem com os valores
originais linha a linha (ICMS, PIS, COFINS, FETHAB, SENAR, resultado final).

- `POST /api/operations/calcular` — calcula viabilidade de uma operação
- `POST /api/operations/simular` — compara até 10 cenários e aponta o melhor
- `GET /api/tax-rules` — lista as regras tributárias cadastradas

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

## O que foi deixado de fora de propósito (fase 2+)

Por instrução explícita da especificação (item 14): marketplace público,
match automático comprador↔vendedor, chat, negociação na plataforma,
pagamento, escrow, contratação automática de frete, emissão fiscal,
integração direta com corretoras, e IA decidindo sem confirmação do
usuário. A arquitetura (adapters de frete, tax_engine versionado e
configurável) foi pensada para permitir essas evoluções sem reescrever o
motor de cálculo.

## Próximos passos técnicos sugeridos

1. Validar as regras tributárias seed com um contador/especialista antes de
   qualquer uso com cliente real.
2. Cadastrar mais combinações de origem/destino/produto — hoje só há
   cobertura para os dois cenários das planilhas fornecidas; qualquer outra
   UF retorna pendência (comportamento esperado, não é bug).
3. Trocar o SQLite local por Postgres (o schema em Drizzle já é quase
   idêntico entre `sqlite-core` e `pg-core`) quando for para produção,
   seguindo a mesma linha de infraestrutura da MecProAI (Render.com).
4. Plugar um `FreightProvider` real (ex: Sapiens Agro) implementando a
   interface já definida em `freight_engine`, sem tocar no `deal_engine`.
