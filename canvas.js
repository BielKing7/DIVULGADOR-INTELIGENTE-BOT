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
    const boxH = 1070;

    // --- 3. Imagem do Produto dentro da Caixa Branca ---
    const imgSize = 600;
    const imgX = boxX + (boxW - imgSize) / 2;
    const imgY = boxY + 30;

    if (product.imageUrl) {
        try {
            const productImage = await loadImage(product.imageUrl);
            ctx.drawImage(productImage, imgX, imgY, imgSize, imgSize);
        } catch (e) {
            console.log("Falha ao carregar imagem do produto da web.");
        }
    }

    // --- 4. Título do Produto ---
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 42px sans-serif';
    
    let titulo = product.title || "Produto em Promoção";
    let linhasTitulo = quebrarTexto(ctx, titulo, boxW - 80);
    let currentY = boxY + 680;
    
    for (let linha of linhasTitulo.slice(0, 2)) {
        ctx.fillText(linha, boxX + 40, currentY);
        currentY += 50;
    }

    // --- 5. Preços (Preço Antigo Riscado e Preço Atual) ---
    if (product.precoAntigo && product.precoAntigo !== product.precoAtual) {
        ctx.fillStyle = '#888888';
        ctx.font = '32px sans-serif';
        let textoAntigo = `De ${product.precoAntigo}`;
        ctx.fillText(textoAntigo, boxX + 40, currentY + 35);
        
        let textWidth = ctx.measureText(textoAntigo).width;
        ctx.strokeStyle = '#FF3B30';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(boxX + 35, currentY + 23);
        ctx.lineTo(boxX + 40 + textWidth, currentY + 23);
        ctx.stroke();
    }

    // --- 6. Preço Atual na Pílula Vermelha Inferior da Arte ---
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    let precoExibir = product.precoAtual || 'R$ 139,90';
    
    // Coordenada centralizada na pílula vermelha da sua arte
    ctx.fillText(precoExibir, 540, 1420);

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
