const { chromium } = require('playwright');
const axios = require('axios');

async function enviarAlertaTelegram(texto) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const apiURL = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(apiURL, {
      chat_id: chatId,
      text: texto,
      parse_mode: 'Markdown'
    });
    console.log("✅ ¡Mensaje enviado a Telegram correctamente!");
  } catch (err) {
    console.error("❌ Error de Telegram:", err.response ? err.response.data : err.message);
  }
}

(async () => {
  console.log("🚀 Iniciando rastreador de Seiko 5...");
  const navegador = await chromium.launch({ headless: true });
  const contexto = await navegador.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const pagina = await contexto.newPage();

  const busqueda = "seiko 5";
  const precioMaximo = 150; // <--- TU FILTRO
  const urlWallapop = `https://es.wallapop.com/app/search?keywords=${encodeURIComponent(busqueda)}&order_by=newest`;

  try {
    await pagina.goto(urlWallapop, { waitUntil: 'networkidle', timeout: 60000 });
    await pagina.waitForTimeout(5000); // Espera para carga de imágenes

    // Extraemos los datos del primer anuncio que aparece
    const titulo = await pagina.locator('[class*="ItemCard__title"]').first().innerText();
    const precioTexto = await pagina.locator('[class*="ItemCard__price"]').first().innerText();
    const enlace = pagina.url();

    // Convertimos "120 €" en el número 120
    const precioLimpio = parseFloat(precioTexto.replace(/[^0-9,.]/g, '').replace(',', '.'));

    console.log(`🔎 He encontrado: "${titulo}" por ${precioLimpio}€`);

    if (precioLimpio <= precioMaximo) {
      console.log("💰 ¡PRECIO VÁLIDO! Enviando notificación...");
      const mensaje = `⌚ *¡NUEVO SEIKO 5!* \n\n📌 ${titulo} \n💰 *Precio:* ${precioTexto} \n\n🔗 [Ver en Wallapop](${enlace})`;
      await enviarAlertaTelegram(mensaje);
    } else {
      console.log(`Skipping: El precio (${precioLimpio}€) es superior a tu límite de ${precioMaximo}€.`);
    }

  } catch (error) {
    console.error("⚠️ Error en el proceso:", error.message);
  }

  await navegador.close();
  console.log("🏁 Proceso finalizado.");
})();