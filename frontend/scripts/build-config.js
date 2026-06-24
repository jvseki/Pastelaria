/**
 * Deploy Vercel: exige API_URL (URL do Web Service no Render).
 * Cria proxy /api → Render (evita CORS no navegador).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const apiUrl = (process.env.API_URL || "").trim().replace(/\/$/, "");

if (!apiUrl) {
    console.error("");
    console.error("ERRO: API_URL nao definida na Vercel.");
    console.error("");
    console.error("1. Render → servico Pastelaria → copie a URL no topo");
    console.error("   Exemplo: https://pastelaria.onrender.com");
    console.error("2. Vercel → Settings → Environment Variables");
    console.error("   Nome: API_URL  |  Valor: URL do Render (sem barra no final)");
    console.error("3. Redeploy");
    console.error("");
    process.exit(1);
}

const vercelConfig = {
    framework: null,
    buildCommand: "node scripts/build-config.js",
    outputDirectory: ".",
    rewrites: [
        { source: "/favicon.ico", destination: "/favicon.svg" },
        { source: "/api/:path*", destination: `${apiUrl}/:path*` },
    ],
};

fs.writeFileSync(
    path.join(root, "vercel.json"),
    JSON.stringify(vercelConfig, null, 2) + "\n"
);

console.log("[build-config] Proxy /api ->", apiUrl);
