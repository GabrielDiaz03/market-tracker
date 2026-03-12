const { chromium } = require('playwright');
const axios = require('axios');

async function enviarTelegram(texto) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await axios.post(url, { chat_id: chatId, text: texto, parse_mode: 'Markdown' });
    console.log("✅ Alerta enviada.");
  } catch (e) {
    console.error("❌ Error Telegram:", e.message);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  const query = "seiko 5";
  const precioMax = 150;

  try {
    console.log("🚀 Entrando en Wallapop...");
    await page.goto(`https://es.wallapop.com/app/search?keywords=${encodeURIComponent(query)}&order_by=newest`, { 
      waitUntil: 'domcontentloaded', timeout: 60000 
    });

    // --- PASO CLAVE: Aceptar Cookies si aparecen ---
    try {
      const btnCookies = page.locator('#onetrust-accept-btn-handler');
      if (await btnCookies.isVisible({ timeout: 5000 })) {
        await btnCookies.click();
        console.log("🍪 Cookies aceptadas.");
      }
    } catch (e) { console.log("No apareció banner de cookies."); }

    // Esperamos a que cargue al menos un anuncio
    console.log("Buscando anuncios...");
    const anuncio = page.locator('a[class*="ItemCard"]').first();
    await anuncio.waitFor({ state: 'visible', timeout: 30000 });

    const title = await page.locator('[class*="ItemCard__title"]').first().innerText();
    const priceText = await page.locator('[class*="ItemCard__price"]').first().innerText();
    const link = await anuncio.getAttribute('href');
    const fullLink = link.startsWith('http') ? link : `https://es.wallapop.com${link}`;

    const priceNum = parseFloat(priceText.replace(/[^0-9,.]/g, '').replace(',', '.'));

    console.log(`🔎 Visto: ${title} - ${priceNum}€`);

    if (priceNum <= precioMax) {
      await enviarTelegram(`✅ *SEIKO 5 ENCONTRADO* \n\n${title}\n💰 *Precio:* ${priceText}\n\n🔗 [Ver anuncio](${fullLink})`);
    }

  } catch (error) {
    console.error("❌ Error durante la búsqueda:", error.message);
    // Si falla, hacemos una foto para ver qué ha pasado
    await page.screenshot({ path: 'error.png' });
  }

  await browser.close();
})();