require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { gerarArtePromocao } = require('./canvas');

// --- CONFIGURAÇÃO DO FIREBASE ADMIN (VIA VARIÁVEL DE AMBIENTE) ---
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();
// -----------------------------------------------------------------

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Divulgador Inteligente Bot está online! 🚀'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const usuariosState = {};

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    usuariosState[chatId] = { step: 'AUTENTICADO' };
    
    bot.sendMessage(chatId, 
        `Bem-vindo ao 🤖 Divulgador Inteligente Bot 🛍️!\n\nModo de teste rápido ativado. Envie /poststory para começar a criar suas publicações! 🚀`
    );
});

bot.onText(/\/poststory/, (msg) => {
    const chatId = msg.chat.id;
    usuariosState[chatId] = { step: 'POST_STORY' };
    
    bot.sendMessage(chatId, `🔄 Ativando o modo combinado de Post e Story! 📝📱✨\n\nAgora envie o seu link de afiliado para gerarmos a publicação.`);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    const estado = usuariosState[chatId];
    if (!estado || estado.step !== 'POST_STORY') {
        bot.sendMessage(chatId, `Envie /start para iniciar ou /poststory para gerar uma arte.`);
        return;
    }

    if (!text.startsWith('http')) {
        bot.sendMessage(chatId, `⚠️ Por favor, envie um link válido.`);
        return;
    }

    const linkAfiliado = text;
    bot.sendMessage(chatId, `✅ Seu link foi adicionado à fila de geração de Posts! Por favor, aguarde alguns instantes 📱`);

    try {
        let tituloProduto = "Produto em Promoção";
        let precoAtual = "Confira no site";
        let precoAntigo = "";
        let imagemUrl = "";

        try {
            // Requisição com suporte a redirecionamento para capturar o link final da Shopee
            const response = await axios.get(linkAfiliado, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
                },
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 400; // Aceita redirecionamentos
                }
            });

            const $ = cheerio.load(response.data);
            
            // Pega as meta tags OpenGraph que a Shopee utiliza para compartilhamento
            const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text();
            const ogImage = $('meta[property="og:image"]').attr('content');
            const ogDescription = $('meta[property="og:description"]').attr('content');

            if (ogTitle) {
                tituloProduto = ogTitle.replace(' | Shopee Brasil', '').trim();
            }

            if (ogImage) {
                imagemUrl = ogImage;
            }

            // Tenta extrair algum indicativo de preço se houver na descrição ou título
            if (ogDescription) {
                const matchPreco = ogDescription.match(/R\$\s?[\d.,]+/);
                if (matchPreco) {
                    precoAtual = matchPreco[0];
                }
            }

        } catch (err) {
            console.log("Aviso ao raspar link, usando fallback dinâmico:", err.message);
        }

        // Se por acaso a imagem não veio da meta tag, tenta puxar do preview que o próprio Telegram gerou na mensagem do usuário
        if (!imagemUrl && msg.photo && msg.photo.length > 0) {
            // Caso o usuário mande foto com legenda
            const photoObj = msg.photo[msg.photo.length - 1];
            const fileLink = await bot.getFileLink(photoObj.file_id);
            imagemUrl = fileLink;
        }

        const bufferArte = await gerarArtePromocao({
            title: tituloProduto,
            precoAtual: precoAtual,
            precoAntigo: precoAntigo,
            imageUrl: imagemUrl
        });

        let captionTexto = `🛍️ *${tituloProduto}*\n\n`;
        if (precoAntigo) captionTexto += `~De ${precoAntigo}~\n`;
        captionTexto += `💥 *Por ${precoAtual}*\n\n`;
        captionTexto += `🛒 Compre aqui 👉 ${linkAfiliado}\n\n`;
        captionTexto += `⚠️ *Promoção sujeita à alteração de preço e estoque do site*`;

        await bot.sendPhoto(chatId, bufferArte, {
            caption: captionTexto,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📢 Publicar no site', callback_data: 'publicar_site' }],
                    [{ text: '📱 Abrir Link', url: linkAfiliado }]
                ]
            }
        });

    } catch (error) {
        console.error("Erro crítico ao processar produto:", error);
        bot.sendMessage(chatId, `❌ Erro ao gerar a arte do produto. Verifique o link e tente novamente.`);
    }
});
