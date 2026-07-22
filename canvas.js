const { createCanvas, loadImage } = require('canvas');

async function gerarArtePromocaoPremium(product) {
    // Dimensões no formato Story/Vertical (1080x1920)
    const width = 1080;
    const height = 1920;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- 1. Fundo Degradê (Rosa para Roxo) ---
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#FF517F');
    gradient.addColorStop(1, '#8A2BE2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // --- 2. Cabeçalho Superior ---
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '400 120px sans-serif';
    ctx.fillText('%', 100, 170);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 70px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OFERTAS', 560, 130);
    ctx.fillText('INCRÍVEIS', 560, 210);

    ctx.font = '900 120px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('👜', 850, 175);

    // --- 3. Cartão Branco Central com Sombra ---
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    
    const cardX = 100;
    const cardY = 280;
    const cardW = 880;
    const cardH = 1100;
    const radius = 40;

    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardW - radius, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
    ctx.lineTo(cardX + cardW, cardY + cardH - radius);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
    ctx.lineTo(cardX + radius, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
    ctx.lineTo(cardX, cardY + radius);
    ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // --- 4. Imagem do Produto ---
    try {
        const productImage = await loadImage(product.imageUrl);
        const imgSize = 750;
        const imgX = cardX + (cardW - imgSize) / 2;
        const imgY = cardY + 50;
        ctx.drawImage(productImage, imgX, imgY, imgSize, imgSize);
    } catch (e) {
        console.error("Erro ao carregar imagem:", e);
    }

    // --- 5. Títulos e Preços ---
    ctx.textAlign = 'left';
    
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 50px sans-serif';
    let titulo = product.title || "Produto em Promoção";
    let linhasTitulo = quebrarTexto(ctx, titulo, cardW - 100);
    let currentY = cardY + 880;
    for (let linha of linhasTitulo.slice(0, 3)) {
        ctx.fillText(linha, cardX + 50, currentY);
        currentY += 60;
    }

    ctx.fillStyle = '#888888';
    ctx.font = '40px sans-serif';
    let precoAntigoTexto = `De ${product.precoAntigo || 'R$ 72,00'}`;
    ctx.fillText(precoAntigoTexto, cardX + 50, currentY + 40);
    
    let textWidth = ctx.measureText(precoAntigoTexto).width;
    ctx.strokeStyle = '#FF3B30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 45, currentY + 25);
    ctx.lineTo(cardX + 50 + textWidth, currentY + 25);
    ctx.stroke();

    // --- 6. Botão Vermelho "COMPRE AQUI" ---
    const btnX = cardX + 50;
    const btnY = currentY + 80;
    const btnW = cardW - 100;
    const btnH = 120;
    const btnRadius = 20;

    ctx.fillStyle = '#E62E2E';
    ctx.beginPath();
    ctx.moveTo(btnX + btnRadius, btnY);
    ctx.lineTo(btnX + btnW - btnRadius, btnY);
    ctx.quadraticCurveTo(btnX + btnW, btnY, btnX + btnW, btnY + btnRadius);
    ctx.lineTo(btnX + btnW, btnY + btnH - btnRadius);
    ctx.quadraticCurveTo(btnX + btnW, btnY + btnH, btnX + btnW - btnRadius, btnY + btnH);
    ctx.lineTo(btnX + btnRadius, btnY + btnH);
    ctx.quadraticCurveTo(btnX, btnY + btnH, btnX, btnY + btnH - btnRadius);
    ctx.lineTo(btnX, btnY + btnRadius);
    ctx.quadraticCurveTo(btnX, btnY, btnX + btnRadius, btnY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(product.precoAtual || 'R$ 40,26', btnX + btnW / 2 - 100, btnY + 85);
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('COMPRE AQUI', btnX + btnW / 2 + 130, btnY + 85);

    // --- 7. Rodapé e Marca d'água Lateral ---
    ctx.save();
    ctx.translate(width - 50, height / 2 + 200);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '400 36px sans-serif';
    ctx.fillText('@OFERTAS.INCRIVEIS.BRTOP', 0, 0);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

function quebrarTexto(ctx, texto, larguraMaxima) {
    let palavras = texto.split(' ');
    let linhas = [];
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

module.exports = { gerarArtePromocao: gerarArtePromocaoPremium };
