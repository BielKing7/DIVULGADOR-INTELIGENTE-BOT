const { Telegraf } = require('telegraf');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply('Olá! Sou o seu Divulgador Inteligente. Envie um link de afiliado para começarmos.');
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    // Verifica se a mensagem é um link
    if (text.startsWith('http://') || text.startsWith('https://')) {
        await ctx.reply('🔍 Buscando dados do produto...');

        try {
            // Faz a requisição para acessar o site do link
            const { data } = await axios.get(text, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const $ = cheerio.load(data);

            // Tenta pegar o título do produto pelas tags do site
            const title = $('meta[property="og:title"]').attr('content') || $('title').text();
            const image = $('meta[property="og:image"]').attr('content');

            // Responde com o que encontrou (por enquanto em texto)
            await ctx.reply(`✅ Produto encontrado!\n\n*Título:* ${title}\n\nLink processado com sucesso!`);
            
        } catch (error) {
            console.error(error);
            ctx.reply('❌ Não consegui ler os dados deste link. Verifique se o link está correto.');
        }
    } else {
        ctx.reply('Por favor, envie um link válido começando com http:// ou https://');
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
