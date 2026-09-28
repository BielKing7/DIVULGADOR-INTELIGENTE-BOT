require("dotenv").config();

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const {
    obterProdutoShopee,
    pesquisarProdutosShopee
} = require("./shopee");

const { gerarArte } = require("./canvas");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_ID = process.env.SHOPEE_APP_ID;
const APP_SECRET = process.env.SHOPEE_SECRET;

if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
}

if (!APP_ID) {
    throw new Error("SHOPEE_APP_ID não configurado.");
}

if (!APP_SECRET) {
    throw new Error("SHOPEE_SECRET não configurado.");
}

const bot = new TelegramBot(BOT_TOKEN, {
    polling: true
});

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("🤖 Divulgador Inteligente Bot Online!");
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});

const PRODUTOS_POR_PAGINA = 5;

const usuarios = new Map();

let proximoIdPesquisa = 1;

function criarIdPesquisa() {
    return (proximoIdPesquisa++).toString(36);
}

function montarLegendaCarrossel(pesquisa) {
    const produto = pesquisa.produtos[pesquisa.indice];

    const termo = String(pesquisa.termo || "")
        .slice(0, 80);

    const titulo = String(produto.titulo || "Produto")
        .slice(0, 500);

    const loja = String(produto.loja || "Não informada")
        .slice(0, 100);

    return (
        `🛍️ Resultados para: ${termo}\n` +
        `📄 Produto ${pesquisa.indice + 1} de ${pesquisa.produtos.length} • Página ${pesquisa.pagina}\n\n` +
        `📦 ${titulo}\n\n` +
        `💰 ${produto.preco}\n` +
        `🏪 ${loja}`
    ).slice(0, 1024);
}

function montarBotoesCarrossel(pesquisa) {
    const { id, pagina, indice, produtos } = pesquisa;

    const teclado = [
        [
            {
                text: "🎨 Selecionar produto",
                callback_data: `produto:${id}:${pagina}:${indice}`
            }
        ]
    ];

    const linhaProdutos = [];

    if (indice > 0) {
        linhaProdutos.push({
            text: "⬅️ Anterior",
            callback_data: `nav:${id}:${pagina}:${indice - 1}`
        });
    }

    if (indice < produtos.length - 1) {
        linhaProdutos.push({
            text: "Próximo ➡️",
            callback_data: `nav:${id}:${pagina}:${indice + 1}`
        });
    }

    if (linhaProdutos.length > 0) {
        teclado.push(linhaProdutos);
    }

    const linhaPaginas = [];

    if (pagina > 1) {
        linhaPaginas.push({
            text: "📄 Página anterior",
            callback_data: `pagina:${id}:${pagina - 1}`
        });
    }

    if (pesquisa.temProximaPagina) {
        linhaPaginas.push({
            text: "📄 Próxima página",
            callback_data: `pagina:${id}:${pagina + 1}`
        });
    }

    if (linhaPaginas.length > 0) {
        teclado.push(linhaPaginas);
    }

    return {
        inline_keyboard: teclado
    };
}

async function apagarMensagem(chatId, mensagem) {
    if (!mensagem) return;

    try {
        await bot.deleteMessage(
            chatId,
            mensagem.message_id
        );
    } catch (_) {}
}

async function exibirProduto(chatId, pesquisa) {
    const produto = pesquisa.produtos[pesquisa.indice];
    const legenda = montarLegendaCarrossel(pesquisa);
    const botoes = montarBotoesCarrossel(pesquisa);

    if (
        pesquisa.mensagemId &&
        pesquisa.mensagemTipo === "foto"
    ) {
        try {
            await bot.editMessageMedia(
                {
                    type: "photo",
                    media: produto.imagem,
                    caption: legenda
                },
                {
                    chat_id: chatId,
                    message_id: pesquisa.mensagemId
                }
            );

            await bot.editMessageReplyMarkup(
                botoes,
                {
                    chat_id: chatId,
                    message_id: pesquisa.mensagemId
                }
            );

            return;

        } catch (erro) {
            if (
                String(erro.message)
                    .includes("message is not modified")
            ) {
                return;
            }

            console.error(
                "Erro ao editar o carrossel:",
                erro.message
            );
        }
    }

    if (pesquisa.mensagemId) {
        try {
            await bot.deleteMessage(
                chatId,
                pesquisa.mensagemId
            );
        } catch (_) {}

        pesquisa.mensagemId = null;
    }

    try {
        const enviada = await bot.sendPhoto(
            chatId,
            produto.imagem,
            {
                caption: legenda,
                reply_markup: botoes
            }
        );

        pesquisa.mensagemId = enviada.message_id;
        pesquisa.mensagemTipo = "foto";

    } catch (erroFoto) {
        console.error(
            "Erro ao enviar foto do produto:",
            erroFoto.message
        );

        const enviada = await bot.sendMessage(
            chatId,
            legenda,
            {
                reply_markup: botoes
            }
        );

        pesquisa.mensagemId = enviada.message_id;
        pesquisa.mensagemTipo = "texto";
    }
}

