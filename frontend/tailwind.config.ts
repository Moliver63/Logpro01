import type { Config } from "tailwindcss";

/**
 * Sistema de tokens do LogPro — extraído da logo oficial (caminhão + Z de
 * velocidade + wordmark "LogPro").
 *
 *   navy      #0B1F3D  navy profundo da cabine do caminhão — fundo do header, texto principal
 *   navySoft  #16305A  navy um tom mais claro — cards escuros, hover
 *   azul      #004CF7  azul elétrico do meio do "Z" e do "Pro" — accent primário, botões
 *   ciano     #02D5FD  ciano do topo do "Z" — destaque, gradientes, links
 *   papel     #F5F8FC  branco levemente azulado — fundo claro da aplicação
 *   borda     #DCE6F2  linhas e bordas sobre o papel
 *   tintaSuave #55708F texto secundário sobre o papel
 *   sucesso   #16A34A  operação viável — mantido verde para não colidir com o azul da marca
 *   risco     #DC2626  operação não viável / erro
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0B1F3D",
        navySoft: "#16305A",
        azul: "#004CF7",
        azulDark: "#0039BD",
        ciano: "#02D5FD",
        papel: "#F5F8FC",
        papelCard: "#FFFFFF",
        borda: "#DCE6F2",
        tinta: "#0B1F3D",
        tintaSuave: "#55708F",
        sucesso: "#16A34A",
        sucessoDark: "#15803D",
        risco: "#DC2626",
        aviso: "#D97706",
      },
      fontFamily: {
        display: ["'Manrope'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #02D5FD 0%, #004CF7 100%)",
        "surface-gradient": "linear-gradient(180deg, #F8FBFF 0%, #EEF5FC 100%)",
      },
      borderRadius: {
        card: "8px",
      },
    },
  },
  plugins: [],
} satisfies Config;
