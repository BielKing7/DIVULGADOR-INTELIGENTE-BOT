const { createCanvas, loadImage } = require('canvas');

async function gerarArtePromocao(dados) {
    // Cria a base da imagem (exemplo formato story: 1080x1920)
    const largura = 1080;
    const altura = 1920;
    const canvas = createCanvas(largura, altura);
    const ctx = canvas.getContext('2d');

    // Fundo padrão (você pode carregar uma imagem de fundo fixa se preferir)
    ctx.fillStyle = '#ee4d2d'; // Cor padrão Shopee
    ctx.fillRect(0, 0, largura, altura);

    // Caixa branca central para destacar o produto
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(90, 300, 900, 1300, 40);
    ctx.fill();

    try {
        // Carrega a imagem do produto vinda da API oficial da Shopee
        if (dados.imageUrl) {
            const imagemProduto = await loadImage(dados.imageUrl);
            // Desenha a imagem centralizada na arte
            ctx.drawImage(imagemProduto, 190, 380, 700, 700);
        }
    } catch (e) {
        console.error("Erro ao carregar imagem do produto no Canvas:", e.message);
    }

    // Escreve o Título do Produto obtido pela API
    ctx.fillStyle = '#222222';
    ctx.font = 'bold 36px sans-serif';
    
    // Função para quebrar o texto em várias linhas se for muito longo
    desenharTextoMut说到(ctx, dados.title || "Oferta Imperdível", 140, 1150, 800, 48);

    // Retorna o buffer da imagem pronta
    return canvas.toBuffer('image/png');
}

function desenharTextoMut说到(ctx, texto, x, y, larguraMaxima, alturaLinha) {
    const palavras = texto.split(' ');
    let linha = '';
    let posY = y;

    for (let n = 0; n < palavras.length; n++) {
        const testeLinha = linha + palavras[n] + ' ';
        const metricas = ctx.measureText(testeLinha);
        const testeLargura = metricas.width;

        if (testeLargura > larguraMaxima && n > 0) {
            ctx.fillText(linha, x, posY);
            linha = palavras[n] + ' ';
            posY += alturaLinha;
        } else {
            linha = testeLinha;
        }
    }
    ctx.fillText(linha, x, posY);
}

module.exports = { gerarArtePromocao };
