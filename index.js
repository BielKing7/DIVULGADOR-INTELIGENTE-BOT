require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { gerarArtePromocao } = require('./canvas');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot de Divulgação Shopee online! 🚀'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const usuariosState = {};

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `🤖 Bot de Divulgação Shopee ativo! Envie /poststory para começar.`);
});

bot.onText(/\/poststory/, (msg) => {
    usuariosState[msg.chat.id] = { step: 'POST_STORY' };
    bot.sendMessage(msg.chat.id, `📱 Envie o seu link de afiliado da Shopee:`);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;
    if (!usuariosState[chatId] || usuariosState[chatId].step !== 'POST_STORY') return;

    const linkAfiliado = text.trim();
    if (!linkAfiliado.startsWith('http')) {
        bot.sendMessage(chatId, `⚠️ Por favor, envie um link válido começando com http.`);
        return;
    }

    bot.sendMessage(chatId, `🔄 Analisando o link e gerando sua arte de divulgação...`);

    try {
        // Segue o redirecionamento do link curto da Shopee para capturar os dados reais do produto
        const resposta = await axios.get(linkAfiliado, {
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(resposta.data);

        // Extrai o título e a imagem oficial do produto através das meta tags da página
        const tituloProduto = $('meta[property="og:title"]').attr('content') || $('title').text() || "Oferta Imperdível na Shopee";
        const imagemUrl = $('meta[property="og:image"]').attr('content');

        if (!imagemUrl) {
            throw new Error('Não foi possível localizar a imagem do produto neste link.');
        }

        // Gera a arte fixa com o título e a foto capturados
        const bufferArte = await gerarArtePromocao({
            title: tituloProduto,
            precoAtual: "Imperdível",
            imageUrl: imagemUrl
        });

        let captionTexto = `🛍️ *${tituloProduto}*\n\n`;
        captionTexto += `🛒 Compre aqui 👉 ${linkAfiliado}\n\n`;
        captionTexto += `⚠️ *Promoção sujeita à alteração de preço e estoque do site*`;

        await bot.sendPhoto(chatId, bufferArte, {
            caption: captionTexto,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📱 Abrir Link', url: linkAfiliado }]
                ]
            }
        });

        delete usuariosState[chatId];

    } catch (error) {
        console.error("Erro ao processar o link:", error.message);
        bot.sendMessage(chatId, `❌ Erro ao extrair os dados do produto. Certifique-se de enviar um link direto de produto da Shopee.`);
    }
});
