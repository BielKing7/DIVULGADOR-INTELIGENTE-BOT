
require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");

const {
    obterProdutoShopee,
    pesquisarProdutosShopee,
    ORDENACOES
} = require("./shopee");

const { gerarArte } = require("./canvas");

// =====================================================
// CONFIGURAÇÕES
// =====================================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_ID = process.env.SHOPEE_APP_ID;
const APP_SECRET = process.env.SHOPEE_SECRET;

const PORT = Number(process.env.PORT || 3000);

const MINI_APP_URL =
    "https://divulgador-inteligente-bot.onrender.com/vitrine.html";

if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
}

if (!APP_ID) {
    throw new Error("SHOPEE_APP_ID não configurado.");
}

if (!APP_SECRET) {
    throw new Error("SHOPEE_SECRET não configurado.");
}

if (
    !Number.isInteger(PORT) ||
    PORT < 1 ||
    PORT > 65535
) {
    throw new Error("PORT inválida.");
}

// O Telegram será iniciado depois do servidor HTTP.

const bot = new TelegramBot(BOT_TOKEN, {
    polling: false
});

const app = express();

app.use(express.json({
    limit: "16kb"
}));

// =====================================================
// PASTA PUBLIC COM P MAIÚSCULO
// =====================================================

const PASTA_PUBLIC = path.join(
    __dirname,
    "Public"
);

const ARQUIVO_VITRINE = path.join(
    PASTA_PUBLIC,
    "vitrine.html"
);

if (fs.existsSync(ARQUIVO_VITRINE)) {
    console.log(
        "✅ Arquivo Public/vitrine.html encontrado."
    );
} else {
    console.warn(
        "⚠️ Public/vitrine.html não encontrado."
    );
}

app.use(
    express.static(PASTA_PUBLIC)
);

// =====================================================
// ROTAS DE VERIFICAÇÃO
// =====================================================

app.get("/", (req, res) => {
    res.status(200).send(
        "🤖 Divulgador Inteligente Bot Online!"
    );
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "online",
        servico: "Divulgador Inteligente Bot",
        vitrine: fs.existsSync(ARQUIVO_VITRINE)
    });
});

// =====================================================
// CONTROLE DOS USUÁRIOS
// =====================================================

const usuarios = new Map();
const artesEmAndamento = new Set();

// =====================================================
// AUTENTICAÇÃO DO TELEGRAM MINI APP
// =====================================================

