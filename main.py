import os
import requests
from io import BytesIO
from PIL import Image, ImageDraw
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes

TOKEN = os.environ.get("TELEGRAM_TOKEN")

print(f"DEBUG TOKEN LIDO: {TOKEN}")

def main():
    if not TOKEN:
        print("Erro: TELEGRAM_TOKEN não configurado!")
        return
        
    app = ApplicationBuilder().token(TOKEN).build()
    
    async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text("✅ Bot online e funcionando!")

    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))
    
    print("Bot rodando com sucesso...")
    app.run_polling()

if __name__ == "__main__":
    main()
