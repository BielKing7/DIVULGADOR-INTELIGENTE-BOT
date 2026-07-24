const { createCanvas, loadImage } = require('canvas');
const path = require('path');

async function gerarArtePromocaoFixa(product) {
    const width = 1080;
    const height = 1920;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- 1. Carrega a sua Imagem de Fundo Fixa do Repositório ---
    try {
        const caminhoFundo = path.join(__dirname, 'fundo-story.png');
        const imagemFundo = await loadImage(caminhoFundo);
        ctx.drawImage(imagemFundo, 0, 0, width, height);
    } catch (e) {
        console.log("Aviso: 'fundo-story.png' não encontrado, usando cor sólida.");
        ctx.fillStyle = '#8A2BE2';
        ctx.fillRect(0, 0, width, height);
    }

    // --- 2. Coordenadas da Caixa Branca Principal ---
    const boxX = 110;
    const boxY = 175;
    const boxW = 860;

    // --- 3. Imagem do Produto dentro da Caixa Branca ---
    const imgSize = 580;
    const imgX = boxX + (boxW - imgSize) / 2;
    const imgY = boxY + 20;

    let imageUrlFinal = product.imageUrl;
    // Fallback de imagem caso a web bloqueie o link curto da Shopee
    if (!imageUrlFinal || imageUrlFinal.includes('s.shopee.com.br')) {
        imageUrlFinal = 'https://images.tcdn.com.br/img/img_prod/805128/kit_cafe_manha.jpg';
    }

    try {
        const productImage = await loadImage(imageUrlFinal);
        ctx.drawImage(productImage, imgX, imgY, imgSize, imgSize);
    } catch (e) {
        console.log("Falha ao carregar imagem do produto.");
    }

    // --- 4. Título do Produto ---
    ctx.textAlign = 'center';
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 44px sans-serif';
    
    let titulo = product.title || "Kit Café Manhã Chaleira Elétrica + Sanduicheira";
    let linhasTitulo = quebrarTexto(ctx, titulo, boxW - 80);
    let currentY = boxY + 630;
    
    for (let linha of linhasTitulo.slice(0, 2)) {
        ctx.fillText(linha, 540, currentY);
        currentY += 55;
    }

    // --- 5. Preço Atual na Pílula Roxa Inferior da Arte ---
    ctx.fillStyle = '#FFFFFF'; // Branco forte para destacar na pílula roxa
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    let precoExibir = product.precoAtual || 'R$ 139,90';
    
    // Coordenada exata dentro da pílula roxa com ícone de carrinho
    ctx.fillText(precoExibir, 540, 835);

    return canvas.toBuffer('image/png');
}

function quebrarTexto(ctx, texto, larguraMaxima) {
    let palavras = texto.split(' ');
    let linhas = [];
    if (palavras.length === 0) return [''];
    let linhaAtual = palavras[0];

    for (let i = 1; i < palavras.length; i++) {
        let palavraTeste = linhaAtual + ' ' + palavras[i];
        let medicao = ctx.measureText(palavraTeste);
        if (medicao.width < larguraMaxima) {
            linhaAtual = palavraTeste;
        } else {
            linhas.push(linhaAtual);
            linhaAtual = palavras[i];
        }
    }
    linhas.push(linhaAtual);
    return linhas;
}

module.exports = { gerarArtePromocao: gerarArtePromocaoFixa };
