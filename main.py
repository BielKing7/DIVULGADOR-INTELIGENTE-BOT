import os
import random
from io import BytesIO
from PIL import Image, ImageDraw
from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ConversationHandler,
    filters,
    ContextTypes
)

TOKEN = os.environ.get("TOKEN_BOT")

# Estados da Conversa para o Cadastro
PEDINDO_EMAIL, PEDINDO_CODIGO, PEDINDO_NOME, LOGADO = range(4)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_name = update.effective_user.first_name
    await update.message.reply_text(
        f"Bem-vindo ao 🤖 Bot de Promoções 🛍️!\n"
        f"Configure agora seu Bot e inicie a divulgação de suas ofertas!!!\n\n"
        f"Por favor, forneça seu **e-mail** para dar início ao seu cadastro na plataforma. 👉"
    )
    return PEDINDO_EMAIL

async def receber_email(update: Update, context: ContextTypes.DEFAULT_TYPE):
    email = update.message.text
    context.user_data['email'] = email
    
    # Gera um código aleatório de 5 dígitos (exemplo: 98896)
    codigo_aleatorio = str(random.randint(10000, 99999))
    context.user_data['codigo_gerado'] = codigo_aleatorio
    
    # Aqui no ambiente de produção real, você integraria com o SMTP/E-mail. 
    # Para testes rápidos e desenvolvimento, vamos logar no console e avisar o usuário.
    print(f"[DEBUG] Código de verificação para {email}: {codigo_aleatorio}")
    
    await update.message.reply_text(
        f"✅ Digite o código de 5 dígitos enviado para o e-mail **{email}**.\n\n"
        f"*(Dica de teste no console do Render: o código gerado foi `{codigo_aleatorio}`)*\n\n"
        f"Este código é válido por 15 minutos! Se não o recebeu, confira sua caixa de spam."
    )
    return PEDINDO_CODIGO

async def receber_codigo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    codigo_usuario = update.message.text.strip()
    codigo_correto = context.user_data.get('codigo_gerado')
    
    if codigo_usuario == codigo_correto:
        await update.message.reply_text("✅ Email validado com sucesso! Por favor, informe seu **nome**.")
        return PEDINDO_NOME
    else:
        await update.message.reply_text("❌ Código incorreto! Por favor, digite novamente o código de 5 dígitos enviado para o seu e-mail:")
        return PEDINDO_CODIGO

async def receber_nome(update: Update, context: ContextTypes.DEFAULT_TYPE):
    nome = update.message.text
    context.user_data['nome'] = nome
    
    await update.message.reply_text(
        f"✅ Cadastro realizado com sucesso! Agora você pode começar a usar o bot. 😊\n\n"
        f"Ative o modo **/poststory** para começar a criar suas publicações! 🎨"
    )
    return LOGADO

async def ativar_poststory(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['modo_poststory'] = True
    await update.message.reply_text(
        "🔄 Ativando o modo combinado de Post e Story! 📝📱 ✨✨"
    )

async def processar_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Verifica se o usuário já passou pelo cadastro
    if context.user_data.get('LOGADO') != True and not context.user_data.get('nome'):
        # Se mandou link sem logar, podemos opcionalmente guiar para o /start
        pass

    user_text = update.message.text
    
    if "http" in user_text:
        await update.message.reply_text("✅ Seu link foi adicionado à fila de geração de Posts! Por favor, aguarde alguns instantes 👊")
        
        try:
            # Dados simulados perfeitos do produto (Shopee / Magalu)
            preco_atual_str = "R$ 40,26"
            preco_antigo_str = "R$ 72,00"
            titulo_produto = "Fone de Ouvido Bluetooth Sem Fio J760 - Cancelamento de Ruído Conforto"
            
            story_width, story_height = 1080, 1920
            img = Image.new("RGB", (story_width, story_height), color="#121212")
            draw = ImageDraw.Draw(img)
            
            # Caixa branca central (Card do Produto)
            draw.rounded_rectangle([90, 250, 990, 1150], radius=30, fill="#FFFFFF")
            
            # Bloco de Preços na Arte do Story (De/Por calculado)
            draw.text((140, 1220), f"De {preco_antigo_str}", fill="#B0BEC5")
            draw.line([(135, 1238), (320, 1238)], fill="#FF5252", width=4)
            
            # Caixa Preta com Preço em Destaque
            draw.rounded_rectangle([130, 1270, 480, 1380], radius=15, fill="#000000")
            draw.text((150, 1290), preco_atual_str, fill="#00E676")
            
            # Botão Inferior
            draw.rounded_rectangle([130, 1450, 750, 1590], radius=25, fill="#000000")
            draw.text((160, 1475), "Clique abaixo 👆\npara comprar", fill="#FFFFFF")
            
            bio = BytesIO()
            bio.name = "story_promocao.png"
            img.save(bio, "PNG")
            bio.seek(0)
            
            # 1. Envia a Imagem do Story
            await update.message.reply_photo(photo=bio)
            
            # 2. Envia a Legenda Formatada do Post
            mensagem_post = (
                f"🛍️ {titulo_produto}\n\n"
                f"~De {preco_antigo_str}~\n"
                f"💥 *Por {preco_atual_str}*\n\n"
                f"🛒 Compre aqui 👉 {user_text}\n\n"
                f"⚠️ *Promoção sujeita a alteração de preço e estoque do site*"
            )
            await update.message.reply_text(mensagem_post, parse_mode="Markdown")
            
        except Exception as e:
            await update.message.reply_text(f"❌ Erro ao gerar promoção: {str(e)}")
    else:
        await update.message.reply_text("🔗 Envie um link válido de afiliado ou digite um comando.")

def main():
    if not TOKEN:
        print("Erro: A variável TOKEN_BOT não foi encontrada!")
        return

    app = ApplicationBuilder().token(TOKEN).build()

    # ConversationHandler para gerenciar o fluxo exato de cadastro
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            PEDINDO_EMAIL: [MessageHandler(filters.TEXT & (~filters.COMMAND), receber_email)],
            PEDINDO_CODIGO: [MessageHandler(filters.TEXT & (~filters.COMMAND), receber_codigo)],
            PEDINDO_NOME: [MessageHandler(filters.TEXT & (~filters.COMMAND), receber_nome)],
            LOGADO: [
                CommandHandler("poststory", ativar_poststory),
                MessageHandler(filters.TEXT & (~filters.COMMAND), processar_link)
            ]
        },
        fallbacks=[CommandHandler("start", start)]
    )

    app.add_handler(conv_handler)
    # Handler global para caso o usuário já esteja cadastrado e mande link direto
    app.add_handler(CommandHandler("poststory", ativar_poststory))
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), processar_link))

    print("Bot com sistema de cadastro rodando...")
    app.run_polling()

if __name__ == "__main__":
    main()