async function enviarArte(chatId, produto) {
    let mensagemProcessando;

    try {
        mensagemProcessando = await bot.sendMessage(
            chatId,
            "🎨 Gerando a arte do produto..."
        );

        const imagem = await gerarArte(produto);

        const titulo = String(produto.titulo || "Produto")
            .slice(0, 650);

        const legenda =
            `✅ Arte gerada com sucesso!\n\n` +
            `📦 ${titulo}\n\n` +
            `💰 ${produto.preco}\n\n` +
            `🔗 ${produto.linkAfiliado}`;

        await apagarMensagem(
            chatId,
            mensagemProcessando
        );

        mensagemProcessando = null;

        await bot.sendPhoto(
            chatId,
            imagem,
            {
                caption: legenda
            }
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

        await bot.sendMessage(
            chatId,
            "❌ Não foi possível gerar a arte desse produto. Tente novamente."
        );
    }
}

async function mostrarPagina(chatId, pesquisa, pagina) {
    if (pesquisa.carregando) {
        return;
    }

    pesquisa.carregando = true;

    let mensagemProcessando;

    try {
        if (!pesquisa.mensagemId) {
            mensagemProcessando = await bot.sendMessage(
                chatId,
                `🔎 Buscando produtos...\n\n📄 Página ${pagina}`
            );
        }

        const resultado = await pesquisarProdutosShopee(
            pesquisa.termo,
            APP_ID,
            APP_SECRET,
            pagina,
            PRODUTOS_POR_PAGINA
        );

        if (usuarios.get(chatId) !== pesquisa) {
            await apagarMensagem(
                chatId,
                mensagemProcessando
            );

            return;
        }

        const produtos = resultado.produtos;

        await apagarMensagem(
            chatId,
            mensagemProcessando
        );

        mensagemProcessando = null;

        if (produtos.length === 0) {
            await bot.sendMessage(
                chatId,
                "😕 Nenhum produto encontrado nesta página.\n\nTente outra pesquisa com /pesquisar."
            );

            return;
        }

        pesquisa.produtos = produtos;
        pesquisa.pagina = resultado.pageInfo.page;
        pesquisa.temProximaPagina =
            resultado.pageInfo.hasNextPage;
        pesquisa.indice = 0;

        await exibirProduto(
            chatId,
            pesquisa
        );

    } catch (erro) {
        console.error(
            "Erro na pesquisa:",
            erro
        );

        await apagarMensagem(
            chatId,
            mensagemProcessando
        );

        if (usuarios.get(chatId) === pesquisa) {
            await bot.sendMessage(
                chatId,
                "❌ Não foi possível buscar os produtos na Shopee.\n\nTente novamente em alguns instantes."
            );
        }

    } finally {
        pesquisa.carregando = false;
    }
}

bot.onText(/^\/start(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;

    await bot.sendMessage(
        chatId,

`👋 Olá!

Eu sou o *Divulgador Inteligente Bot*.

Transformo produtos da Shopee em artes prontas para publicar nos Stories do Instagram.

📌 *Escolha como deseja começar:*

🔗 /story
Envie o link de um produto da Shopee para gerar sua arte.

🔎 /pesquisar
Pesquise produtos pelo nome, veja fotos e preços e escolha qual deseja divulgar.

✨ A arte será gerada automaticamente!`,

        {
            parse_mode: "Markdown"
        }
    );
});

bot.onText(/^\/story(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;

    usuarios.set(chatId, {
        modo: "aguardandoLink"
    });

    await bot.sendMessage(
        chatId,
        "🔗 Agora envie o link do produto da Shopee."
    );
});

bot.onText(/^\/pesquisar(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;

    usuarios.set(chatId, {
        modo: "aguardandoPesquisa"
    });

    await bot.sendMessage(
        chatId,
        "🔎 Qual produto você deseja pesquisar?\n\nExemplo: PlayStation 5"
    );
});

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;

    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;

    const estado = usuarios.get(chatId);

    if (!estado) return;

    const texto = msg.text.trim();

    if (estado.modo === "aguardandoPesquisa") {
        if (!texto) {
            await bot.sendMessage(
                chatId,
                "❌ Digite o nome de um produto."
            );

            return;
        }

        const pesquisa = {
            modo: "pesquisa",
            id: criarIdPesquisa(),
            termo: texto,
            pagina: 1,
            indice: 0,
            produtos: [],
            temProximaPagina: false,
            carregando: false,
            gerandoArte: false,
            mensagemId: null,
            mensagemTipo: null
        };

        usuarios.set(chatId, pesquisa);

        await mostrarPagina(
            chatId,
            pesquisa,
            1
        );

        return;
    }

    if (estado.modo !== "aguardandoLink") {
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
        mensagemProcessando = await bot.sendMessage(
            chatId,
            "🔄 Buscando informações do produto..."
        );

        const produto = await obterProdutoShopee(
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
        if (usuarios.get(chatId) === estado) {
            usuarios.delete(chatId);
        }
    }
});

