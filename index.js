require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { gerarArtePromocao } = require('./canvas');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Servidor Express para manter o Render ativo
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot de Afiliados Shopee (API Oficial) online! 🚀'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const usuariosState = {};

// Função oficial de assinatura baseada estritamente na documentação da Shopee (HMAC-SHA256)
function gerarAssinaturaShopee(appId, secret, timestamp, payloadString) {
    const factor = `${appId}${timestamp}${payloadString}${secret}`;
    return crypto.createHash('sha256').update(factor).digest('hex');
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `🤖 Bot Oficial da Shopee configurado! Envie /poststory para começar.`);
});

bot.onText(/\/poststory/, (msg) => {
    usuariosState[msg.chat.id] = { step: 'POST_STORY' };
    bot.sendMessage(msg.chat.id, `📱 Envie o nome ou o termo do produto que deseja buscar na Shopee para gerar a divulgação:`);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;
    if (!usuariosState[chatId] || usuariosState[chatId].step !== 'POST_STORY') return;

    const termoBusca = text.trim();
    bot.sendMessage(chatId, `🔄 Conectando à API Oficial da Shopee e gerando sua arte...`);

    try {
        const appId = process.env.SHOPEE_APP_ID;
        const secret = process.env.SHOPEE_SECRET;
        const timestamp = Math.floor(Date.now() / 1000);

        // Query GraphQL oficial para busca de ofertas (Get Product Offer List - shopeeOfferV2)
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

        // Cabeçalho de autorização oficial exigido pela plataforma de Afiliados
        const authHeader = `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;

        const respostaApi = await axios.post('https://open-api.affiliate.shopee.com.br/graphql', graphqlQuery, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            }
        });

        const dadosProduto = respostaApi.data?.data?.shopeeOfferV2?.nodes?.[0];

        if (!dadosProduto) {
            throw new Error('Nenhum produto retornado pela API da Shopee.');
        }

        const tituloProduto = dadosProduto.offerName;
        const imagemUrl = dadosProduto.imageUrl;
        const linkAfiliado = dadosProduto.offerLink;

        // Gera a arte fixa combinando os dados da API
        const bufferArte = await gerarArtePromocao({
            title: tituloProduto,
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
        console.error("Erro na API da Shopee:", error.response?.data || error.message);
        bot.sendMessage(chatId, `❌ Erro ao consultar a API Oficial da Shopee. Verifique suas credenciais no Render.`);
    }
});
