const axios = require('axios');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// Configuración desde variables de entorno (GitHub Secrets)
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(TOKEN);

const HISTORY_FILE = './history.json';
const KEYWORD = 'seiko 5';
const SEARCH_URL = `https://es.wallapop.com/app/search?keywords=${encodeURIComponent(KEYWORD)}&order_by=newest`;

async function run() {
  try {
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }

    // --- RECARGA DE TIMEOUT: Espera entre 15 y 30 segundos ---
    const waitTime = Math.floor(Math.random() * (30000 - 15000 + 1) + 15000);
    console.log(`Pausa de seguridad: esperando ${waitTime / 1000} segundos...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    console.log(`Iniciando búsqueda de: ${KEYWORD}...`);

    // Intentamos usar la URL de la web directamente con parámetros de rastreo reales
    const WEB_URL = `https://es.wallapop.com/app/search?keywords=${encodeURIComponent(KEYWORD)}&order_by=newest&source=search_box`;

    const response = await axios.get(WEB_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000 // 10 segundos de tiempo de espera para la respuesta
    });

    // Si llegamos aquí sin error 403, ¡hemos pasado!
    console.log("¡Conexión exitosa!");
    
    // El resto de tu lógica de procesar items...

        const items = response.data.search_objects || [];
        let newItemsFound = 0;

        // 3. Filtrar y Notificar
        for (const item of items) {
            // Usamos el ID de Wallapop para saber si es nuevo
            if (!history.includes(item.id)) {
                const message = `⌚ ¡Nuevo Seiko 5!\n\n💰 Precio: ${item.price.amount} ${item.price.currency}\n📝 ${item.title}\n\n🔗 Ver producto: https://es.wallapop.com/item/${item.web_slug}`;
                
                await bot.sendMessage(CHAT_ID, message);
                history.push(item.id);
                newItemsFound++;
            }
        }

        // 4. Actualizar historial (mantener solo los últimos 200 para no inflar el JSON)
        const updatedHistory = history.slice(-200);
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(updatedHistory, null, 2));

        console.log(`Proceso terminado. Se encontraron ${newItemsFound} novedades.`);

    } catch (error) {
        console.error('Error en el scraper:', error.message);
        process.exit(1); // Importante para que GitHub Actions marque error si falla
    }
}

run();