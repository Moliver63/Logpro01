import type { Config } from "tailwindcss";

/**
 * Sistema de tokens do LogPro.
 *
 * Direção: painel de operação de terminal graneleiro, não "app de fintech".
 * Paleta ancorada em grão e caderno de bordo, não no cliché cream+terracota:
 *   - "silo"   #1B2420  quase-preto esverdeado — fundo profundo, evoca silo/armazém à noite
 *   - "ledger" #F1EFE6  papel de caderno de bordo — fundo claro, levemente amarelado, não creme quente
 *   - "grao"   #C9A24B  âmbar de grão maduro — accent primário, usado com moderação
 *   - "soja"   #4B6350  verde soja/mato — accent secundário, status positivo
 *   - "alerta" #B4472A  terracota queimado escuro — reservado a "NÃO VIÁVEL" / erro, nunca decorativo
 *   - "tinta"  #232823  texto principal sobre papel
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        silo: "#1B2420",
        ledger: "#F1EFE6",
        ledgerLine: "#DAD5C2",
        grao: "#C9A24B",
        graoDark: "#9C7A32",
        soja: "#4B6350",
        sojaDark: "#374A3B",
        alerta: "#B4472A",
        tinta: "#232823",
        tintaSuave: "#5B6459",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        card: "2px",
      },
    },
  },
  plugins: [],
} satisfies Config;
