const { Telegraf } = require('telegraf');
const axios = require('axios');
const cheerio = require('cheerio');
const http = require('http');

// Cria um servidor HTTP básico para atender à exigência de porta do Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot de Afiliados rodando com sucesso!\n');
}).listen(PORT, () => {
    console.log(`Servidor HTTP ouvindo na porta ${PORT}`);
});

// Puxa o token do Telegram das variáveis de ambiente do Render
const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;
const ZENROWS_API_KEY = '3fc99dc10dee4f24a6c14f4d8bb3ab4954ec0fd';

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// Função universal para extrair dados de qualquer loja (Shopee, Magalu, Mercado Livre, Shein, etc.)
async function processarLinkAfiliado(linkAfiliado) {
    try {
        console.log(`Buscando dados para o link: ${linkAfiliado}`);

        const response = await axios({
            url: 'https://api.zenrows.com/v1/',
            method: 'GET',
            params: {
                'url': linkAfiliado,
                'apikey': ZENROWS_API_KEY,
                'mode': 'auto',
                'js_render': 'true',          // Carrega o JavaScript da página
                'premium_proxy': 'true',      // Usa proxies residenciais/premium
                'antibot': 'true',            // Bypassa telas de CAPTCHA e antibot (Magalu/Shopee)
                'follow_redirects': 'true'    // Segue o link encurtado até o produto final
            }
        });

        const $ = cheerio.load(response.data);

        // Tenta capturar a imagem por qualquer meta tag Open Graph ou Twitter Card disponível
        let imagem = $('meta[property="og:image"]').attr('content') || 
                     $('meta[name="twitter:image"]').attr('content') || 
                     $('link[rel="image_src"]').attr('content');

        let titulo = $('meta[property="og:title"]').attr('content') || $('title').text();

        // Se ainda não achou, pega a primeira imagem relevante da página
        if (!imagem) {
            imagem = $('img').first().attr('src');
        }

        // Tratamento caso a imagem venha sem protocolo
        if (imagem && !imagem.startsWith('http')) {
            imagem = 'https:' + imagem;
        }

        return {
            sucesso: true,
            titulo: titulo ? titulo.trim() : 'Achadinho Imperdível',
            imagem: imagem || ''
        };

    } catch (error) {
        console.error('Erro ao processar o link:', error.message);
        return { sucesso: false };
    }
}

// Ouve quando você mandar um link no chat do bot
bot.on('text', async (ctx) => {
    const textoMensagem = ctx.message.text;

    // Verifica se a mensagem parece ser um link
    if (textoMensagem.startsWith('http://') || textoMensagem.startsWith('https://')) {
        await ctx.reply('⏳ Processando link e buscando dados do produto sem bloqueios...');

        const dados = await processarLinkAfiliado(textoMensagem);

        if (dados.sucesso && dados.imagem) {
            // Envia a foto oficial do produto e o título extraído direto para o chat
            await ctx.replyWithPhoto(dados.imagem, {
                caption: `🛒 *${dados.titulo}*\n\n🔗 *Link:* ${textoMensagem}`,
                parse_mode: 'Markdown'
            });
        } else {
            await ctx.reply('❌ Não consegui puxar a imagem deste link. Tente novamente.');
        }
    }
});

// Inicia o bot
bot.launch();
console.log('🤖 Bot rodando no Render e pronto para testar os links!');

// Habilita o encerramento gracioso do bot
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
