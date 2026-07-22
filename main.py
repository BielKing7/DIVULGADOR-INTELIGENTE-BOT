import os
import requests
from io import BytesIO
from PIL import Image, ImageDraw
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes

# Token inserido diretamente para garantir o funcionamento imediato
TOKEN = "8742760614:AAG9uZSvKiK9o6mVbL1C_v3s79i6cjbR4L8"

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_text = update.message.text
    
    if "http" in user_text:
        await update.message.reply_text("⏳ Processando seu link e gerando a arte para o Story...")
        
        try:
            # Cria a base do Story (1080x1920) com fundo escuro elegante
            story_width, story_height = 1080, 1920
            img = Image.new("RGB", (story_width, story_height), color="#121212")
            draw = ImageDraw.Draw(img)
            
            # Textos temporários de exemplo
            titulo_produto = "Produto Incrível Shopee - Oferta Imperdível"
            preco_produto = "R$ 99,90"
            
            # Caixa branca para o espaço do link de afiliado do Instagram
            caixa_link_box = [140, 1500, 940, 1630]
            draw.rounded_rectangle(caixa_link_box, radius=20, fill="#FFFFFF")
            
            # Chamada visual
            draw.text((160, 1440), "COMPRE AQUI ➔", fill="#FF5722")
            
            # Título e Preço na arte
            draw.text((140, 1200), titulo_produto[:45] + "...", fill="#FFFFFF")
            draw.text((140, 1280), preco_produto, fill="#00E676")
            
            # Salva a imagem em memória
            bio = BytesIO()
            bio.name = "story_afiliado.png"
            img.save(bio, "PNG")
            bio.seek(0)
            
            # Envia de volta para o Telegram
            await update.message.reply_photo(
                photo=bio,
                caption="✅ Arte gerada com sucesso! Posicione seu sticker de link por cima da área em branco e poste no Story!"
            )
            
        except Exception as e:
            await update.message.reply_text(f"❌ Ops! Ocorreu um erro ao gerar a arte: {str(e)}")
    else:
        await update.message.reply_text("🔗 Por favor, envie um link válido de afiliado.")

def main():
    if not TOKEN:
        print("Erro: TELEGRAM_TOKEN não configurado!")
        return
        
    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))
    
    print("Bot rodando...")
    app.run_polling()

if __name__ == "__main__":
    main()
