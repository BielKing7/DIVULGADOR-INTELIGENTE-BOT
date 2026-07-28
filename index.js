const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');
const http = require('http');

const token = process.env.TELEGRAM_TOKEN;
const SHOPEE_APP_ID = process.env.SHOPEE_APP_ID;
const SHOPEE_SECRET = process.env.SHOPEE_SECRET;

if (!token || !SHOPEE_APP_ID || !SHOPEE_SECRET) {
    console.error('ERRO: Variáveis de ambiente não configuradas no Render!');
    process.exit(1);
}

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

// Função para formatar o preço corretamente para o padrão brasileiro (R$ X.XXX,XX)
function formatPrice(priceStr) {
    if (!priceStr) return '0,00';
    let num = parseFloat(priceStr);
    if (isNaN(num)) return priceStr;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Função para buscar dados exatos do produto na API da Shopee
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

    // Extrai o ID numérico exato do produto da URL da Shopee (ex: ...-i.1097151802.23093823316)
    let itemId = null;
    const matchItem = targetUrl.match(/\/i\.(\d+)\.(\d+)/);
    if (matchItem) {
        itemId = matchItem[2];
        console.log(`🎯 ID numérico exato do produto extraído com sucesso: ${itemId}`);
    }

    // Se por acaso não achar o ID na URL, tentamos buscar pelo título decodificado
    let query = '';
    if (itemId) {
        // Busca focada e cirúrgica pelo ID do item na API da Shopee
        query = `
        query {
          productOfferV2(itemId: ${itemId}) {
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
    } else {
        let searchTerm = "oferta shopee";
        const urlParts = targetUrl.split('?')[0].split('/');
        const cleanSlug = urlParts.find(part => part.includes('-i.'));
        if (cleanSlug) {
            try {
                const decodedSlug = decodeURIComponent(cleanSlug);
                const words = decodedSlug.split('-i.')[0].split('-');
                searchTerm = words.slice(0, 4).join(' '); 
            } catch (e) {
                searchTerm = "shopee";
            }
        }
        query = `
        query {
          productOfferV2(keyword: "${searchTerm}", limit: 5) {
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
    }

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
        
        if (data && data.data && data.data.productOfferV2 && data.data.productOfferV2.nodes.length > 0) {
            const product = data.data.productOfferV2.nodes[0];
            if (!product.offerLink) {
                product.offerLink = targetUrl;
            }
            return product;
        }
        
        console.log('⚠️ Nenhum produto encontrado. Resposta completa da API:', JSON.stringify(data));
        return null;
    } catch (error) {
        console.error('❌ Erro na API da Shopee:', error.response?.data || error.message);
        return null;
    }
}

// Função para gerar a arte promocional proporcional e limpa
async function generatePromotionalArt(productData) {
    console.log('🎨 Gerando arte visual proporcional para:', productData.productName);
    const width = 1080;
    const height = 1080;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fundo totalmente branco e limpo
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Topo estilizado da Shopee
    ctx.fillStyle = '#EE4D2D'; 
    ctx.fillRect(0, 0, width, 110);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 OFERTA IMPERDÍVEL NA SHOPEE 🔥', width / 2, 70);

    try {
        if (productData.imageUrl) {
            const img = await loadImage(productData.imageUrl);
            
            const maxImgWidth = 900;
            const maxImgHeight = 500;
            
            let imgW = img.width;
            let imgH = img.height;
            
            const ratio = Math.min(maxImgWidth / imgW, maxImgHeight / imgH);
            const drawW = imgW * ratio;
            const drawH = imgH * ratio;
            
            const drawX = (width - drawW) / 2;
            const drawY = 135 + (maxImgHeight - drawH) / 2;

            ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }
    } catch (e) {
        console.log('⚠️ Erro ao carregar imagem do produto:', e);
    }

    // Caixa inferior para as informações
    ctx.fillStyle = '#F3F4F6';
    ctx.fillRect(60, 660, 960, 360);

    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'left';
    
    let title = productData.productName || 'Produto Shopee';
    if (title.length > 55) title = title.substring(0, 52) + '...';
    ctx.fillText(title, 100, 730);

    const rawPrice = productData.priceMin || productData.priceMax || '0,00';
    const formattedPrice = formatPrice(rawPrice);

    ctx.fillStyle = '#059669'; 
    ctx.font = 'bold 60px sans-serif';
    ctx.fillText(`R$ ${formattedPrice}`, 100, 830);

    ctx.fillStyle = '#EE4D2D';
    ctx.fillRect(100, 890, 880, 90);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👉 CLIQUE AQUI E GARANTA O SEU!', width / 2, 948);

    return canvas.toBuffer('image/jpeg');
}

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
        const rawPrice = product.priceMin || product.priceMax || '0,00';
        const formattedPrice = formatPrice(rawPrice);
        
        const caption = `✨ *${product.productName}*\n\n💰 *Preço:* R$ ${formattedPrice}\n\n🔗 *Garanta o seu aqui:* ${product.offerLink || product.productLink}`;

    // Mantém o link original limpo que o usuário enviou ou o offerLink gerado
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
