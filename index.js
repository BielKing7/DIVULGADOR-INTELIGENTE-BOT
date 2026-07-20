const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply('Olá! Sou o seu Divulgador Inteligente. Envie um link de afiliado da Magalu, Shopee ou Amazon para gerar seu story.');
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    if (text.startsWith('http://') || text.startsWith('https://')) {
        await ctx.reply('🔍 Buscando dados do produto e gerando arte...');

        // Simulando o tempo de processamento da arte (como no bot original)
        setTimeout(async () => {
            // Mensagem formatada igual ao bot da sua referência
            const legendaStory = `✨ *Story gerado com sucesso!* ✨\n\n🔗 *Link de afiliado:* ${text}`;

            // Aqui enviamos uma imagem de exemplo simulando o banner gerado e o link logo abaixo
            await ctx.replyWithPhoto(
                { source: Buffer.from(iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') }, 
                { 
                    caption: legendaStory,
                    parse_mode: 'Markdown'
                }
            );
        }, 2000);

    } else {
        ctx.reply('Por favor, envie um link válido começando com http:// ou https://');
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
