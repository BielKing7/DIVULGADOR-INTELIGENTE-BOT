require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { gerarArtePromocao } = require('./canvas');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot com API Shopee online! 🚀'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const usuariosState = {};

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `🤖 Bot com API Oficial da Shopee ativo! Envie /poststory para começar.`);
});

bot.onText(/\/poststory/, (msg) => {
    usuariosState[msg.chat.id] = { step: 'POST_STORY' };
    bot.sendMessage(msg.chat.id, `📱 Envie o link curto de afiliado da Shopee:`);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;
    if (!usuariosState[chatId] || usuariosState[chatId].step !== 'POST_STORY') return;

    if (!text.startsWith('http')) {
        bot.sendMessage(msg.chat.id, `⚠️ Envie um link válido da Shopee.`);
        return;
    }

    const linkAfiliado = text;
    bot.sendMessage(chatId, `🔄 Consultando dados oficiais na API da Shopee, aguarde...`);

    let tituloProduto = "";
    let precoAtual = "";
    let imagemUrl = "";

    try {
        const graphqlQuery = {
            query: `
                query getProductDetails($url: String!) {
                    productDetails(shortUrl: $url) {
                        title
                        price
                        imageUrl
                    }
                }
            `,
            variables: { url: linkAfiliado }
        };

        const respostaApi = await axios.post('https://open-api.affiliate.shopee.com.br/graphql', graphqlQuery, {
            headers: {
                'Content-Type': 'application/json',
                'AppId': process.env.SHOPEE_APP_ID,
                'Authorization': `Bearer ${process.env.SHOPEE_SECRET}`
            }
        });

        const dados = respostaApi.data?.data?.productDetails;

        if (dados) {
            tituloProduto = dados.title;
            precoAtual = `R$ ${dados.price}`;
            imagemUrl = dados.imageUrl;
        } else {
            throw new Error('Dados não retornados pela API.');
        }

    } catch (error) {
        console.error("Erro na API da Shopee:", error.message);
        bot.sendMessage(chatId, `❌ Não foi possível puxar os dados automaticamente por este link.`);
        return;
    }

    try {
        const bufferArte = await gerarArtePromocao({
            title: tituloProduto,
            precoAtual: precoAtual,
            imageUrl: imagemUrl
        });

        let captionTexto = `🛍️ *${tituloProduto}*\n\n`;
        captionTexto += `💥 *Por ${precoAtual}*\n\n`;
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

    } catch (err) {
        console.error("Erro ao gerar arte com canvas:", err);
        bot.sendMessage(chatId, `❌ Erro ao desenhar a arte do story.`);
    }
});
