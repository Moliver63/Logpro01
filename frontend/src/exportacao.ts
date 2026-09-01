import type { OperacaoInput, ResultadoOperacao } from "./types";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

function nomeArquivo(extensao: string) {
  const agora = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `logpro-consulta-${agora}.${extensao}`;
}

function baixar(conteudo: string, tipo: string, arquivo: string) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = arquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function limparHtml(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function celula(valor: unknown): string {
  if (valor === undefined || valor === null || valor === "") return "";
  const texto = String(valor).replace(/"/g, '""');
  return `"${texto}"`;
}

function linhasRelatorio(resultado: ResultadoOperacao, operacao?: OperacaoInput) {
  const linhas: [string, string | number][] = [
    ["Status", resultado.calculoCompleto ? (resultado.viavel ? "Operação viável" : "Operação não viável") : "Cálculo incompleto"],
    ["Resultado", resultado.resultado.valor],
    ["Margem (%)", resultado.margemPercentual],
    ["Receita", resultado.receitaTotal.valor],
    ["Custo da mercadoria", resultado.custoMercadoria.valor],
    ["Frete", resultado.custoLogistico.valor],
    ["Tributos e fundos", resultado.custoTributario.valor],
    ["Comissões e outros custos", resultado.outrosCustos.valor],
    ["Custo total", resultado.custoTotal.valor],
    ["Resultado por saca", resultado.resultadoPorSaca],
    ["Resultado por tonelada", resultado.resultadoPorTonelada],
    ["Preço mínimo de venda por saca", resultado.precoMinimoVendaPorSaca],
    ["Frete por tonelada", resultado.frete.fretePorTonelada],
    ["Frete total", resultado.frete.freteTotal],
    ["Origem do frete", resultado.frete.origemDado],
    ["Provedor do frete", resultado.frete.provedor],
  ];

  if (operacao) {
    linhas.unshift(
      ["Produto", operacao.mercadoria.produto],
      ["Quantidade de sacas", operacao.mercadoria.quantidadeSacas],
      ["Peso por saca (kg)", operacao.mercadoria.pesoPorSacaKg],
      ["Compra por saca", operacao.compra.precoPorSaca],
      ["Venda por saca", operacao.venda.precoPorSaca],
      ["Origem", `${operacao.compra.municipioOrigem} - ${operacao.compra.estadoOrigem}`],
      ["Destino", `${operacao.venda.municipioDestino} - ${operacao.venda.estadoDestino}`],
    );
  }

  return linhas;
}

function secoesDetalhadas(resultado: ResultadoOperacao): [string, [string, string | number][]][] {
  return [
    [
      "Tributos",
      resultado.tributos.itens.length
        ? resultado.tributos.itens.flatMap((item) => [
            [`${item.tributo} - base`, item.base],
            [`${item.tributo} - alíquota (%)`, item.aliquotaPercentual ?? ""],
            [`${item.tributo} - valor`, item.valorComBeneficio],
            [`${item.tributo} - fonte`, item.fonte],
          ])
        : [["Tributos", "Nenhuma regra tributária aplicada"]],
    ],
    [
      "Custos adicionais",
      resultado.linhasCusto.length
        ? resultado.linhasCusto.flatMap((linha) => [
            [`${linha.descricao} por saca`, linha.valorPorSaca],
            [`${linha.descricao} total`, linha.valorTotal],
            [`${linha.descricao} origem`, linha.origem],
          ])
        : [["Custos adicionais", "Nenhum custo adicional informado"]],
    ],
    [
      "Pendências",
      resultado.pendenciasOperacionais.length
        ? resultado.pendenciasOperacionais.map((p, i) => [`Pendência ${i + 1}`, p])
        : [["Pendências", "Sem pendências operacionais"]],
    ],
  ];
}

function formatarValor(valor: string | number) {
  if (typeof valor !== "number") return valor;
  return Number.isFinite(valor) ? numero(valor) : "";
}

export function exportarCsv(resultado: ResultadoOperacao, operacao?: OperacaoInput) {
  const linhas = [
    ["Seção", "Campo", "Valor"],
    ...linhasRelatorio(resultado, operacao).map(([campo, valor]) => ["Resumo", campo, formatarValor(valor)]),
    ...secoesDetalhadas(resultado).flatMap(([secao, linhasSecao]) =>
      linhasSecao.map(([campo, valor]) => [secao, campo, formatarValor(valor)]),
    ),
  ];

  const csv = linhas.map((linha) => linha.map(celula).join(";")).join("\n");
  baixar(`\uFEFF${csv}`, "text/csv;charset=utf-8", nomeArquivo("csv"));
}

export function exportarExcel(resultado: ResultadoOperacao, operacao?: OperacaoInput) {
  const secoes = [
    ["Resumo", linhasRelatorio(resultado, operacao)] as const,
    ...secoesDetalhadas(resultado),
  ];

  const tabelas = secoes
    .map(
      ([titulo, linhas]) => `
        <h2>${limparHtml(titulo)}</h2>
        <table>
          <thead><tr><th>Campo</th><th>Valor</th></tr></thead>
          <tbody>
            ${linhas
              .map(([campo, valor]) => `<tr><td>${limparHtml(campo)}</td><td>${limparHtml(formatarValor(valor))}</td></tr>`)
              .join("")}
          </tbody>
        </table>
      `,
    )
    .join("");

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; }
          h1 { font-size: 18px; }
          h2 { font-size: 14px; margin-top: 18px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #DCE6F2; padding: 8px; text-align: left; }
          th { background: #F5F8FC; }
        </style>
      </head>
      <body><h1>LogPro</h1>${tabelas}</body>
    </html>
  `;

  baixar(html, "application/vnd.ms-excel;charset=utf-8", nomeArquivo("xls"));
}

export function abrirPdf(resultado: ResultadoOperacao, operacao?: OperacaoInput) {
  const linhas = linhasRelatorio(resultado, operacao);
  const pendencias = resultado.pendenciasOperacionais;
  const janela = window.open("", "_blank", "noopener,noreferrer");
  if (!janela) return;

  janela.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>LogPro</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; color: #0B1F3D; font-family: Arial, sans-serif; }
          main { padding: 32px; }
          h1 { margin: 0; font-size: 24px; }
          .meta { margin-top: 6px; color: #55708F; font-size: 12px; }
          .status { margin: 24px 0; padding: 16px; border: 1px solid #DCE6F2; background: #F5F8FC; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border-bottom: 1px solid #DCE6F2; padding: 9px 0; text-align: left; font-size: 12px; }
          th:last-child, td:last-child { text-align: right; }
          .money { font-family: Consolas, monospace; }
          ul { padding-left: 18px; }
          li { margin: 6px 0; font-size: 12px; }
          @media print { button { display: none; } main { padding: 20mm; } }
        </style>
      </head>
      <body>
        <main>
          <h1>LogPro</h1>
          <p class="meta">Consulta gerada em ${limparHtml(new Date().toLocaleString("pt-BR"))}</p>
          <div class="status">
            <strong>${limparHtml(resultado.calculoCompleto ? (resultado.viavel ? "Operação viável" : "Operação não viável") : "Cálculo incompleto")}</strong>
            <div class="meta">Resultado ${limparHtml(brl(resultado.resultado.valor))} · margem ${limparHtml(resultado.margemPercentual.toFixed(2))}%</div>
          </div>
          <table>
            <thead><tr><th>Campo</th><th>Valor</th></tr></thead>
            <tbody>
              ${linhas
                .map(([campo, valor]) => {
                  const exibido = typeof valor === "number" ? brl(valor) : String(valor);
                  return `<tr><td>${limparHtml(campo)}</td><td class="money">${limparHtml(exibido)}</td></tr>`;
                })
                .join("")}
            </tbody>
          </table>
          <h2>Pendências operacionais</h2>
          ${
            pendencias.length
              ? `<ul>${pendencias.map((p) => `<li>${limparHtml(p)}</li>`).join("")}</ul>`
              : "<p class=\"meta\">Sem pendências operacionais.</p>"
          }
          <button onclick="window.print()">Salvar como PDF</button>
        </main>
      </body>
    </html>
  `);
  janela.document.close();
  janela.focus();
}