function autenticarMiniApp(req, res, next) {
    const initData = req.get(
        "X-Telegram-Init-Data"
    );

    if (!initData) {
        return res.status(401).json({
            erro: "Abra a vitrine pelo bot no Telegram."
        });
    }

    try {
        const parametros = new URLSearchParams(
            initData
        );

        const hashRecebido = parametros.get(
            "hash"
        );

        if (
            !hashRecebido ||
            !/^[a-f0-9]{64}$/i.test(hashRecebido)
        ) {
            throw new Error("Assinatura ausente.");
        }

        parametros.delete("hash");

        const dataCheckString = [
            ...parametros.entries()
        ]
            .sort((a, b) => {
                return a[0] < b[0]
                    ? -1
                    : a[0] > b[0]
                        ? 1
                        : 0;
            })
            .map(([chave, valor]) => {
                return `${chave}=${valor}`;
            })
            .join("\n");

        const chaveSecreta = crypto
            .createHmac("sha256", "WebAppData")
            .update(BOT_TOKEN)
            .digest();

        const hashCalculado = crypto
            .createHmac("sha256", chaveSecreta)
            .update(dataCheckString)
            .digest();

        const hashInformado = Buffer.from(
            hashRecebido,
            "hex"
        );

        if (
            hashInformado.length !==
            hashCalculado.length
        ) {
            throw new Error("Assinatura inválida.");
        }

        if (
            !crypto.timingSafeEqual(
                hashInformado,
                hashCalculado
            )
        ) {
            throw new Error("Assinatura inválida.");
        }

        const authDate = Number(
            parametros.get("auth_date")
        );

        const agora = Math.floor(
            Date.now() / 1000
        );

        if (
            !Number.isFinite(authDate) ||
            authDate > agora + 60 ||
            agora - authDate > 86400
        ) {
            throw new Error("Sessão expirada.");
        }

        const usuario = JSON.parse(
            parametros.get("user") || "{}"
        );

        if (
            !Number.isSafeInteger(usuario.id) ||
            usuario.id <= 0
        ) {
            throw new Error("Usuário inválido.");
        }

        req.usuarioTelegram = usuario;

        next();

    } catch (erro) {
        console.error(
            "Autenticação do Mini App:",
            erro.message
        );

        return res.status(401).json({
            erro:
                "Sessão inválida ou expirada. " +
                "Feche a vitrine e abra novamente pelo bot."
        });
    }
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

async function apagarMensagem(chatId, mensagem) {
    if (!mensagem) {
        return;
    }

    try {
        await bot.deleteMessage(
            chatId,
            mensagem.message_id
        );
    } catch (_) {
        // A mensagem pode já ter sido apagada.
    }
}

function criarLegendaArte(produto) {
    const titulo = String(
        produto.titulo || "Produto"
    ).slice(0, 650);

    return (
        "✅ Arte gerada com sucesso!\n\n" +
        `📦 ${titulo}\n\n` +
        `💰 ${produto.preco}\n\n` +
        `🔗 ${produto.linkAfiliado}`
    );
}

async function enviarArte(chatId, produto) {
    let mensagemProcessando;

    try {
        mensagemProcessando = await bot.sendMessage(
            chatId,
            "🎨 Gerando a arte do produto..."
        );

        const imagem = await gerarArte(produto);

        await bot.sendPhoto(
            chatId,
            imagem,
            {
                caption: criarLegendaArte(produto)
            }
        );

        await apagarMensagem(
            chatId,
            mensagemProcessando
        );

    } catch (erro) {
        console.error(
            "Erro ao gerar arte:",
            erro
        );

        await apagarMensagem(
            chatId,
            mensagemProcessando
        );

        try {
            await bot.sendMessage(
                chatId,
                "❌ Não foi possível gerar a arte. Tente novamente."
            );
        } catch (erroTelegram) {
            console.error(
                "Erro ao enviar aviso sobre a arte:",
                erroTelegram.message
            );
        }
    }
}

function criarUrlVitrine(termo = "") {
    const url = new URL(MINI_APP_URL);

    if (termo) {
        url.searchParams.set(
            "termo",
            termo
        );
    }

    return url.toString();
}

async function enviarBotaoVitrine(
    chatId,
    termo = ""
) {
    const texto = termo
        ? (
            `🛍️ Sua pesquisa: ${termo}\n\n` +
            "Toque no botão abaixo para visualizar os produtos."
        )
        : (
            "🛍️ Abra a vitrine para explorar produtos da Shopee."
        );

    await bot.sendMessage(
        chatId,
        texto,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "🛍️ Abrir vitrine",
                            web_app: {
                                url: criarUrlVitrine(termo)
                            }
                        }
                    ]
                ]
            }
        }
    );
}

// =====================================================
// VALIDAR FILTROS
// =====================================================

function lerPreco(valor, nome) {
    if (
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return null;
    }

    const preco = Number(valor);

    if (
        !Number.isFinite(preco) ||
        preco < 0
    ) {
        throw new Error(
            `${nome} inválido.`
        );
    }

    return preco;
}

function obterOpcoesPesquisa(query) {
    const ordenacao = String(
        query.ordenacao || "relevancia"
    );

    if (
        !Object.prototype.hasOwnProperty.call(
            ORDENACOES,
            ordenacao
        )
    ) {
        throw new Error(
            "Opção de ordenação inválida."
        );
    }

    const precoMinimo = lerPreco(
        query.precoMinimo,
        "Preço mínimo"
    );

    const precoMaximo = lerPreco(
        query.precoMaximo,
        "Preço máximo"
    );

    if (
        precoMinimo !== null &&
        precoMaximo !== null &&
        precoMinimo > precoMaximo
    ) {
        throw new Error(
            "O preço mínimo não pode ser maior que o máximo."
        );
    }

    const valorOficiais = String(
        query.somenteOficiais || "false"
    );

    if (
        valorOficiais !== "true" &&
        valorOficiais !== "false"
    ) {
        throw new Error(
            "Filtro de lojas oficiais inválido."
        );
    }

    return {
        ordenacao,
        precoMinimo,
        precoMaximo,
        somenteOficiais:
            valorOficiais === "true"
    };
}

// =====================================================
// API: PESQUISAR PRODUTOS
// =====================================================

