require("dotenv").config();

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const { obterProdutoShopee } = require("./shopee");
const { gerarArte } = require("./canvas");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_ID = process.env.SHOPEE_APP_ID;
const APP_SECRET = process.env.SHOPEE_SECRET;

if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
}

if (!APP_ID) {
    throw new Error("SHOPEE_APP_ID não configurado.");
}

if (!APP_SECRET) {
    throw new Error("SHOPEE_SECRET não configurado.");
}

const bot = new TelegramBot(BOT_TOKEN, {
    polling: true
});

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {

    res.send("🤖 Divulgador Inteligente Bot Online!");

});

app.listen(PORT, () => {

    console.log(`Servidor iniciado na porta ${PORT}`);

});

const usuarios = {};

bot.onText(/\/start/, async (msg) => {

    const chatId = msg.chat.id;

    await bot.sendMessage(

        chatId,

`👋 Olá!

Eu sou o *Divulgador Inteligente Bot*.

Comigo você pode transformar um link de afiliado da Shopee em uma arte pronta para publicar nos Stories do Instagram.

📌 Como usar:

1️⃣ Digite:
/story

2️⃣ Envie o link do produto da Shopee.

3️⃣ Aguarde alguns segundos.

✨ Eu enviarei a arte pronta automaticamente.`,

        {

            parse_mode: "Markdown"

        }

    );

});

bot.onText(/\/story/, async (msg) => {

    const chatId = msg.chat.id;

    usuarios[chatId] = {

        aguardandoLink: true

    };

    await bot.sendMessage(

        chatId,

        "🔗 Agora envie o link do produto da Shopee."

    );

});

bot.on("message", async (msg) => {

    const chatId = msg.chat.id;

    if (!msg.text) return;

    if (msg.text.startsWith("/")) return;

    if (!usuarios[chatId]) return;

    if (!usuarios[chatId].aguardandoLink) return;

    const link = msg.text.trim();

    usuarios[chatId].aguardandoLink = false;

    if (
        !link.startsWith("https://") &&
        !link.startsWith("http://")
    ) {

        usuarios[chatId].aguardandoLink = true;

        return bot.sendMessage(

            chatId,

            "❌ Envie um link válido da Shopee."

        );

    }

    let mensagemProcessando;

    try {

        mensagemProcessando = await bot.sendMessage(

            chatId,

            "🔄 Buscando informações do produto..."

        );

        const produto = await obterProdutoShopee(

            link,

            APP_ID,

            APP_SECRET

        );

        await bot.editMessageText(

            "🎨 Gerando a arte...",

            {

                chat_id: chatId,

                message_id: mensagemProcessando.message_id

            }

        );

        const imagem = await gerarArte(produto);

        await bot.deleteMessage(

            chatId,

            mensagemProcessando.message_id

        );

        await bot.sendPhoto(

            chatId,

            imagem,

            {

                caption:

`✅ Arte gerada com sucesso!

📦 ${produto.titulo}

💰 ${produto.preco}

🔗 ${produto.linkAfiliado}`

            }

        );

        delete usuarios[chatId];

    } catch (erro) {

        console.error(erro);

        if (mensagemProcessando) {

            try {

                await bot.deleteMessage(

                    chatId,

                    mensagemProcessando.message_id

                );

            } catch (_) {}

        }

        delete usuarios[chatId];

        await bot.sendMessage(

            chatId,

            "❌ Ocorreu um erro ao gerar a arte.\n\nVerifique se o link é válido e tente novamente."

        );

    }

});

bot.on("polling_error", (erro) => {

    console.error("Polling Error:", erro.message);

});

process.on("unhandledRejection", (erro) => {

    console.error("Unhandled Rejection:", erro);

});

process.on("uncaughtException", (erro) => {

    console.error("Uncaught Exception:", erro);

});

console.log("========================================");
console.log("🤖 Divulgador Inteligente Bot");
console.log("========================================");
console.log("✅ Bot do Telegram iniciado.");
console.log("✅ API Oficial da Shopee conectada.");
console.log("✅ Canvas carregado.");
console.log("✅ Servidor Express iniciado.");
console.log("========================================");
