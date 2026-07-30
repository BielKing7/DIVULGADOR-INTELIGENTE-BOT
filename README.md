# 🤖 Divulgador Inteligente Bot

Bot do Telegram que gera automaticamente artes para Story do Instagram usando a API Oficial da Shopee.

## ✨ Funcionalidades

- 📦 Obtém informações do produto pela API Oficial da Shopee.
- 🖼️ Gera uma arte personalizada utilizando uma arte fixa.
- 💰 Exibe o preço do produto.
- 📝 Exibe o título do produto.
- 🔗 Utiliza o link de afiliado da Shopee.
- 🤖 Funciona através do Telegram.
- ☁️ Compatível com Render.

---

## 📁 Estrutura do Projeto

```
assets/
 └── arte.png

canvas.js
index.js
shopee.js
package.json
README.md
.gitignore
```

---

## 🚀 Instalação

Clone o repositório:

```bash
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
```

Entre na pasta:

```bash
cd SEU-REPOSITORIO
```

Instale as dependências:

```bash
npm install
```

Inicie o projeto:

```bash
npm start
```

---

## 🔐 Variáveis de Ambiente (Render)

Configure as seguintes variáveis no painel do Render:

| Variável | Descrição |
|----------|-----------|
| TELEGRAM_BOT_TOKEN | Token do Bot do Telegram |
| SHOPEE_APP_ID | App ID da Shopee |
| SHOPEE_SECRET | Secret da Shopee |

---

## 📷 Arte

A arte utilizada pelo bot deve estar em:

```
assets/arte.png
```

Ela será usada como fundo para gerar automaticamente a arte final.

---

## 📦 Tecnologias

- Node.js
- Express
- Canvas
- Axios
- Telegram Bot API
- Shopee Affiliate Open API

---

## 👨‍💻 Autor

Gabriel Lima

---

## 📄 Licença

Este projeto utiliza a licença MIT.
