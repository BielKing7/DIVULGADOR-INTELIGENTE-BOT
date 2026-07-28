const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');

// Variáveis de ambiente configuradas no Render (Segurança máxima)
const token = process.env.TELEGRAM_TOKEN;
const SHOPEE_APP_ID = process.env.SHOPEE_APP_ID;
const SHOPEE_SECRET = process.env.SHOPEE_SECRET;

if (!token || !SHOPEE_APP_ID || !SHOPEE_SECRET) {
    console.error('ERRO: Variáveis de ambiente (TELEGRAM_TOKEN, SHOPEE_APP_ID ou SHOPEE_SECRET) não configuradas no Render!');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Divulgador Inteligente iniciado com sucesso!');

// Função para buscar dados do produto na API GraphQL da Shopee
async function getShopeeProductData(productUrl) {
    const query = `
    query {
      productV2(keyword: "${productUrl}", limit: 1) {
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
    
    // Assinatura de segurança exigida pela Shopee: SHA256(Credential + Timestamp + Payload + Secret)
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
            return data.data.productV2.nodes[0];
        }
        return null;
    } catch (error) {
        console.error('Erro na API da Shopee:', error.response?.data || error.message);
        return null;
    }
}

// Função para gerar a arte promocional fixa com a imagem e os dados do produto
async function generatePromotionalArt(productData) {
    const width = 1080;
    const height = 1080;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fundo base escuro e moderno
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    // Header superior (Estilo Shopee)
    ctx.fillStyle = '#EE4D2D'; 
    ctx.fillRect(0, 0, width, 100);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 45px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 OFERTA IMPERDÍVEL 🔥', width / 2, 65);

    // Carregar e desenhar a imagem do produto no centro
    try {
        if (productData.imageUrl) {
            const img = await loadImage(productData.imageUrl);
            // Caixa de destaque branca para a foto
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(140, 140, 800, 500);
            
            // Desenhar imagem
            ctx.drawImage(img, 160, 160, 760, 460);
        }
    } catch (e) {
        console.log('Erro ao carregar imagem do produto:', e);
    }

    // Caixa inferior para informações (Título e Preço)
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(80, 680, 920, 320);

    // Título do Produto
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'left';
    
    let title = productData.productName || 'Produto Shopee';
    if (title.length > 55) title = title.substring(0, 52) + '...';
    ctx.fillText(title, 120, 740);

    // Preço em destaque verde
    ctx.fillStyle = '#10B981'; 
    ctx.font = 'bold 55px sans-serif';
    const priceText = `R$ ${productData.priceMin || productData.priceMax || '0,00'}`;
    ctx.fillText(priceText, 120, 840);

    // Botão / Chamada para ação no rodapé
    ctx.fillStyle = '#EE4D2D';
    ctx.fillRect(120, 890, 840, 80);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👉 CORRE PRA APROVEITAR NO LINK!', width / 2, 942);

    return canvas.toBuffer('image/jpeg');
}

// Ouvinte de mensagens no Telegram
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || !text.startsWith('http')) {
        return; // Ignora mensagens que não sejam links
    }

    bot.sendMessage(chatId, '🔍 Analisando link e gerando arte personalizada...');

    const product = await getShopeeProductData(text);
    
    if (!product) {
        bot.sendMessage(chatId, '❌ Não consegui encontrar os dados desse produto. Verifique se o link está correto.');
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
