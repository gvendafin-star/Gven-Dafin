// ========== ОБЩИЕ ФУНКЦИИ ДЛЯ ПАНЕЛИ ПРОДАВЦА[cite: 5] ==========

// ========== CSRF-ЗАЩИТА[cite: 5] ==========

let csrfToken = null;
let authChecked = false;
window.isAuthorized = false;

async function fetchCSRFToken() {
    try {
        const response = await fetch('/api/security.php?action=token', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        if (result.success && result.csrf_token) {
            csrfToken = result.csrf_token;
            localStorage.setItem('csrf_token', csrfToken);
            return csrfToken;
        }
        return null;
    } catch(e) {
        console.warn('⚠️ Не удалось получить CSRF-токен:', e);
        return null;
    }
}

async function initCSRF() {
    const savedToken = localStorage.getItem('csrf_token');
    if (savedToken) {
        csrfToken = savedToken;
        return csrfToken;
    }
    return await fetchCSRFToken();
}

async function secureFetch(url, options = {}) {
    if (!csrfToken) {
        await initCSRF();
    }
    
    const method = options.method || 'GET';
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
        attempt++;
        
        const currentToken = csrfToken || localStorage.getItem('csrf_token') || '';
        
        if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
            options.headers = options.headers || {};
            options.headers['X-CSRF-Token'] = currentToken;
            
            if (options.body && typeof options.body === 'string') {
                try {
                    const body = JSON.parse(options.body);
                    if (!body.csrf_token && currentToken) {
                        body.csrf_token = currentToken;
                        options.body = JSON.stringify(body);
                    }
                } catch(e) {}
            }
        }
        
        try {
            const response = await fetch(url, options);
            
            if (response.status === 403) {
                console.warn('⚠️ Получен 403, пробуем обновить токен...');
                await fetchCSRFToken();
                continue; // повторяем запрос с новым токеном
            }
            
            return response;
        } catch(e) {
            throw e;
        }
    }
    
    throw new Error('Не удалось выполнить запрос после 2 попыток');
}

initCSRF();

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ[cite: 5] ==========

function calculateVolumeFromName(name) {
    const parts = name.split('x').map(p => parseFloat(p.trim().replace(',', '.')));
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return parts[0] * parts[1] * parts[2];
    }
    return 0;
}

function roundTo50(amount) {
    return Math.round(amount / 50) * 50;
}

// ========== ПЕЧАТЬ НАКЛАДНОЙ ИЗ ПАНЕЛИ ПРОДАВЦА (без сохранения в БД)[cite: 5] ==========

