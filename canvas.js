const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const path = require("path");

const WIDTH = 1080;
const HEIGHT = 1920;

const FOTO = {
    x: 180,
    y: 180,
    largura: 720,
    altura: 720
};

async function gerarArte(produto) {

    const canvas = createCanvas(WIDTH, HEIGHT);

    const ctx = canvas.getContext("2d");

    const fundo = await loadImage(
        path.join(__dirname, "assets", "arte.png")
    );

    ctx.drawImage(
        fundo,
        0,
        0,
        WIDTH,
        HEIGHT
    );

    const resposta = await axios.get(
        produto.imagem,
        {
            responseType: "arraybuffer",
            timeout: 15000
        }
    );

    const imagem = await loadImage(
        Buffer.from(resposta.data)
    );

    ctx.fillStyle = "#FFFFFF";

    ctx.fillRect(
        FOTO.x,
        FOTO.y,
        FOTO.largura,
        FOTO.altura
    );

    const escala = Math.min(
        FOTO.largura / imagem.width,
        FOTO.altura / imagem.height
    );

    const larguraFinal = imagem.width * escala;

    const alturaFinal = imagem.height * escala;

    const x =
        FOTO.x +
        (FOTO.largura - larguraFinal) / 2;

    const y =
        FOTO.y +
        (FOTO.altura - alturaFinal) / 2;

    ctx.drawImage(

        imagem,

        x,
        y,

        larguraFinal,
        alturaFinal

    );

ctx.fillStyle = "#111111";
ctx.textAlign = "center";
ctx.textBaseline = "top";
ctx.font = "bold 42px Sans";

function quebrarTexto(ctx, texto, larguraMaxima) {

    const palavras = texto.split(" ");

    const linhas = [];

    let linha = "";

    for (const palavra of palavras) {

        const teste = linha + palavra + " ";

        if (
            ctx.measureText(teste).width >
            larguraMaxima
        ) {

            linhas.push(linha.trim());

            linha = palavra + " ";

        } else {

            linha = teste;

        }

    }

    if (linha.trim() !== "") {

        linhas.push(linha.trim());

    }

    return linhas;

}

let linhas = quebrarTexto(

    ctx,

    produto.titulo,

    760

);

if (linhas.length > 3) {

    linhas = linhas.slice(0, 3);

    let ultima = linhas[2];

    while (

        ctx.measureText(ultima + "...").width >

        760

    ) {

        ultima = ultima.slice(0, -1);

    }

    linhas[2] = ultima.trim() + "...";

}

let yTexto = 955;

for (const linha of linhas) {

    ctx.fillText(

        linha,

        WIDTH / 2,

        yTexto

    );

    yTexto += 52;

}

ctx.fillStyle = "#6A00FF";

ctx.textAlign = "center";
ctx.textBaseline = "top";

ctx.font = "bold 72px Sans";

ctx.fillText(

    produto.preco,

    WIDTH / 2,

    1170

);

    return canvas.toBuffer("image/png");

}

module.exports = {

    gerarArte

};
