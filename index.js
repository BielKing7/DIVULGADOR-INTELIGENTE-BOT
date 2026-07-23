require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const { gerarArtePromocao } = require('./canvas');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Divulgador Inteligente Bot está online! 🚀'));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const usuariosState = {};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    usuariosState[chatId] = { step: 'AGUARDANDO_EMAIL' };

    bot.sendMessage(chatId, 
        `Bem-vindo ao 🤖 Divulgador Inteligente Bot 🛍️! Configure agora seu Bot e inicie a divulgação de suas ofertas!!!\n\nPor favor, forneça seu e-mail para dar início ao seu cadastro na plataforma. 👉`
    );
});

bot.onText(/\/poststory/, (msg) => {
    const chatId = msg.chat.id;
    if (!usuariosState[chatId] || usuariosState[chatId].step !== 'AUTENTICADO') {
        bot.sendMessage(chatId, `⚠️ Você precisa concluir o seu cadastro primeiro. Envie /start para começar.`);
        return;
    }

    usuariosState[chatId].step = 'POST_STORY';
    bot.sendMessage(chatId, `🔄 Ativando o modo combinado de Post e Story! 📝📱✨\n\nAgora envie o seu link de afiliado para gerarmos a publicação.`);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    const estado = usuariosState[chatId];
    if (!estado) {
        bot.sendMessage(chatId, `Envie /start para iniciar.`);
        return;
    }

    if (estado.step === 'AGUARDANDO_EMAIL') {
        if (!text.includes('@')) {
            bot.sendMessage(chatId, `❌ E-mail inválido. Por favor, digite um e-mail válido.`);
            return;
        }
        estado.email = text.trim();
        estado.codigoGerado = Math.floor(10000 + Math.random() * 90000).toString();
        estado.step = 'AGUARDANDO_CODIGO';

        try {
            await transporter.sendMail({
                from: '"Divulgador Inteligente" <' + process.env.EMAIL_USER + '>',
                to: estado.email,
                subject: 'Seu Código de Ativação - Divulgador Inteligente',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2>Divulgador Inteligente</h2>
                        <p>Olá! Você solicitou o seu código de ativação.</p>
                        <p>Seu código é: <strong style="font-size: 20px; color: #007bff;">${estado.codigoGerado}</strong></p>
                        <p>Este código é válido por 15 minutos. Se você não solicitou isso, ignore esta mensagem.</p>
                    </div>
                `
            });

            bot.sendMessage(chatId, 
                `✅ Digite o código de 5 dígitos enviado para o e-mail ${estado.email}.\nEste código é válido por 15 minutos! Se não o recebeu, confira sua caixa de spam.`
            );
        } catch (error) {
            console.error("ERRO COMPLETO DO GMAIL:", error);
            bot.sendMessage(chatId, `❌ Erro ao enviar o e-mail. Veja o log no Render.`);
            estado.step = 'AGUARDANDO_EMAIL';
        }
        return;
    }

    if (estado.step === 'AGUARDANDO_CODIGO') {
        if (text.trim() !== estado.codigoGerado) {
            bot.sendMessage(chatId, `❌ Código incorreto. Tente novamente.`);
            return;
        }
        estado.step = 'AGUARDANDO_NOME';
        bot.sendMessage(chatId, `✅ Email validado com sucesso! Por favor, informe seu nome.`);
        return;
    }

    if (estado.step === 'AGUARDANDO_NOME') {
        estado.nome = text.trim();
        estado.step = 'AUTENTICADO';
        bot.sendMessage(chatId, 
            `✅ Cadastro realizado com sucesso! Agora você pode começar a usar o bot. 😊\n\nAtive o modo /poststory para começar a criar suas publicações! 🚀`
        );
        return;
    }

    if (estado.step === 'POST_STORY') {
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

            const bufferArte = `gerarArtePromocao`({
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
    }
});
