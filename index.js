require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { gerarArtePromocao } = require('./canvas');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot com API Shopee online! 🚀'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const usuariosState = {};

// Função para gerar a assinatura correta exigida pela Open API da Shopee
function gerarAssinaturaShopee(appId, secret, timestamp, payload) {
    const baseString = `${appId}${timestamp}${payload}${secret}`;
    return crypto.createHash('sha256').update(baseString).digest('hex');
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `🤖 Bot com API Oficial da Shopee ativo! Envie /poststory para começar.`);
});

bot.onText(/\/poststory/, (msg) => {
    usuariosState[msg.chat.id] = { step: 'POST_STORY' };
    bot.sendMessage(msg.chat.id, `📱 Envie o termo de busca ou palavra-chave do produto na Shopee:`);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;
    if (!usuariosState[chatId] || usuariosState[chatId].step !== 'POST_STORY') return;

    const termoBusca = text;
    bot.sendMessage(chatId, `🔄 Consultando a API Oficial da Shopee com assinatura segura, aguarde...`);

    try {
        const appId = process.env.SHOPEE_APP_ID;
        const secret = process.env.SHOPEE_SECRET;
        const timestamp = Math.floor(Date.now() / 1000);

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

        const payloadString = JSON.stringify(graphqlQuery);
        const signature = gerarAssinaturaShopee(appId, secret, timestamp, payloadString);

        const respostaApi = await axios.post('https://open-api.affiliate.shopee.com.br/graphql', graphqlQuery, {
            headers: {
                'Content-Type': 'application/json',
                'AppId': appId,
                'Time': timestamp.toString(),
                'Authorization': `SHA256Credential ${signature}`
            }
        });

        console.log("Resposta da Shopee:", JSON.stringify(respostaApi.data));

        const dadosProduto = respostaApi.data?.data?.shopeeOfferV2?.nodes?.[0];

        if (!dadosProduto) {
            throw new Error('Nenhum produto encontrado com esse termo.');
        }

        const tituloProduto = dadosProduto.offerName;
        const imagemUrl = dadosProduto.imageUrl;
        const linkFinal = dadosProduto.offerLink;

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
        console.error("ERRO DETALHADO:", error.response?.data || error.message);
        bot.sendMessage(chatId, `❌ Erro ao consultar a API com assinatura.`);
    }
});
