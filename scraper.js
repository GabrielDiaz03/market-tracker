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
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'] // Evita detección básica
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  const query = "seiko 5";
  const precioMax = 400;

  try {
    console.log("🚀 Navegando a Wallapop...");
    await page.goto(`https://es.wallapop.com/app/search?keywords=${encodeURIComponent(query)}&order_by=newest`, { 
      waitUntil: 'networkidle', timeout: 60000 
    });

    // --- 1. ACEPTAR COOKIES DE FORMA INTELIGENTE ---
    const selectoresCookies = [
      'button#onetrust-accept-btn-handler',
      'button:has-text("Aceptar")',
      'button:has-text("Aceptar todas")',
      '[aria-label="Cerrar"]',
      'button.cc-btn.cc-allow'
    ];
    for (const selector of selectoresCookies) {
      const boton = page.locator(selector);
      try {
        if (await boton.isVisible({ timeout: 3000 })) {
          await boton.click();
          console.log(`✅ Cookies aceptadas con selector: ${selector}`);
          await page.waitForTimeout(2000); // Pequeña pausa tras el clic
          break;
        }
      } catch (e) {
        // No visible, probamos siguiente
      }
    }

    // --- 2. ESPERAR A QUE APAREZCA AL MENOS UN ANUNCIO (VARIOS SELECTORES) ---
    console.log("🧐 Buscando anuncios...");
    
    // Selectores posibles para un anuncio (ordenados de más específico a más genérico)
    const selectoresAnuncio = [
      'a[href*="/item/"]',                          // Enlace que contiene "/item/" (muy estable)
      'a.ItemCardList__item',                       // Clase específica actual
      '[class*="ItemCard"] a[href*="/item/"]',      // Combinación
      'article',                                     // Artículo (si usan etiquetas semánticas)
      'div[class*="card"] a[href*="/item/"]'         // Fallback
    ];

    let elementoEncontrado = null;
    for (const selector of selectoresAnuncio) {
      try {
        console.log(`Probando selector: ${selector}`);
        // Esperamos hasta 10 segundos por cada selector
        await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 });
        elementoEncontrado = selector;
        console.log(`✅ Anuncio encontrado con selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`Selector ${selector} no funcionó, probando siguiente...`);
      }
    }

    if (!elementoEncontrado) {
      throw new Error("No se pudo encontrar ningún anuncio con los selectores probados.");
    }

    // --- 3. COMPROBAR SI HAY RESULTADOS (MENSAJE "NO HAY ANUNCIOS") ---
    const noResultsSelectors = [
      'text="No hay anuncios"',
      'div:has-text("No hemos encontrado")',
      'h2:has-text("Sin resultados")'
    ];
    for (const sel of noResultsSelectors) {
      const visible = await page.locator(sel).first().isVisible().catch(() => false);
      if (visible) {
        console.log("⚠️ La búsqueda no devolvió resultados.");
        await browser.close();
        return;
      }
    }

    // --- 4. SCROLL PARA CARGAR MÁS (OPCIONAL PERO RECOMENDADO) ---
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(2000);

    // --- 5. EXTRAER DATOS DEL PRIMER ANUNCIO ---
    // Usamos el primer enlace que contiene "/item/" como base segura
    const primerEnlace = page.locator('a[href*="/item/"]').first();
    
    // Intentamos obtener título y precio con selectores flexibles
    let titulo = "Título no encontrado";
    let precioTexto = "0 €";
    
    try {
      titulo = await primerEnlace.locator('xpath=..').locator('[class*="title"], h2, h3, [class*="name"]').first().innerText();
    } catch (e) { /* ignorar */ }
    
    try {
      precioTexto = await primerEnlace.locator('xpath=..').locator('[class*="price"], span:has-text("€"), [class*="money"]').first().innerText();
    } catch (e) { /* ignorar */ }
    
    const link = await primerEnlace.getAttribute('href');
    const fullLink = link.startsWith('http') ? link : `https://es.wallapop.com${link}`;

    const precioNum = parseFloat(precioTexto.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;

    console.log(`✨ Encontrado: ${titulo} (${precioNum}€)`);

    if (precioNum <= precioMax) {
      await enviarTelegram(`✅ *SEIKO 5 ENCONTRADO* \n\n${titulo}\n💰 *Precio:* ${precioTexto}\n\n🔗 [Ver en Wallapop](${fullLink})`);
    }

  } catch (error) {
    console.error("❌ ERROR CRÍTICO:", error.message);
    
    // --- 6. CAPTURA DE PANTALLA Y HTML PARA DEPURACIÓN ---
    const timestamp = Date.now();
    const screenshotPath = `debug_error_${timestamp}.png`;
    const htmlPath = `debug_error_${timestamp}.html`;
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Captura guardada: ${screenshotPath}`);
    
    const htmlContent = await page.content();
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`📄 HTML guardado: ${htmlPath}`);
    
    // Opcional: imprimir fragmento del HTML para ver el problema
    console.log("Fragmento del HTML (primeros 1000 caracteres):");
    console.log(htmlContent.substring(0, 1000));
    
  } finally {
    await browser.close();
  }
})();