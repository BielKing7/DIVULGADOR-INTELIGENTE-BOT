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

// Comando /start liberado direto sem cadastro
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    usuariosState[chatId] = { step: 'AUTENTICADO' };
    
    bot.sendMessage(chatId, 
        `Bem-vindo ao 🤖 Divulgador Inteligente Bot 🛍️!\n\nModo de teste rápido ativado. Envie /poststory para começar a criar suas publicações! 🚀`
    );
});

// Comando para ativar o modo de postagem
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
    bot.sendMessage(chatId, `✅ Seu link foi adicionado à fila de geração de Posts! Por favor, aguarde alguns instantes 👊`);

    try {
        let tituloProduto = "Fone de Ouvido Bluetooth Sem Fio J760";
        let precoAtual = "R$ 40,26";
        let precoAntigo = "R$ 72,00";
        let imagemUrl = "https://images.tcdn.com.br/img/img_prod/805128/fone_de_ouvido_bluetooth_jbl_tune_510bt_preto_1381_1_20220610111151.jpg";

        try {
            const { data } = await axios.get(linkAfiliado, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                maxRedirects: 5
            });
            const $ = cheerio.load(data);
            
            const ogTitle = $('meta[property="og:title"]').attr('content');
            const ogImage = $('meta[property="og:image"]').attr('content');

            if (ogTitle) tituloProduto = ogTitle;
            if (ogImage) imagemUrl = ogImage;
        } catch (err) {
            console.log("Aviso: Usando dados padrão para o produto.");
        }

        const bufferArte = gerarArtePromocao({
            title: tituloProduto,
            precoAtual: precoAtual,
            precoAntigo: precoAntigo,
            imageUrl: imagemUrl
        });

        await bot.sendPhoto(chatId, bufferArte, {
            caption: `🛍️ *${tituloProduto}*\n\n~De ${precoAntigo}~\n💥 *Por ${precoAtual}*\n\n🛒 Compre aqui 👉 ${linkAfiliado}\n\n⚠️ *Promoção sujeita à alteração de preço e estoque do site*`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📢 Publicar no site', callback_data: 'publicar_site' }],
                    [{ text: '📱 Abrir WhatsApp', url: linkAfiliado }]
                ]
            }
        });

    } catch (error) {
        console.error("Erro ao processar produto:", error);
        bot.sendMessage(chatId, `❌ Erro ao gerar a arte do produto. Verifique o link e tente novamente.`);
    }
});
