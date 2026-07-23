require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { gerarArtePromocao } = require('./canvas');

// --- CONFIGURAÇÃO DO FIREBASE ADMIN (VIA VARIÁVEL DE AMBIENTE) ---
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Lê o JSON direto da variável de ambiente configurada no Render
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
    
    try {
        // Verifica se o chat do Telegram já está cadastrado e autenticado
        const userRef = db.collection('usuarios').doc(String(chatId));
        const doc = await userRef.get();

        if (doc.exists && doc.data().autenticado) {
            usuariosState[chatId] = { step: 'AUTENTICADO' };
            bot.sendMessage(chatId, `🎉 Você já está cadastrado e autenticado!\n\nAtive o modo /poststory para começar a criar suas publicações! 🚀`);
            return;
        }
    } catch (error) {
        console.error("Erro ao consultar Firestore:", error);
    }

    usuariosState[chatId] = { step: 'AGUARDANDO_EMAIL' };
    bot.sendMessage(chatId, 
        `Bem-vindo ao 🤖 Divulgador Inteligente Bot 🛍️! Configure agora seu Bot e inicie a divulgação de suas ofertas!!!\n\nPor favor, informe o seu e-mail para verificarmos o cadastro. 👉`
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

        const emailInformado = text.trim();

        try {
            // Procura no Firestore se já existe algum usuário cadastrado com esse e-mail
            const snapshot = await db.collection('usuarios').where('email', '==', emailInformado).get();

            if (!snapshot.empty) {
                // O e-mail JÁ EXISTE no banco! Vinculamos este chatId e liberamos o acesso direto
                const docUser = snapshot.docs[0];
                const dadosUser = docUser.data();

                await db.collection('usuarios').doc(String(chatId)).set({
                    chatId: chatId,
                    email: emailInformado,
                    nome: dadosUser.nome || 'Usuário',
                    autenticado: true,
                    criadoEm: dadosUser.criadoEm || new Date().toISOString()
                });

                usuariosState[chatId] = { step: 'AUTENTICADO' };
                bot.sendMessage(chatId, `✅ E-mail já cadastrado encontrado no banco!\n\nAcesso liberado com sucesso! 🎉\n\nAtive o modo /poststory para começar a criar suas publicações! 🚀`);
                return;
            }

            // Se o e-mail NÃO EXISTE, segue o fluxo para cadastrar novo usuário gerando o código
            estado.email = emailInformado;
            estado.codigoGerado = Math.floor(10000 + Math.random() * 90000).toString();
            estado.step = 'AGUARDANDO_CODIGO';

            bot.sendMessage(chatId, 
                `⚠️ E-mail não encontrado no sistema. Vamos realizar seu cadastro!\n\nSeu código de verificação temporário é: *${estado.codigoGerado}*\n\nDigite esse código de 5 dígitos para continuar:`,
                { parse_mode: 'Markdown' }
            );

        } catch (error) {
            console.error("Erro ao verificar e-mail no Firestore:", error);
            bot.sendMessage(chatId, `❌ Ocorreu um erro ao consultar o banco de dados. Tente novamente enviando /start.`);
        }
        return;
    }

    if (estado.step === 'AGUARDANDO_CODIGO') {
        if (text.trim() !== estado.codigoGerado) {
            bot.sendMessage(chatId, `❌ Código incorreto. Tente novamente.`);
            return;
        }
        estado.step = 'AGUARDANDO_NOME';
        bot.sendMessage(chatId, `✅ Código validado! Por favor, informe seu nome para finalizar o cadastro:`);
        return;
    }

    if (estado.step === 'AGUARDANDO_NOME') {
        estado.nome = text.trim();
        
        try {
            // Salva o novo usuário no Firestore
            await db.collection('usuarios').doc(String(chatId)).set({
                chatId: chatId,
                email: estado.email,
                nome: estado.nome,
                autenticado: true,
                criadoEm: new Date().toISOString()
            });

            usuariosState[chatId] = { step: 'AUTENTICADO' };
            bot.sendMessage(chatId, 
                `✅ Cadastro concluído e salvo no Firebase com sucesso! 🚀\n\nAtive o modo /poststory para começar a criar suas publicações! 😊`
            );
        } catch (error) {
            console.error("Erro ao salvar no Firestore:", error);
            bot.sendMessage(chatId, `❌ Ocorreu um erro ao salvar seus dados no banco. Tente novamente enviando /start.`);
            usuariosState[chatId] = null;
        }
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
    }
});
