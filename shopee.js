
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

async function consultarShopee(body, appId, secret) {
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
            const mensagemApi =
                erro.response.data?.errors?.[0]?.message;

            throw new Error(
                mensagemApi ||
                `Erro da API Shopee: ${erro.response.status}`
            );
        }

        throw new Error(
            "Não foi possível conectar à API da Shopee."
        );
    }

    if (resposta.data?.errors?.length) {
        throw new Error(
            resposta.data.errors[0].message ||
            "A Shopee retornou um erro na consulta."
        );
    }

    return resposta.data?.data;
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

    const dados = await consultarShopee(
        body,
        appId,
        secret
    );

    const produto =
        dados?.productOfferV2?.nodes?.[0];

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

async function pesquisarProdutosShopee(
    termo,
    appId,
    secret,
    page = 1,
    limit = 5
) {
    if (
        typeof termo !== "string" ||
        !termo.trim()
    ) {
        throw new Error(
            "Digite o nome do produto que deseja pesquisar."
        );
    }

    if (
        !Number.isInteger(page) ||
        page < 1
    ) {
        throw new Error(
            "O número da página deve ser um inteiro maior que zero."
        );
    }

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50
    ) {
        throw new Error(
            "A quantidade de produtos deve estar entre 1 e 50."
        );
    }

    const palavraChave = termo.trim();

    const keyword = JSON.stringify(palavraChave);

    const body = {
        query: `
        {
            productOfferV2(
                keyword: ${keyword},
                page: ${page},
                limit: ${limit}
            ) {
                nodes {
                    itemId
                    shopId
                    productName
                    imageUrl
                    price
                    priceMin
                    priceMax
                    shopName
                    offerLink
                    productLink
                    sales
                    ratingStar
                    commission
                    commissionRate
                }
                pageInfo {
                    page
                    limit
                    hasNextPage
                    scrollId
                }
            }
        }`
    };

    const dados = await consultarShopee(
        body,
        appId,
        secret
    );

    const resultado = dados?.productOfferV2;

    if (!resultado) {
        throw new Error(
            "A Shopee retornou uma resposta inválida."
        );
    }

    const produtos = (resultado.nodes || [])
        .filter(produto => {
            const preco = Number(produto.price);

            return (
                produto.productName &&
                produto.imageUrl &&
                produto.offerLink &&
                Number.isFinite(preco) &&
                preco > 0
            );
        })
        .map(produto => {
            const precoNumero = Number(produto.price);

            const precoFormatado =
                precoNumero.toLocaleString(
                    "pt-BR",
                    {
                        style: "currency",
                        currency: "BRL"
                    }
                );

            return {
                shopId: produto.shopId,
                itemId: produto.itemId,
                titulo: produto.productName,
                imagem: produto.imageUrl,
                preco: precoFormatado,
                precoNumero,
                precoMin: produto.priceMin,
                precoMax: produto.priceMax,
                loja: produto.shopName,
                vendas: produto.sales,
                avaliacao: produto.ratingStar,
                linkAfiliado: produto.offerLink,
                linkProduto: produto.productLink,
                comissao: produto.commission,
                taxaComissao: produto.commissionRate
            };
        });

    const paginaRetornada =
        resultado.pageInfo?.page ?? page;

    const limiteRetornado =
        resultado.pageInfo?.limit ?? limit;

    const temProximaPagina =
        resultado.pageInfo?.hasNextPage === true;

    return {
        termo: palavraChave,

        produtos,

        pageInfo: {
            page: paginaRetornada,
            limit: limiteRetornado,
            hasNextPage: temProximaPagina,
            hasPreviousPage: paginaRetornada > 1,
            scrollId: resultado.pageInfo?.scrollId ?? null
        }
    };
}

module.exports = {
    obterProdutoShopee,
    pesquisarProdutosShopee
};