bot.on("callback_query", async (consulta) => {
    const chatId = consulta.message?.chat?.id;

    if (!chatId) {
        await bot.answerCallbackQuery(consulta.id);
        return;
    }

    const dados = String(consulta.data || "");
    const partes = dados.split(":");

    const acao = partes[0];
    const idPesquisa = partes[1];

    const pesquisa = usuarios.get(chatId);

    if (
        !pesquisa ||
        pesquisa.modo !== "pesquisa" ||
        pesquisa.id !== idPesquisa
    ) {
        await bot.answerCallbackQuery(
            consulta.id,
            {
                text: "Esta pesquisa expirou. Digite /pesquisar novamente.",
                show_alert: true
            }
        );

        return;
    }

    if (acao === "nav") {
        const pagina = Number(partes[2]);
        const indice = Number(partes[3]);

        if (
            pagina !== pesquisa.pagina ||
            !Number.isInteger(indice) ||
            indice < 0 ||
            indice >= pesquisa.produtos.length
        ) {
            await bot.answerCallbackQuery(
                consulta.id,
                {
                    text: "Este resultado não está mais ativo. Faça uma nova pesquisa.",
                    show_alert: true
                }
            );

            return;
        }

        if (pesquisa.carregando) {
            await bot.answerCallbackQuery(
                consulta.id,
                {
                    text: "Aguarde um instante."
                }
            );

            return;
        }

        await bot.answerCallbackQuery(consulta.id);

        pesquisa.carregando = true;

        try {
            pesquisa.indice = indice;

            await exibirProduto(
                chatId,
                pesquisa
            );
        } catch (erro) {
            console.error(
                "Erro ao navegar entre produtos:",
                erro
            );
        } finally {
            pesquisa.carregando = false;
        }

        return;
    }

    if (acao === "pagina") {
        const pagina = Number(partes[2]);

        if (
            !Number.isInteger(pagina) ||
            pagina < 1 ||
            pagina > pesquisa.pagina + 1 ||
            (
                pagina > pesquisa.pagina &&
                !pesquisa.temProximaPagina
            )
        ) {
            await bot.answerCallbackQuery(
                consulta.id,
                {
                    text: "Página indisponível."
                }
            );

            return;
        }

        if (pesquisa.carregando) {
            await bot.answerCallbackQuery(
                consulta.id,
                {
                    text: "Aguarde a pesquisa atual terminar."
                }
            );

            return;
        }

        await bot.answerCallbackQuery(
            consulta.id,
            {
                text: `Carregando página ${pagina}...`
            }
        );

        await mostrarPagina(
            chatId,
            pesquisa,
            pagina
        );

        return;
    }

    if (acao === "produto") {
        const pagina = Number(partes[2]);
        const indice = Number(partes[3]);

        if (
            pagina !== pesquisa.pagina ||
            !Number.isInteger(indice) ||
            indice < 0 ||
            indice >= pesquisa.produtos.length
        ) {
            await bot.answerCallbackQuery(
                consulta.id,
                {
                    text: "Este resultado não está mais ativo. Faça uma nova pesquisa.",
                    show_alert: true
                }
            );

            return;
        }

        if (
            pesquisa.carregando ||
            pesquisa.gerandoArte
        ) {
            await bot.answerCallbackQuery(
                consulta.id,
                {
                    text: "Aguarde a operação atual terminar."
                }
            );

            return;
        }

        const produto = pesquisa.produtos[indice];

        pesquisa.gerandoArte = true;

        await bot.answerCallbackQuery(
            consulta.id,
            {
                text: "🎨 Preparando sua arte!"
            }
        );

        try {
            await enviarArte(
                chatId,
                produto
            );
        } finally {
            pesquisa.gerandoArte = false;
        }

        return;
    }

    await bot.answerCallbackQuery(
        consulta.id,
        {
            text: "Ação desconhecida."
        }
    );
});

bot.on("polling_error", (erro) => {
    console.error(
        "Polling Error:",
        erro.message
    );
});

process.on("unhandledRejection", (erro) => {
    console.error(
        "Unhandled Rejection:",
        erro
    );
});

process.on("uncaughtException", (erro) => {
    console.error(
        "Uncaught Exception:",
        erro
    );
});

console.log("========================================");
console.log("🤖 Divulgador Inteligente Bot");
console.log("========================================");
console.log("✅ Bot do Telegram iniciado.");
console.log("✅ API Oficial da Shopee configurada.");
console.log("✅ Pesquisa de produtos habilitada.");
console.log("✅ Canvas carregado.");
console.log("✅ Servidor Express iniciado.");
console.log("========================================");