function printInvoice(invoiceNumber, productsData, cart, clientData) {
    const entries = Object.entries(cart).filter(([id, qty]) => qty > 0);
    
    if (entries.length === 0 && clientData.services?.length === 0) {
        alert('Корзина пуста!');
        return;
    }
    
    let totalGoods = 0;
    let totalVolume = 0;
    let rows = '';
    let itemCounter = 1;
    
    // Товары (с округлением суммы каждой позиции до 50 руб.)
    entries.forEach(([id, qty]) => {
        const p = productsData.find(p => p.id === parseInt(id));
        if (!p) return;
        const price = clientData.cartPrices?.[id] || p.price || 0;
        const sum = roundTo50(price * qty);
        totalGoods += sum;
        const itemVolume = (p.volume * qty).toFixed(3);
        totalVolume += parseFloat(itemVolume);
        
        rows += `<tr>
            <td style="border:1px solid #000; padding:8px; text-align:center;">${itemCounter}</td>
            <td style="border:1px solid #000; padding:8px;">${p.name}</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;">${qty}</td>
            <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:600; color:#0d47a1;">${itemVolume}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">${price.toLocaleString('ru-RU')}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">${sum.toLocaleString('ru-RU')}</td>
        </tr>`;
        itemCounter++;
    });
    
    // Услуги (с округлением до 50 руб.)
    const services = clientData.services || [];
    services.forEach(service => {
        const serviceSum = roundTo50(service.price);
        rows += `<tr style="background-color:#f5faf5;">
            <td style="border:1px solid #000; padding:8px; text-align:center;">${itemCounter}</td>
            <td style="border:1px solid #000; padding:8px;">🛠️ ${service.name}</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;">1</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;">—</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">—</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">${serviceSum.toLocaleString('ru-RU')}</td>
        </tr>`;
        itemCounter++;
    });
    
    totalVolume = Math.round(totalVolume * 1000) / 1000;
    
    const deliveryCost = clientData.deliveryCost || 0;
    const cardFee = clientData.cardFee || 0;
    const loadingCost = clientData.loadingCost || 0;
    const hasDelivery = clientData.delivery && deliveryCost > 0;
    const hasCard = clientData.card && cardFee > 0;
    const hasLoading = loadingCost > 0;
    const servicesTotal = services.reduce((sum, s) => sum + roundTo50(s.price), 0);
    const totalBeforeRounding = totalGoods + servicesTotal + deliveryCost + cardFee + loadingCost;
    const finalTotal = roundTo50(totalBeforeRounding);
    const weight = Math.round(totalVolume * 650);
    
    let footerRows = '';
    
    if (hasDelivery) {
        footerRows += `<tr>
            <td colspan="5" style="border:1px solid #000; padding:8px; text-align:right;"><strong>🚚 ДОСТАВКА:</strong></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"><strong>${deliveryCost.toLocaleString('ru-RU')} руб</strong></td>
        </tr>`;
    }
    
    if (hasLoading && loadingCost > 0) {
        footerRows += `<tr>
            <td colspan="5" style="border:1px solid #000; padding:8px; text-align:right;"><strong>🔄 ПОГРУЗКА:</strong></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"><strong>${loadingCost.toLocaleString('ru-RU')} руб</strong></td>
        </tr>`;
    }
    
    if (hasCard) {
        footerRows += `<tr>
            <td colspan="5" style="border:1px solid #000; padding:8px; text-align:right;"><strong>💳 КОМИССИЯ ЗА ТЕРМИНАЛ (10%):</strong></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"><strong>${cardFee.toLocaleString('ru-RU')} руб</strong></td>
        </tr>`;
    }
    
    footerRows += `<tr style="background-color:#f9f9f9;">
        <td colspan="5" style="border:1px solid #000; padding:8px; text-align:right;"><strong>ИТОГО К ОПЛАТЕ:</strong></td>
        <td style="border:1px solid #000; padding:8px; text-align:right;"><strong>${finalTotal.toLocaleString('ru-RU')} руб</strong></td>
    </tr>`;
    
    const date = new Date().toLocaleString('ru-RU');
    
    let infoLines = '';
    if (clientData.name) infoLines += `<p style="margin:5px 0;"><strong>Покупатель:</strong> ${clientData.name}</p>`;
    if (clientData.phone) infoLines += `<p style="margin:5px 0;"><strong>Телефон:</strong> ${clientData.phone}</p>`;
    if (clientData.address) infoLines += `<p style="margin:5px 0;"><strong>Адрес доставки:</strong> ${clientData.address}</p>`;
    
    infoLines += `<p style="margin:5px 0;"><strong>📦 Общий объём:</strong> ${totalVolume.toFixed(3)} м³</p>`;
    infoLines += `<p style="margin:5px 0;"><strong>⚖️ Ориентировочный вес:</strong> ${weight} кг</p>`;
    
    if (hasDelivery) {
        infoLines += `<p style="margin:5px 0;"><strong>Доставка:</strong> ${deliveryCost.toLocaleString('ru-RU')} руб</p>`;
    }
    
    if (hasCard) {
        infoLines += `<p style="margin:5px 0;"><strong>Оплата картой:</strong> +${cardFee.toLocaleString('ru-RU')} руб (комиссия 10%)</p>`;
    }
    
    if (!hasDelivery && !hasCard && !hasLoading && services.length === 0) {
        infoLines += `<p style="margin:5px 0;"><strong>Самовывоз</strong></p>`;
    }
    
    const html = `<!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>Накладная №${invoiceNumber}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Times New Roman', Arial, sans-serif; font-size: 11pt; margin: 0; padding: 0; }
        .invoice { max-width: 100%; padding: 10px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header h1 { font-size: 18pt; margin: 0; }
        .info-block { margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; }
        .info-block p { margin: 5px 0; }
        .info-block p strong { display: inline-block; width: 200px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background-color: #f0f0f0; border: 1px solid #000; padding: 8px; text-align: center; }
        td { border: 1px solid #000; padding: 8px; }
        .stamp-block { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
        .stamp-item { width: 30%; }
        .stamp-item .line { border-bottom: 1px solid #000; width: 80%; margin: 8px auto 4px; }
        .stamp-item .label { font-size: 9pt; color: #555; }
        .footer { margin-top: 30px; text-align: center; font-size: 9pt; }
    </style>
    </head>
    <body>
    <div class="invoice">
    <div class="header"><h1>Товарная накладная №${invoiceNumber}</h1></div>
    <div class="info-block">
    <p><strong>Поставщик:</strong> ИП Фадин Е.В. Иглинский район, с. Чуваш-Кубово, Дачный переулок 8. тел.: +79625382362, сайт: forestcube.ru</p>
    <p><strong>Дата формирования:</strong> ${date}</p>
    ${infoLines}
    </div>
    <table>
    <thead><tr>
        <th style="width:5%">№</th>
        <th style="width:35%">Размер</th>
        <th style="width:8%">Кол-во</th>
        <th style="width:15%">Общий объём (м³)</th>
        <th style="width:12%">Цена (руб/шт)</th>
        <th style="width:15%">Сумма (руб)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>${footerRows}</tfoot>
    </table>
    <div class="stamp-block">
    <div class="stamp-item">
        <div>Подпись покупателя</div>
        <div class="line"></div>
        <div class="label">(дата, подпись)</div>
    </div>
    <div class="stamp-item">
        <div>Место для печати</div>
        <div style="margin: 8px auto; text-align: center; color: #ddd; font-size: 9pt; font-weight: normal;">М.П.</div>
        <div class="label">(печать организации)</div>
    </div>
    <div class="stamp-item">
        <div>Подпись поставщика</div>
        <div class="line"></div>
        <div class="label">(ИП Фадин Е.В.)</div>
    </div>
    </div>
    <div class="footer">Документ сформирован автоматически</div>
    </div>
    </body>
    </html>`;
    
    const printDiv = document.getElementById('printInvoice');
    if (printDiv) {
        printDiv.innerHTML = html;
        printDiv.style.display = 'block';
        window.print();
        printDiv.style.display = 'none';
    }
}

