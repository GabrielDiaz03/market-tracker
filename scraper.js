const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs');

async function enviarTelegram(texto) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId, text: texto, parse_mode: 'Markdown'
    });
  } catch (e) { console.error("Error Telegram:", e.message); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Usamos un perfil de navegador más completo
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  const query = "seiko 5";
  const precioMax = 150;

  try {
    console.log("🚀 Navegando a Wallapop...");
    await page.goto(`https://es.wallapop.com/app/search?keywords=${encodeURIComponent(query)}&order_by=newest`, { 
      waitUntil: 'networkidle', timeout: 60000 
    });

    // 1. Aceptar cookies de forma agresiva
    const btnCookies = page.locator('button#onetrust-accept-btn-handler');
    if (await btnCookies.isVisible({ timeout: 10000 })) {
      await btnCookies.click();
      console.log("✅ Cookies aceptadas.");
    }

    // 2. Simular un poco de scroll para que Wallapop crea que somos humanos
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(3000);

    console.log("🧐 Buscando anuncios...");
    // Usamos un selector más genérico por si han cambiado las clases
    const itemCard = page.locator('a.ItemCardList__item, [class*="ItemCard"]').first();
    
    // Esperamos a que aparezca el anuncio
    await itemCard.waitFor({ state: 'visible', timeout: 15000 });

    const title = await page.locator('[class*="ItemCard__title"]').first().innerText();
    const priceText = await page.locator('[class*="ItemCard__price"]').first().innerText();
    const link = await itemCard.getAttribute('href');
    const fullLink = link.startsWith('http') ? link : `https://es.wallapop.com${link}`;

    const priceNum = parseFloat(priceText.replace(/[^0-9,.]/g, '').replace(',', '.'));

    console.log(`✨ Encontrado: ${title} (${priceNum}€)`);

    if (priceNum <= precioMax) {
      await enviarTelegram(`✅ *SEIKO 5 ENCONTRADO* \n\n${title}\n💰 *Precio:* ${priceText}\n\n🔗 [Ver en Wallapop](${fullLink})`);
    }

  } catch (error) {
    console.error("❌ ERROR CRÍTICO:", error.message);
    // GUARDAR CAPTURA DE PANTALLA PARA DIAGNÓSTICO
    await page.screenshot({ path: 'debug_error.png', fullPage: true });
    console.log("📸 Se ha guardado una captura 'debug_error.png' en el servidor.");
  }

  await browser.close();
})();