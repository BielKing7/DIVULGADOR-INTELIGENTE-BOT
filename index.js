const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');
const http = require('http'); // Necessário para manter a porta aberta no Render

const token = process.env.TELEGRAM_TOKEN;
const SHOPEE_APP_ID = process.env.SHOPEE_APP_ID;
const SHOPEE_SECRET = process.env.SHOPEE_SECRET;

if (!token || !SHOPEE_APP_ID || !SHOPEE_SECRET) {
    console.error('ERRO: Variáveis de ambiente não configuradas no Render!');
    process.exit(1);
}

// Cria um servidor HTTP simples para satisfazer a exigência de porta do Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Divulgador Inteligente Bot esta rodando com sucesso!\n');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP interno ouvindo na porta ${PORT}`);
});

const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Divulgador Inteligente iniciado e ouvindo mensagens...');

// Função para buscar dados do produto na API GraphQL da Shopee
async function getShopeeProductData(productUrl) {
    console.log('🔍 Analisando URL recebida:', productUrl);

    let targetUrl = productUrl;
    if (productUrl.includes('s.shopee.com.br')) {
        try {
            const response = await axios.get(productUrl, {
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400
            });
            targetUrl = response.request.res.responseUrl || productUrl;
            console.log('🔗 Link expandido:', targetUrl);
        } catch (error) {
            console.log('⚠️ Não foi possível expandir o link curto, usando original:', error.message);
        }
    }

    let searchTerm = targetUrl;
    const matchItem = targetUrl.match(/\/i\.(\d+)\.(\d+)/);
    if (matchItem) {
        searchTerm = matchItem[2];
        console.log(`🎯 ID do produto extraído com sucesso: ShopID=${matchItem[1]}, ItemID=${matchItem[2]}`);
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
        console.log('📡 Enviando requisição para a API da Shopee...');
        const response = await axios.post('https://open-api.affiliate.shopee.com.br/graphql', payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authorizationHeader
            }
        });

        console.log('📥 Resposta recebida da Shopee com sucesso.');
        const data = response.data;
        
        if (data && data.data && data.data.productV2 && data.data.productV2.nodes.length > 0) {
            const product = data.data.productV2.nodes[0];
            if (!product.offerLink) {
                product.offerLink = targetUrl;
            }
            return product;
        }
        
        console.log('⚠️ Nenhum produto encontrado nos nós da resposta:', JSON.stringify(data));
        return null;
    } catch (error) {
        console.error('❌ Erro na API da Shopee:', error.response?.data || error.message);
        return null;
    }
}

// Função para gerar a arte promocional fixa (1080x1080)
async function generatePromotionalArt(productData) {
    console.log('🎨 Gerando arte visual para:', productData.productName);
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
        console.log('⚠️ Erro ao carregar imagem do produto:', e);
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

    console.log(`📩 Mensagem recebida do chat ${chatId}: ${text}`);
    await bot.sendMessage(chatId, '🔍 Analisando link e buscando dados na Shopee...');

    const product = await getShopeeProductData(text);
    
    if (!product) {
        await bot.sendMessage(chatId, '❌ Não encontrei o produto na API da Shopee com esse link.');
        return;
    }

    try {
        const imageBuffer = await generatePromotionalArt(product);
        
        const caption = `✨ *${product.productName}*\n\n💰 *Preço:* R$ ${product.priceMin || product.priceMax}\n\n🔗 *Garanta o seu aqui:* ${product.offerLink || product.productLink}`;

        await bot.sendPhoto(chatId, imageBuffer, {
            caption: caption,
            parse_mode: 'Markdown'
        });
        console.log('✅ Arte enviada com sucesso para o Telegram!');
    } catch (error) {
        console.error('❌ Erro ao gerar/enviar arte:', error);
        await bot.sendMessage(chatId, '❌ Ocorreu um erro ao gerar a imagem do produto.');
    }
});
