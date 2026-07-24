require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const puppeteer = require('puppeteer');
const { gerarArtePromocao } = require('./canvas');

// --- CONFIGURAÇÃO DO FIREBASE ADMIN ---
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();
// -------------------------------------

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
    bot.sendMessage(chatId, `🤖 Bot pronto! Envie /poststory para começar.`);
});

bot.onText(/\/poststory/, (msg) => {
    const chatId = msg.chat.id;
    usuariosState[chatId] = { step: 'POST_STORY' };
    bot.sendMessage(chatId, `📱 Envie o seu link curto de afiliado da Shopee agora:`);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    const estado = usuariosState[chatId];
    if (!estado || estado.step !== 'POST_STORY') return;

    if (!text.startsWith('http')) {
        bot.sendMessage(chatId, `⚠️ Por favor, envie um link válido.`);
        return;
    }

    const linkAfiliado = text;
    bot.sendMessage(chatId, `🔄 Buscando imagem e preço reais do produto na Shopee, aguarde...`);

    let tituloProduto = "Kit Café Manhã Chaleira Elétrica + Sanduicheira";
    let precoAtual = "R$ 139,90";
    let imagemUrl = "";

    let browser = null;
    try {
        // Abre um navegador invisível para burlar a segurança da Shopee e ler o link curto
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // Acessa o link curto e aguarda a página carregar
        await page.goto(linkAfiliado, { waitUntil: 'networkidle2', timeout: 30000 });

        // Extrai as meta tags oficiais da página final da Shopee
        const dadosPagina = await page.evaluate(() => {
            const titleMeta = document.querySelector('meta[property="og:title"]');
            const imageMeta = document.querySelector('meta[property="og:image"]');
            const descMeta = document.querySelector('meta[property="og:description"]');

            return {
                title: titleMeta ? titleMeta.content : null,
                image: imageMeta ? imageMeta.content : null,
                desc: descMeta ? descMeta.content : null
            };
        });

        if (dadosPagina.title) {
            tituloProduto = dadosPagina.title.replace(' | Shopee Brasil', '').trim();
        }
        if (dadosPagina.image) {
            imagemUrl = dadosPagina.image;
        }
        if (dadosPagina.desc) {
            const matchPreco = dadosPagina.desc.match(/R\$\s?[\d.,]+/);
            if (matchPreco) {
                precoAtual = matchPreco[0];
            }
        }

    } catch (err) {
        console.error("Erro no Puppeteer:", err);
    } finally {
        if (browser) {
            await browser.close();
        }
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
                    [{ text: '📢 Publicar no site', callback_data: 'publicar_site' }],
                    [{ text: '📱 Abrir Link', url: linkAfiliado }]
                ]
            }
        });

    } catch (error) {
        console.error("Erro ao gerar arte:", error);
        bot.sendMessage(chatId, `❌ Erro ao gerar a arte.`);
    }
});
