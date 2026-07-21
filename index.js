const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply('🤖 *Divulgador Inteligente Ativo!*\n\nEnvie o seu link de afiliado da Magalu, Shopee, Amazon ou Mercado Livre para gerar o seu Story personalizado.');
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    // Verifica se é um link válido
    if (text.startsWith('http://') || text.startsWith('https://')) {
        
        // 1. Mensagem idêntica ao bot de referência
        const msgBusca = await ctx.reply('🔍 Buscando dados do produto...');

        // Simula o tempo de requisição na API do e-commerce e renderização da arte
        setTimeout(async () => {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                msgBusca.message_id,
                undefined,
                '✨ Pronto! 🤩 Vou criar a arte...'
            );
        }, 1500);

        setTimeout(async () => {
            // Apaga a mensagem anterior para limpar o chat
            await ctx.telegram.deleteMessage(ctx.chat.id, msgBusca.message_id).catch(() => {});

            // Texto da legenda idêntico ao modelo que você mandou nos prints
            const legendaFinal = `📱 *Story gerado* ✨🖼️✨\n\n🔗 *Link:* ${text}`;

            // Envia a imagem de preview simulando o banner gerado pelo seu bot
            // (Aqui no futuro vamos conectar a imagem gerada dinamicamente pelo template)
            await ctx.reply(legendaFinal, {
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            });

        }, 3500);

    } else {
        ctx.reply('⚠️ Por favor, envie apenas links de afiliados válidos começando com http:// ou https://');
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
