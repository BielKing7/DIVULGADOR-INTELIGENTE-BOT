const { Telegraf } = require('telegraf');
const axios = require('axios');
const cheerio = require('cheerio');
const Jimp = require('jimp');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply('🤖 *Divulgador Inteligente Ativo!*\n\nEnvie o seu link de afiliado para gerar a arte do Story com o modelo padrão.');
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    if (text.startsWith('http://') || text.startsWith('https://')) {
        const msgBusca = await ctx.reply('🔍 Buscando dados do produto e montando a arte...');

        try {
            // 1. Coleta os dados do produto (Foto e Título)
            const response = await axios.get(text, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
            });
            const $ = cheerio.load(response.data);
            const imageUrl = $('meta[property="og:image"]').attr('content');
            const productTitle = $('meta[property="og:title"]').attr('content') || 'Oferta Imperdível';

            if (!imageUrl) throw new Error('Imagem não encontrada');

            // 2. Cria a base do Story (Tamanho ideal: 1080x1920 pixels)
            // Aqui você pode mudar a cor de fundo alterando o código hexadecimal (Ex: 0x1a1a2eff para azul escuro, etc)
            const story = new Jimp(1080, 1920, 0x111111ff); // Fundo escuro base

            // Desenha a faixa/moldura central do template (Ex: Cor de fundo do card customizada)
            const cardBg = new Jimp(900, 1100, 0xffffffff); // Fundo branco do card do produto
            story.composite(cardBg, 90, 350);

            // Carrega a foto do produto direto da URL
            const productImg = await Jimp.read(imageUrl);
            productImg.scaleToFit(750, 600); // Redimensiona para caber no espaço correto
            
            // Cola a foto do produto dentro do card
            story.composite(productImg, 165, 420);

            // 3. Adiciona a caixa do botão "COMPRE AQUI" na parte inferior
            const buttonBg = new Jimp(900, 140, 0x7b2cbf00); // Cor do botão (Roxo personalizado)
            // (Opcional: podemos desenhar formas ou textos direto aqui)

            // Salva a imagem temporariamente na memória do bot
            const buffer = await story.getBufferAsync(Jimp.MIME_JPEG);

            // Apaga a mensagem de status
            await ctx.telegram.deleteMessage(ctx.chat.id, msgBusca.message_id).catch(() => {});

            // 4. Envia a arte pronta com o link de afiliado logo abaixo
            const caption = `✨ *${productTitle}* ✨\n\n👇 *Garanta o seu com desconto aqui:* 👇\n${text}`;

            await ctx.replyWithPhoto({ source: buffer }, {
                caption: caption,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error(error);
            await ctx.telegram.editMessageText(ctx.chat.id, msgBusca.message_id, undefined, '⚠️ Não foi possível gerar a arte automática para este link, mas segue o link direto:');
            await ctx.reply(text);
        }

    } else {
        ctx.reply('⚠️ Por favor, envie um link válido começando com http:// ou https://');
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
