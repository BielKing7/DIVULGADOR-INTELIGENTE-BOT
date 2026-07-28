const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');

// Variáveis de ambiente configuradas no Render
const token = process.env.TELEGRAM_TOKEN;
const SHOPEE_APP_ID = process.env.SHOPEE_APP_ID;
const SHOPEE_SECRET = process.env.SHOPEE_SECRET;

if (!token || !SHOPEE_APP_ID || !SHOPEE_SECRET) {
    console.error('ERRO: Variáveis de ambiente não configuradas no Render!');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Divulgador Inteligente iniciado com sucesso!');

// Função para expandir link curto (s.shopee.com.br) e pegar o link real
async function expandShopeeUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, {
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });
        return response.request.res.responseUrl || shortUrl;
    } catch (error) {
        console.error('Erro ao expandir link:', error.message);
        return shortUrl;
    }
}

// Função para buscar dados do produto na API GraphQL da Shopee
async function getShopeeProductData(productUrl) {
    // Se for link encurtado, expande primeiro
    let targetUrl = productUrl;
    if (productUrl.includes('s.shopee.com.br')) {
        targetUrl = await expandShopeeUrl(productUrl);
    }

    // Tenta extrair termos úteis da URL ou usa a URL limpa para busca
    let searchTerm = targetUrl;
    const matchItem = targetUrl.match(/\/i\.(\d+)\.(\d+)/);
    if (matchItem) {
        // Se achou o padrão da Shopee /i.shopid.itemid, podemos buscar pelo ID ou termos
        searchTerm = `${matchItem[1]} ${matchItem[2]}`;
    }

    const query = `
    query {
      productV2(keyword: "${searchTerm}", limit: 1) {
        nodes {
          itemId
          productName
          priceMin
          priceMax
          imageUrl
          offerLink
          productLink
        }
      }
    }
    `;

    const payload = JSON.stringify({ query });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const factor = `${SHOPEE_APP_ID}${timestamp}${payload}${SHOPEE_SECRET}`;
    const signature = crypto.createHash('sha256').update(factor).digest('hex');

    const authorizationHeader = `SHA256 Credential=${SHOPEE_APP_ID}, Timestamp=${timestamp}, Signature=${signature}`;

    try {
        const response = await axios.post('https://open-api.affiliate.shopee.com.br/graphql', payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authorizationHeader
            }
        });

        const data = response.data;
        if (data && data.data && data.data.productV2 && data.data.productV2.nodes.length > 0) {
            const product = data.data.productV2.nodes[0];
            // Garante que o link de oferta retornado seja o original enviado ou o de afiliado gerado
            if (!product.offerLink) {
                product.offerLink = targetUrl;
            }
            return product;
        }
        return null;
    } catch (error) {
        console.error('Erro na API da Shopee:', error.response?.data || error.message);
        return null;
    }
}

// Função para gerar a arte promocional fixa (1080x1080)
async function generatePromotionalArt(productData) {
    const width = 1080;
    const height = 1080;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fundo base escuro
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    // Header superior Shopee
    ctx.fillStyle = '#EE4D2D'; 
    ctx.fillRect(0, 0, width, 100);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 45px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 OFERTA IMPERDÍVEL 🔥', width / 2, 65);

    // Imagem do produto
    try {
        if (productData.imageUrl) {
            const img = await loadImage(productData.imageUrl);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(140, 140, 800, 500);
            ctx.drawImage(img, 160, 160, 760, 460);
        }
    } catch (e) {
        console.log('Erro ao carregar imagem do produto:', e);
    }

    // Caixa de informações
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(80, 680, 920, 320);

    // Título
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'left';
    
    let title = productData.productName || 'Produto Shopee';
    if (title.length > 55) title = title.substring(0, 52) + '...';
    ctx.fillText(title, 120, 740);

    // Preço
    ctx.fillStyle = '#10B981'; 
    ctx.font = 'bold 55px sans-serif';
    const priceText = `R$ ${productData.priceMin || productData.priceMax || '0,00'}`;
    ctx.fillText(priceText, 120, 840);

    // Rodapé / CTA
    ctx.fillStyle = '#EE4D2D';
    ctx.fillRect(120, 890, 840, 80);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👉 CORRE PRA APROVEITAR NO LINK!', width / 2, 942);

    return canvas.toBuffer('image/jpeg');
}

// Ouvinte de mensagens do Telegram
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || !text.startsWith('http')) {
        return;
    }

    bot.sendMessage(chatId, '🔍 Expandindo link e buscando dados na Shopee...');

    const product = await getShopeeProductData(text);
    
    if (!product) {
        bot.sendMessage(chatId, '❌ Não encontrei o produto na API da Shopee com esse link. Tente enviar o link completo do produto.');
        return;
    }

    try {
        const imageBuffer = await generatePromotionalArt(product);
        
        const caption = `✨ *${product.productName}*\n\n💰 *Preço:* R$ ${product.priceMin || product.priceMax}\n\n🔗 *Garanta o seu aqui:* ${product.offerLink || product.productLink}`;

        await bot.sendPhoto(chatId, imageBuffer, {
            caption: caption,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Erro ao gerar/enviar arte:', error);
        bot.sendMessage(chatId, '❌ Ocorreu um erro ao gerar a imagem do produto.');
    }
});
