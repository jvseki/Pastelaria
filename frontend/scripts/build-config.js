/**
 * Injeta API_URL do Vercel no config.js no momento do deploy.
 * Local: não altera nada (usa o valor já no config.js).
 */
const fs = require("fs");
const path = require("path");

const apiUrl = (process.env.API_URL || "").trim().replace(/\/$/, "");
const configPath = path.join(__dirname, "..", "js", "config.js");

if (!apiUrl) {
    console.warn(
        "[build-config] API_URL não definida no Vercel — usando config.js do repositório."
    );
    process.exit(0);
}

let content = fs.readFileSync(configPath, "utf8");
const replacement = `window.API_URL = isLocal
        ? "http://localhost:8000"
        : "${apiUrl}";`;

if (!content.includes("window.API_URL = isLocal")) {
    console.error("[build-config] config.js não tem o padrão esperado de API_URL.");
    process.exit(1);
}

content = content.replace(
    /window\.API_URL = isLocal[\s\S]*?;/,
    replacement
);

fs.writeFileSync(configPath, content);
console.log("[build-config] API_URL de produção:", apiUrl);
