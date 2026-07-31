const axios = require("axios");
const crypto = require("crypto");

const GRAPHQL_URL =
    "https://open-api.affiliate.shopee.com.br/graphql";

function getTimestamp() {

    return Math.floor(Date.now() / 1000);

}

function gerarAssinatura(appId, secret, timestamp, payload) {

    const fator =
        appId +
        timestamp +
        payload +
        secret;

    return crypto
        .createHash("sha256")
        .update(fator)
        .digest("hex");

}

function gerarAuthorization(appId, secret, payload) {

    if (!appId) {
        throw new Error("SHOPEE_APP_ID não configurado.");
    }

    if (!secret) {
        throw new Error("SHOPEE_SECRET não configurado.");
    }

    const timestamp = getTimestamp();

    const signature = gerarAssinatura(
        appId,
        secret,
        timestamp,
        payload
    );

    return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;

}

async function expandirLink(url) {

    if (
        url.includes("/product/") ||
        url.includes("-i.")
    ) {
        return url;
    }

    try {

        const resposta = await axios.head(url, {

            maxRedirects: 0,

            timeout: 10000,

            validateStatus(status) {
                return status >= 200 && status < 400;
            }

        });

        if (resposta.headers.location) {
            return resposta.headers.location;
        }

    } catch (_) {}

    try {

        const resposta = await axios.get(url, {

            maxRedirects: 0,

            timeout: 10000,

            validateStatus(status) {
                return status >= 200 && status < 400;
            }

        });

        if (resposta.headers.location) {
            return resposta.headers.location;
        }

    } catch (_) {}

    return url;

}

function extrairIds(url) {

    let match = url.match(/product\/(\d+)\/(\d+)/);

    if (match) {

        return {

            shopId: Number(match[1]),

            itemId: Number(match[2])

        };

    }

    match = url.match(/-i\.(\d+)\.(\d+)/);

    if (match) {

        return {

            shopId: Number(match[1]),

            itemId: Number(match[2])

        };

    }

    throw new Error(
        "Não foi possível localizar o ShopId e o ItemId no link informado."
    );

}

async function buscarProduto(appId, secret, shopId, itemId) {

    if (!shopId || !itemId) {
        throw new Error("ShopId ou ItemId inválidos.");
    }

    const body = {

        query: `
        {
            productOfferV2(
                shopId: ${shopId},
                itemId: ${itemId}
            ) {
                nodes {
                    itemId
                    shopId
                    productName
                    imageUrl
                    price
                    priceMin
                    priceMax
                    sales
                    ratingStar
                    shopName
                    offerLink
                    productLink
                    commission
                    commissionRate
                }
            }
        }`

    };

    const payload = JSON.stringify(body);

    const authorization = gerarAuthorization(
        appId,
        secret,
        payload
    );

    let resposta;

    try {

        resposta = await axios.post(

            GRAPHQL_URL,

            payload,

            {

                timeout: 15000,

                headers: {

                    "Content-Type": "application/json",

                    Authorization: authorization

                }

            }

        );

    } catch (erro) {

        if (erro.response) {

            throw new Error(

                `Erro da API Shopee: ${erro.response.status}`

            );

        }

        throw new Error(

            "Não foi possível conectar à API da Shopee."

        );

    }

    if (resposta.data.errors) {

        throw new Error(

            resposta.data.errors[0].message

        );

    }

    const produto =
        resposta.data?.data?.productOfferV2?.nodes?.[0];

    if (!produto) {

        throw new Error("Produto não encontrado.");

    }

    return produto;

}

async function obterProdutoShopee(link, appId, secret) {

    if (!link) {
        throw new Error("Nenhum link foi informado.");
    }

    const linkExpandido = await expandirLink(link);

    const { shopId, itemId } = extrairIds(linkExpandido);

    const produto = await buscarProduto(
        appId,
        secret,
        shopId,
        itemId
    );

    const precoNumero = Number(produto.price || 0);

    const precoFormatado = precoNumero.toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );

    return {

        shopId,

        itemId,

        titulo: produto.productName,

        imagem: produto.imageUrl,

        preco: precoFormatado,

        precoNumero,

        loja: produto.shopName,

        vendas: produto.sales,

        avaliacao: produto.ratingStar,

        linkAfiliado: produto.offerLink,

        linkProduto: produto.productLink,

        comissao: produto.commission,

        taxaComissao: produto.commissionRate

    };

}

module.exports = {

    obterProdutoShopee

};
