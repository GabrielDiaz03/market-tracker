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
    console.log("¡Notificación enviada a Telegram!");
  } catch (err) {
    console.error("Error al contactar con Telegram:", err.message);
  }
}

(async () => {
  console.log("Iniciando navegador invisible...");
  const navegador = await chromium.launch({ headless: true });
  const contexto = await navegador.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  });
  const pagina = await contexto.newPage();

  const busqueda = "seiko 5";
  const precioMaximo = 150; // <--- AQUÍ ESTÁ TU FILTRO
  const enlaceWallapop = `https://es.wallapop.com/app/search?keywords=${encodeURIComponent(busqueda)}&order_by=newest`;

  try {
    await pagina.goto(enlaceWallapop, { waitUntil: 'networkidle', timeout: 60000 });
    await pagina.waitForTimeout(5000);

    // 1. Extraemos los datos del primer anuncio
    const tituloItem = await pagina.locator('[class*="ItemCard__title"]').first().innerText();
    const precioTexto = await pagina.locator('[class*="ItemCard__price"]').first().innerText();
    const urlAnuncio = pagina.url();

    // 2. Limpiamos el precio para poder comparar (Ej: "120 €" -> 120)
    const precioNumerico = parseFloat(precioTexto.replace(/[^0-9,.-]/g, '').replace(',', '.'));

    console.log(`Analizando: ${tituloItem} - Precio: ${precioNumerico}€`);

    // 3. Aplicamos la lógica del filtro
    if (precioNumerico <= precioMaximo) {
      const mensajeFinal = `⌚ *¡CHOLLO SEIKO 5!* (Menos de ${precioMaximo}€)\n\n📌 *Producto:* ${tituloItem} \n💰 *Precio:* ${precioTexto} \n\n🔗 [Abrir en Wallapop](${urlAnuncio})`;
      await enviarAlertaTelegram(mensajeFinal);
    } else {
      console.log(`El precio (${precioNumerico}€) supera tu límite de ${precioMaximo}€. No se envía alerta.`);
    }

  } catch (error) {
    console.error("Hubo un problema durante el rastreo:", error.message);
  }

  await navegador.close();
  console.log("Navegador cerrado.");
})();