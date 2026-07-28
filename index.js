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
    bot.sendMessage(msg.chat.id, `📱 Envie o link curto ou termo de busca da Shopee:`);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;
    if (!usuariosState[chatId] || usuariosState[chatId].step !== 'POST_STORY') return;

    const termoBusca = text.includes('http') ? "Oferta Shopee" : text;
    const linkAfiliadoOriginal = text.includes('http') ? text : "https://shopee.com.br";

    bot.sendMessage(chatId, `🔄 Buscando dados oficiais na API da Shopee, aguarde...`);

    try {
        const graphqlQuery = {
            query: `
                query {
                    shopeeOfferV2(keyword: "${termoBusca}", limit: 1) {
                        nodes {
                            offerName
                            imageUrl
                            offerLink
                        }
                    }
                }
            `
        };

        console.log("Enviando requisição para Shopee com AppId:", process.env.SHOPEE_APP_ID);

        const respostaApi = await axios.post('https://open-api.affiliate.shopee.com.br/graphql', graphqlQuery, {
            headers: {
                'Content-Type': 'application/json',
                'AppId': process.env.SHOPEE_APP_ID,
                'Authorization': `Bearer ${process.env.SHOPEE_SECRET}`
            }
        });

        console.log("Resposta bruta da Shopee:", JSON.stringify(respostaApi.data));

        const dadosProduto = respostaApi.data?.data?.shopeeOfferV2?.nodes?.[0];

        if (!dadosProduto) {
            throw new Error('Nenhum produto retornado pela API.');
        }

        const tituloProduto = dadosProduto.offerName || "Produto em Promoção";
        const imagemUrl = dadosProduto.imageUrl;
        const linkFinal = text.includes('http') ? text : (dadosProduto.offerLink || linkAfiliadoOriginal);

        const bufferArte = await gerarArtePromocao({
            title: tituloProduto,
            precoAtual: "Imperdível",
            imageUrl: imagemUrl
        });

        let captionTexto = `🛍️ *${tituloProduto}*\n\n`;
        captionTexto += `🛒 Compre aqui 👉 ${linkFinal}\n\n`;
        captionTexto += `⚠️ *Promoção sujeita à alteração de preço e estoque do site*`;

        await bot.sendPhoto(chatId, bufferArte, {
            caption: captionTexto,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📱 Abrir Link', url: linkFinal }]
                ]
            }
        });

    } catch (error) {
        console.error("ERRO DETALHADO NA API:", error.response?.data || error.message);
        bot.sendMessage(chatId, `❌ Erro: ${error.message}`);
    }
});
