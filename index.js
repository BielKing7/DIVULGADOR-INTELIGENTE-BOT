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
    bot.sendMessage(chatId, `🤖 Bot online! Envie /poststory para começar.`);
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
    bot.sendMessage(chatId, `🔄 Rastreando link da Shopee e capturando imagem do produto, aguarde...`);

    let tituloProduto = "Produto em Promoção";
    let precoAtual = "R$ 99,90";
    let imagemUrl = "";

    let browser = null;
    try {
        // Inicializa o navegador em modo leve, otimizado para servidores
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,800'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // Acessa o link curto e aguarda o redirecionamento final da Shopee
        await page.goto(linkAfiliado, { waitUntil: 'networkidle2', timeout: 30000 });

        // Aguarda um instante para garantir a estabilização da página
        await new Promise(r => setTimeout(r, 2000));

        // Extrai as meta tags oficiais (`og:image`, `og:title`, etc.) da página final
        const dadosProduto = await page.evaluate(() => {
            const getMeta = (prop) => {
                const el = document.querySelector(`meta[property="${prop}"]`) || document.querySelector(`meta[name="${prop}"]`);
                return el ? el.getAttribute('content') : null;
            };

            return {
                title: getMeta('og:title') || document.title,
                image: getMeta('og:image'),
                description: getMeta('og:description')
            };
        });

        if (dadosProduto.title) {
            tituloProduto = dadosProduto.title.replace(' | Shopee Brasil', '').trim();
        }

        if (dadosProduto.image) {
            imagemUrl = dadosProduto.image;
        }

        if (dadosProduto.description) {
            const matchPreco = dadosProduto.description.match(/R\$\s?[\d.,]+/);
            if (matchPreco) {
                precoAtual = matchPreco[0];
            }
        }

    } catch (error) {
        console.error("Erro ao usar Puppeteer:", error);
    } finally {
        if (browser) {
            await browser.close(); // Fecha o navegador para liberar a memória do servidor
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
        bot.sendMessage(chatId, `❌ Erro ao gerar a arte com a imagem.`);
    }
});
