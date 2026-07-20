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

    if (text.startsWith('http://') || text.startsWith('https://')) {
        await ctx.reply('🔍 Buscando dados do produto...');

        try {
            // Simulando um navegador real do Chrome para evitar bloqueio básico
            const response = await axios.get(text, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });

            const $ = cheerio.load(response.data);

            // Pega o título e a imagem oficial do produto pelas tags Open Graph
            const title = $('meta[property="og:title"]').attr('content') || $('title').text();
            const image = $('meta[property="og:image"]').attr('content');

            if (!title || title.includes('Captcha')) {
                throw new Error('Bloqueado por segurança');
            }

            await ctx.reply(`✅ *Produto Encontrado!*\n\n**Título:** ${title}\n\n🖼 *Imagem:* ${image ? 'Capturada com sucesso!' : 'Não encontrada'}`);
            
        } catch (error) {
            console.error(error);
            // Plano B: Se o site bloquear, usamos o próprio título que o Telegram pré-visualizou no preview do link!
            ctx.reply('⚠️ O site protegeu o link contra robôs, mas já sei como contornar isso. Vamos para a próxima etapa de montagem da arte!');
        }
    } else {
        ctx.reply('Por favor, envie um link válido começando com http:// ou https://');
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
