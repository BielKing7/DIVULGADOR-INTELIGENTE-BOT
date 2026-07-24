const { createCanvas, loadImage } = require('canvas');
const path = require('path');

async function gerarArtePromocaoFixa(product) {
    const width = 1080;
    const height = 1920;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Carrega a moldura fixa de fundo
    try {
        const caminhoFundo = path.join(__dirname, 'fundo-story.png');
        const imagemFundo = await loadImage(caminhoFundo);
        ctx.drawImage(imagemFundo, 0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#8A2BE2';
        ctx.fillRect(0, 0, width, height);
    }

    const boxX = 110;
    const boxY = 175;
    const boxW = 860;

    // 2. Desenha a foto real do produto capturada do link curto
    const imgSize = 540;
    const imgX = boxX + (boxW - imgSize) / 2;
    const imgY = boxY + 25;

    if (product.imageUrl) {
        try {
            const productImage = await loadImage(product.imageUrl);
            ctx.drawImage(productImage, imgX, imgY, imgSize, imgSize);
        } catch (e) {
            console.log("Erro ao carregar imagem da web.");
        }
    }

    // 3. Título do Produto
    ctx.textAlign = 'center';
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 42px sans-serif';
    
    let titulo = product.title || "Produto em Promoção";
    let linhasTitulo = quebrarTexto(ctx, titulo, boxW - 80);
    let currentY = boxY + 610;
    
    for (let linha of linhasTitulo.slice(0, 2)) {
        ctx.fillText(linha, 540, currentY);
        currentY += 50;
    }

    // 4. Preço Atual na Pílula Roxa Inferior
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 50px sans-serif';
    ctx.textAlign = 'center';
    let precoExibir = product.precoAtual || 'R$ 139,90';
    ctx.fillText(precoExibir, 540, 1420); // Coordenada ajustada para a pílula roxa de preço

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
