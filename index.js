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
app.get('/', (req, res) => res.send('Bot da Shopee online! 🚀'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const usuariosState = {};

// Função oficial para gerar a assinatura HMAC/SHA256 exigida pela Shopee
function gerarAssinaturaShopee(appId, secret, timestamp, payloadString) {
    const baseString = `${appId}${timestamp}${payloadString}${secret}`;
    return crypto.createHash('sha256').update(baseString).digest('hex');
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `🤖 Bot de Divulgação Shopee ativo! Envie /poststory para começar.`);
});

bot.onText(/\/poststory/, (msg) => {
    usuariosState[msg.chat.id] = { step: 'POST_STORY' };
    bot.sendMessage(msg.chat.id, `📱 Envie o link do produto ou o nome/termo de busca da Shopee:`);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;
    if (!usuariosState[chatId] || usuariosState[chatId].step !== 'POST_STORY') return;

    const entradaUsuario = text.trim();
    bot.sendMessage(chatId, `🔄 Processando link e consultando a API da Shopee com segurança...`);

    try {
        const appId = process.env.SHOPEE_APP_ID;
        const secret = process.env.SHOPEE_SECRET;
        const timestamp = Math.floor(Date.now() / 1000);

        // Se o usuário mandou um link, podemos usar uma palavra-chave genérica ou o link na query conforme suportado
        const termoBusca = entradaUsuario.includes('http') ? "Oferta" : entradaUsuario;

        // Estrutura da Query GraphQL oficial da Shopee Affiliates
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

        // Requisição oficial autenticada para a API da Shopee
        const respostaApi = await axios.post('https://open-api.affiliate.shopee.com.br/graphql', graphqlQuery, {
            headers: {
                'Content-Type': 'application/json',
                'AppId': appId,
                'Time': timestamp.toString(),
                'Authorization': `SHA256Credential ${signature}`
            }
        });

        const dadosProduto = respostaApi.data?.data?.shopeeOfferV2?.nodes?.[0];

        if (!dadosProduto) {
            throw new Error('Nenhum produto retornado pela API.');
        }

        const tituloProduto = dadosProduto.offerName || "Produto Imperdível";
        const imagemUrl = dadosProduto.imageUrl;
        const linkFinal = entradaUsuario.includes('http') ? entradaUsuario : (dadosProduto.offerLink || "https://shopee.com.br");

        // Gera a arte fixa com os dados oficiais obtidos da API
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

        delete usuariosState[chatId];

    } catch (error) {
        console.error("Erro na API da Shopee:", error.response?.data || error.message);
        bot.sendMessage(chatId, `❌ Erro ao consultar a API da Shopee. Verifique suas credenciais nas variáveis de ambiente.`);
    }
});