app.get(
    "/api/produtos",
    autenticarMiniApp,
    async (req, res) => {
        const termo = String(
            req.query.termo || ""
        ).trim();

        const page = Number(
            req.query.page || 1
        );

        const limit = Number(
            req.query.limit || 20
        );

        if (
            !termo ||
            termo.length > 120
        ) {
            return res.status(400).json({
                erro:
                    "Digite um nome de produto válido."
            });
        }

        if (
            !Number.isSafeInteger(page) ||
            page < 1 ||
            page > 1000
        ) {
            return res.status(400).json({
                erro: "Número de página inválido."
            });
        }

        if (
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 50
        ) {
            return res.status(400).json({
                erro:
                    "Quantidade de produtos inválida."
            });
        }

        let opcoes;

        try {
            opcoes = obterOpcoesPesquisa(
                req.query
            );
        } catch (erro) {
            return res.status(400).json({
                erro: erro.message
            });
        }

        try {
            const resultado =
                await pesquisarProdutosShopee(
                    termo,
                    APP_ID,
                    APP_SECRET,
                    page,
                    limit,
                    opcoes
                );

            return res.json({
                produtos: resultado.produtos,
                pageInfo: resultado.pageInfo,
                ordenacao: resultado.ordenacao,
                filtros: opcoes
            });

        } catch (erro) {
            console.error(
                "Erro na pesquisa Shopee:",
                erro
            );

            return res.status(502).json({
                erro:
                    "Não foi possível buscar os produtos na Shopee. Tente novamente."
            });
        }
    }
);

// =====================================================
// API: GERAR ARTE
// =====================================================

app.post(
    "/api/gerar-arte",
    autenticarMiniApp,
    async (req, res) => {
        const chatId = req.usuarioTelegram.id;

        const shopId = String(
            req.body?.shopId || ""
        );

        const itemId = String(
            req.body?.itemId || ""
        );

        if (
            !/^\d{1,20}$/.test(shopId) ||
            !/^\d{1,20}$/.test(itemId) ||
            shopId === "0" ||
            itemId === "0"
        ) {
            return res.status(400).json({
                erro:
                    "Identificação do produto inválida."
            });
        }

        if (
            artesEmAndamento.has(chatId)
        ) {
            return res.status(429).json({
                erro:
                    "Aguarde a arte anterior terminar antes de selecionar outro produto."
            });
        }

        artesEmAndamento.add(chatId);

        res.status(202).json({
            sucesso: true,
            mensagem:
                "Sua arte está sendo preparada."
        });

        try {
            const linkProduto =
                `https://shopee.com.br/product/${shopId}/${itemId}`;

            const produto =
                await obterProdutoShopee(
                    linkProduto,
                    APP_ID,
                    APP_SECRET
                );

            await enviarArte(
                chatId,
                produto
            );

        } catch (erro) {
            console.error(
                "Erro ao processar produto selecionado:",
                erro
            );

            try {
                await bot.sendMessage(
                    chatId,
                    "❌ Não foi possível buscar o produto selecionado. Tente novamente."
                );
            } catch (erroTelegram) {
                console.error(
                    "Erro ao enviar aviso:",
                    erroTelegram.message
                );
            }

        } finally {
            artesEmAndamento.delete(chatId);
        }
    }
);

// =====================================================
// COMANDO /START
// =====================================================

bot.onText(
    /^\/start(?:@\w+)?$/,
    async (msg) => {
        const chatId = msg.chat.id;

        await bot.sendMessage(
            chatId,

`👋 Olá!

Eu sou o *Divulgador Inteligente Bot*.

Transformo produtos da Shopee em artes prontas para publicar nos Stories do Instagram.

📌 *Comandos disponíveis:*

🔗 /story
Envie o link de um produto para gerar sua arte.

🛍️ /pesquisar
Pesquise produtos na nossa vitrine interativa.

✨ Escolha seus produtos e gere suas artes automaticamente!`,

            {
                parse_mode: "Markdown"
            }
        );

        if (
            msg.chat.type === "private"
        ) {
            await enviarBotaoVitrine(chatId);
        }
    }
);

// =====================================================
// COMANDO /STORY
// =====================================================

bot.onText(
    /^\/story(?:@\w+)?$/,
    async (msg) => {
        const chatId = msg.chat.id;

        usuarios.set(chatId, {
            modo: "aguardandoLink"
        });

        await bot.sendMessage(
            chatId,
            "🔗 Agora envie o link do produto da Shopee."
        );
    }
);

// =====================================================
// COMANDO /PESQUISAR
// =====================================================

bot.onText(
    /^\/pesquisar(?:@\w+)?$/,
    async (msg) => {
        const chatId = msg.chat.id;

        if (
            msg.chat.type !== "private"
        ) {
            await bot.sendMessage(
                chatId,
                "🛍️ Abra uma conversa privada comigo para utilizar a vitrine."
            );

            return;
        }

        usuarios.set(chatId, {
            modo: "aguardandoPesquisa"
        });

        await bot.sendMessage(
            chatId,
            "🔎 Qual produto você deseja pesquisar?\n\nExemplo: PlayStation 5"
        );
    }
);

