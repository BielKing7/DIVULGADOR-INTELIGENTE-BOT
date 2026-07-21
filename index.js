const { Telegraf } = require('telegraf');
const axios = require('axios');
const Jimp = require('jimp');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply('🤖 *Divulgador Inteligente Ativo!*\n\nEnvie o seu link de afiliado para gerar a arte.');
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    if (text.startsWith('http://') || text.startsWith('https://')) {
        const msgBusca = await ctx.reply('🔍 Consultando API de e-commerce e obtendo dados...');

        try {
            // Usando uma API especializada em extração limpa de páginas de varejo
            const apiRes = await axios.get(`https://api.microlink.io?url=${encodeURIComponent(text)}&palette=true&insights=true`);
            const data = apiRes.data.data;
            
            let imageUrl = data.image?.url;
            const productTitle = data.title || 'Oferta Imperdível';

            // Tratativa para garantir que não pegue logo da loja e sim o produto
            if (!imageUrl || imageUrl.includes('logo') || imageUrl.includes('icon') || imageUrl.includes('favicon')) {
                if (data.logo?.url) {
                    imageUrl = data.logo.url;
                }
            }

            if (!imageUrl) throw new Error('Imagem do produto não encontrada');

            await ctx.telegram.editMessageText(ctx.chat.id, msgBusca.message_id, undefined, '🎨 Renderizando o template personalizado...');

            // Cria o fundo do Story (1080x1920)
            const story = new Jimp(1080, 1920, 0x111111ff); 

            // Card branco central para o produto
            const cardBg = new Jimp(900, 1100, 0xffffffff); 
            story.composite(cardBg, 90, 350);

            // Carrega e redimensiona a foto exata do produto
            const productImg = await Jimp.read(imageUrl);
            productImg.scaleToFit(750, 600); 
            story.composite(productImg, 165, 420);

            // Gera o buffer da arte final
            const buffer = await story.getBufferAsync(Jimp.MIME_JPEG);

            await ctx.telegram.deleteMessage(ctx.chat.id, msgBusca.message_id).catch(() => {});

            // Envia a imagem pronta com a legenda formatada e o link de afiliado
            const legendaFinal = `✨ *${productTitle}* ✨\n\n👇 *Garanta o seu com desconto aqui:* 👇\n${text}`;

            await ctx.replyWithPhoto({ source: buffer }, {
                caption: legendaFinal,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error(error);
            await ctx.telegram.editMessageText(ctx.chat.id, msgBusca.message_id, undefined, '⚠️ Não foi possível carregar a imagem do produto, mas segue o link direto:');
            await ctx.reply(text);
        }

    } else {
        ctx.reply('⚠️ Por favor, envie um link válido começando com http:// ou https://');
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