// ========== ПЕЧАТЬ НАКЛАДНОЙ (только для сохранённых заявок из БД)[cite: 5] ==========

function printSavedInvoice(order) {
    const itemsList = order.items ? order.items.split(', ').map(item => {
        const priceMatch = item.match(/\((\d+)\s*₽\/шт\)/);
        let price = priceMatch ? parseInt(priceMatch[1]) : 0;
        
        const parts = item.split(' - ');
        const name = parts[0] || '';
        const qtyMatch = parts[1] ? parts[1].match(/(\d+)\s*шт/) : null;
        const qty = qtyMatch ? parseInt(qtyMatch[1]) : 0;
        
        if (price === 0 && name && !name.includes('🛠️')) {
            const volume = calculateVolumeFromName(name);
            if (volume > 0) {
                price = Math.round(volume * 16500);
            }
        }
        
        return { name, qty, price, volume: calculateVolumeFromName(name) };
    }) : [];
    
    const filteredItems = itemsList.filter(item => item.qty > 0);
    
    if (filteredItems.length === 0) {
        alert('Нет товаров для печати');
        return;
    }
    
    let totalGoods = 0;
    let totalVolume = 0;
    let rows = '';
    let itemCounter = 1;
    
    // Разделяем товары и услуги
    const servicesItems = [];
    const goodsItems = [];
    
    filteredItems.forEach((item) => {
        if (item.name && item.name.includes('🛠️ Услуга:')) {
            const serviceMatch = item.name.match(/🛠️ Услуга:\s*(.+?)\s*-\s*(\d+)\s*₽/);
            if (serviceMatch) {
                servicesItems.push({
                    name: serviceMatch[1],
                    price: parseInt(serviceMatch[2])
                });
            }
            return;
        }
        goodsItems.push(item);
    });
    
    // Товары с объёмом (с округлением суммы до 50 руб.)
    goodsItems.forEach((item) => {
        const sum = roundTo50(item.price * item.qty);
        totalGoods += sum;
        const itemVolume = (item.volume * item.qty).toFixed(3);
        totalVolume += parseFloat(itemVolume);
        
        rows += `<tr>
            <td style="border:1px solid #000; padding:8px; text-align:center;">${itemCounter}</td>
            <td style="border:1px solid #000; padding:8px;">${item.name}</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;">${item.qty}</td>
            <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:600; color:#0d47a1;">${itemVolume}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">${item.price.toLocaleString('ru-RU')}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">${sum.toLocaleString('ru-RU')}</td>
        </tr>`;
        itemCounter++;
    });
    
    // Услуги (с округлением до 50 руб.)
    servicesItems.forEach(service => {
        const serviceSum = roundTo50(service.price);
        rows += `<tr style="background-color:#f5faf5;">
            <td style="border:1px solid #000; padding:8px; text-align:center;">${itemCounter}</td>
            <td style="border:1px solid #000; padding:8px;">🛠️ ${service.name}</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;">1</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;">—</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">—</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">${serviceSum.toLocaleString('ru-RU')}</td>
        </tr>`;
        itemCounter++;
    });
    
    totalVolume = Math.round(totalVolume * 1000) / 1000;
    
    if (totalGoods === 0) {
        totalGoods = Number(order.total) || 0;
    }
    
    const deliveryCost = Number(order.delivery_cost) || 0;
    const cardFee = Number(order.card_fee) || 0;
    const loadingCost = Number(order.loading_cost) || 0;
    const hasDelivery = order.delivery_needed && deliveryCost > 0;
    const hasCard = order.card_payment && cardFee > 0;
    const hasLoading = loadingCost > 0;
    const servicesTotal = servicesItems.reduce((sum, s) => sum + roundTo50(s.price), 0);
    const totalBeforeRounding = totalGoods + servicesTotal + deliveryCost + cardFee + loadingCost;
    const finalTotal = roundTo50(totalBeforeRounding);
    const weight = Math.round(totalVolume * 650);
    
    let footerRows = '';
    
    if (hasDelivery) {
        footerRows += `<tr>
            <td colspan="5" style="border:1px solid #000; padding:8px; text-align:right;"><strong>🚚 ДОСТАВКА:</strong></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"><strong>${deliveryCost.toLocaleString('ru-RU')} руб</strong></td>
        </tr>`;
    }
    
    if (hasLoading && loadingCost > 0) {
        footerRows += `<tr>
            <td colspan="5" style="border:1px solid #000; padding:8px; text-align:right;"><strong>🔄 ПОГРУЗКА:</strong></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"><strong>${loadingCost.toLocaleString('ru-RU')} руб</strong></td>
        </tr>`;
    }
    
    if (hasCard) {
        footerRows += `<tr>
            <td colspan="5" style="border:1px solid #000; padding:8px; text-align:right;"><strong>💳 КОМИССИЯ ЗА ТЕРМИНАЛ (10%):</strong></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"><strong>${cardFee.toLocaleString('ru-RU')} руб</strong></td>
        </tr>`;
    }
    
    footerRows += `<tr style="background-color:#f9f9f9;">
        <td colspan="5" style="border:1px solid #000; padding:8px; text-align:right;"><strong>ИТОГО К ОПЛАТЕ:</strong></td>
        <td style="border:1px solid #000; padding:8px; text-align:right;"><strong>${finalTotal.toLocaleString('ru-RU')} руб</strong></td>
    </tr>`;
    
    const date = new Date(order.created_at).toLocaleString('ru-RU');
    
    let infoLines = '';
    if (order.client_name) infoLines += `<p style="margin:5px 0;"><strong>Покупатель:</strong> ${order.client_name}</p>`;
    if (order.phone) infoLines += `<p style="margin:5px 0;"><strong>Телефон:</strong> ${order.phone}</p>`;
    if (order.address) infoLines += `<p style="margin:5px 0;"><strong>Адрес доставки:</strong> ${order.address}</p>`;
    
    infoLines += `<p style="margin:5px 0;"><strong>📦 Общий объём:</strong> ${totalVolume.toFixed(3)} м³</p>`;
    infoLines += `<p style="margin:5px 0;"><strong>⚖️ Ориентировочный вес:</strong> ${weight} кг</p>`;
    
    if (hasDelivery) {
        infoLines += `<p style="margin:5px 0;"><strong>Доставка:</strong> ${deliveryCost.toLocaleString('ru-RU')} руб</p>`;
    }
    
    if (hasCard) {
        infoLines += `<p style="margin:5px 0;"><strong>Оплата картой:</strong> +${cardFee.toLocaleString('ru-RU')} руб (комиссия 10%)</p>`;
    }
    
    if (!hasDelivery && !hasCard && !hasLoading && servicesItems.length === 0) {
        infoLines += `<p style="margin:5px 0;"><strong>Самовывоз</strong></p>`;
    }
    
    const html = `<!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>Накладная №${order.order_number}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Times New Roman', Arial, sans-serif; font-size: 11pt; margin: 0; padding: 0; }
        .invoice { max-width: 100%; padding: 10px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header h1 { font-size: 18pt; margin: 0; }
        .info-block { margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; }
        .info-block p { margin: 5px 0; }
        .info-block p strong { display: inline-block; width: 200px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background-color: #f0f0f0; border: 1px solid #000; padding: 8px; text-align: center; }
        td { border: 1px solid #000; padding: 8px; }
        .stamp-block { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
        .stamp-item { width: 30%; }
        .stamp-item .line { border-bottom: 1px solid #000; width: 80%; margin: 8px auto 4px; }
        .stamp-item .label { font-size: 9pt; color: #555; }
        .footer { margin-top: 30px; text-align: center; font-size: 9pt; }
    </style>
    </head>
    <body>
    <div class="invoice">
    <div class="header"><h1>Товарная накладная №${order.order_number}</h1></div>
    <div class="info-block">
    <p><strong>Поставщик:</strong> ИП Фадин Е.В. Иглинский район, с. Чуваш-Кубово, Дачный переулок 8. тел.: +79625382362, сайт: forestcube.ru</p>
    <p><strong>Дата формирования:</strong> ${date}</p>
    ${infoLines}
    </div>
    <table>
    <thead><tr>
        <th style="width:5%">№</th>
        <th style="width:35%">Размер</th>
        <th style="width:8%">Кол-во</th>
        <th style="width:15%">Общий объём (м³)</th>
        <th style="width:12%">Цена (руб/шт)</th>
        <th style="width:15%">Сумма (руб)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>${footerRows}</tfoot>
    </table>
    <div class="stamp-block">
    <div class="stamp-item">
        <div>Подпись покупателя</div>
        <div class="line"></div>
        <div class="label">(дата, подпись)</div>
    </div>
    <div class="stamp-item">
        <div>Место для печати</div>
        <div style="margin: 8px auto; text-align: center; color: #ddd; font-size: 9pt; font-weight: normal;">М.П.</div>
        <div class="label">(печать организации)</div>
    </div>
    <div class="stamp-item">
        <div>Подпись поставщика</div>
        <div class="line"></div>
        <div class="label">(ИП Фадин Е.В.)</div>
    </div>
    </div>
    <div class="footer">Документ сформирован автоматически</div>
    </div>
    </body>
    </html>`;
    
    const printDiv = document.getElementById('printInvoice');
    if (printDiv) {
        printDiv.innerHTML = html;
        printDiv.style.display = 'block';
        window.print();
        printDiv.style.display = 'none';
    }
}

// ========== ДЕЛАЕМ ФУНКЦИИ ГЛОБАЛЬНЫМИ[cite: 5] ==========
window.secureFetch = secureFetch;
window.printSavedInvoice = printSavedInvoice;
window.printInvoice = printInvoice;
window.roundTo50 = roundTo50;
window.calculateVolumeFromName = calculateVolumeFromName;