// =====================================================
// RECEBIMENTO DE MENSAGENS
// =====================================================

bot.on(
    "message",
    async (msg) => {
        const chatId = msg.chat.id;

        if (!msg.text) {
            return;
        }

        if (
            msg.text.startsWith("/")
        ) {
            return;
        }

        const estado = usuarios.get(chatId);

        if (!estado) {
            return;
        }

        const texto = msg.text.trim();

        // PESQUISA PELO NOME

        if (
            estado.modo ===
            "aguardandoPesquisa"
        ) {
            if (
                !texto ||
                texto.length > 120
            ) {
                await bot.sendMessage(
                    chatId,
                    "❌ Digite o nome de um produto com até 120 caracteres."
                );

                return;
            }

            usuarios.delete(chatId);

            await enviarBotaoVitrine(
                chatId,
                texto
            );

            return;
        }

        // GERAÇÃO PELO LINK

        if (
            estado.modo !==
            "aguardandoLink"
        ) {
            return;
        }

        if (
            !texto.startsWith("https://") &&
            !texto.startsWith("http://")
        ) {
            await bot.sendMessage(
                chatId,
                "❌ Envie um link válido da Shopee."
            );

            return;
        }

        estado.modo = "processandoLink";

        let mensagemProcessando;

        try {
            mensagemProcessando =
                await bot.sendMessage(
                    chatId,
                    "🔄 Buscando informações do produto..."
                );

            const produto =
                await obterProdutoShopee(
                    texto,
                    APP_ID,
                    APP_SECRET
                );

            await apagarMensagem(
                chatId,
                mensagemProcessando
            );

            mensagemProcessando = null;

            await enviarArte(
                chatId,
                produto
            );

        } catch (erro) {
            console.error(
                "Erro ao buscar produto pelo link:",
                erro
            );

            await apagarMensagem(
                chatId,
                mensagemProcessando
            );

            await bot.sendMessage(
                chatId,
                "❌ Ocorreu um erro ao buscar o produto.\n\nVerifique se o link é válido e tente novamente."
            );

        } finally {
            if (
                usuarios.get(chatId) === estado
            ) {
                usuarios.delete(chatId);
            }
        }
    }
);

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

bot.on(
    "polling_error",
    (erro) => {
        console.error(
            "❌ Polling Error:",
            erro.message
        );
    }
);

bot.on(
    "error",
    (erro) => {
        console.error(
            "❌ Telegram Bot Error:",
            erro.message
        );
    }
);

process.on(
    "unhandledRejection",
    (erro) => {
        console.error(
            "❌ Unhandled Rejection:",
            erro
        );
    }
);

process.on(
    "uncaughtException",
    (erro) => {
        console.error(
            "❌ Uncaught Exception:",
            erro
        );

        process.exit(1);
    }
);

// =====================================================
// INICIAR POLLING DO TELEGRAM
// =====================================================

async function iniciarTelegram() {
    try {
        console.log(
            "🔄 Iniciando polling do Telegram..."
        );

        await bot.startPolling();

        console.log(
            "✅ Polling do Telegram iniciado."
        );

    } catch (erro) {
        console.error(
            "❌ Falha ao iniciar o Telegram:",
            erro
        );
    }
}

// =====================================================
// INICIAR SERVIDOR HTTP
// =====================================================

console.log(
    "🔎 Chegou à inicialização do servidor HTTP."
);

const servidor = app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            "========================================"
        );

        console.log(
            "🤖 Divulgador Inteligente Bot"
        );

        console.log(
            "========================================"
        );

        console.log(
            `✅ Servidor HTTP iniciado na porta ${PORT}`
        );

        console.log(
            "🌐 Servidor escutando em 0.0.0.0"
        );

        console.log(
            fs.existsSync(ARQUIVO_VITRINE)
                ? "✅ Mini App: Public/vitrine.html encontrado."
                : "⚠️ Mini App: Public/vitrine.html não encontrado."
        );

        console.log(
            "✅ API da Shopee configurada."
        );

        console.log(
            "✅ Rotas de pesquisa e filtros registradas."
        );

        console.log(
            "========================================"
        );

        iniciarTelegram();
    }
);

servidor.on(
    "error",
    (erro) => {
        console.error(
            "❌ Erro ao abrir a porta HTTP:",
            erro
        );

        process.exit(1);
    }
);
