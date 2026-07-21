const { Telegraf } = require('telegraf');
const axios = require('axios');
const Jimp = require('jimp');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply('🤖 *Divulgador Inteligente Ativo!*\n\nEnvie o seu link de afiliado para gerar a arte personalizada para o Story.');
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    // 1. Validação se é um link válido
    if (text.startsWith('http://') || text.startsWith('https://')) {
        const msgBusca = await ctx.reply('🔍 Processando link e extraindo dados...');

        try {
            // 2. Extração de Metadados (Web Scraping inteligente via API gratuita)
            const apiRes = await axios.get(`https://api.microlink.io?url=${encodeURIComponent(text)}`);
            const imageUrl = apiRes.data.data.image?.url;
            const productTitle = apiRes.data.data.title || 'Oferta Imperdível';

            if (!imageUrl) throw new Error('Não foi possível extrair a imagem do produto.');

            await ctx.telegram.editMessageText(
                ctx.chat.id, 
                msgBusca.message_id, 
                undefined, 
                '🎨 Montando a arte no template...'
            );

            // 3. Renderização Visual (Criação do Story 1080x1920)
            // Fundo padrão da arte (Ex: Cor sólida ou base escura profissional)
            const story = new Jimp(1080, 1920, 0x111111ff); 

            // Caixa/Moldura branca central onde o produto vai encaixar
            const cardBg = new Jimp(900, 1100, 0xffffffff); 
            story.composite(cardBg, 90, 350);

            // Carrega e redimensiona a foto do produto tirada do link
            const productImg = await Jimp.read(imageUrl);
            productImg.scaleToFit(750, 600); 
            
            // Cola a foto do produto nas coordenadas exatas (X e Y) dentro do card
            story.composite(productImg, 165, 420);

            // Converte a arte finalizada para buffer de imagem JPEG
            const buffer = await story.getBufferAsync(Jimp.MIME_JPEG);

            // Apaga a mensagem de status para manter o chat limpo
            await ctx.telegram.deleteMessage(ctx.chat.id, msgBusca.message_id).catch(() => {});

            // 4. Envio Automatizado (Posta a imagem gerada com o título e o link de afiliado)
            const legendaFinal = `✨ *${productTitle}* ✨\n\n👇 *Garanta o seu com desconto aqui:* 👇\n${text}`;

            await ctx.replyWithPhoto({ source: buffer }, {
                caption: legendaFinal,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error(error);
            await ctx.telegram.editMessageText(
                ctx.chat.id, 
                msgBusca.message_id, 
                undefined, 
                '⚠️ Ocorreu um erro ao gerar a arte automática, mas segue o link direto para divulgação:'
            );
            await ctx.reply(text);
        }

    } else {
        ctx.reply('⚠️ Por favor, envie um link válido começando com http:// ou https://');
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
