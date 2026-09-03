// ============================================================
// ПЕЧАТЬ НАКЛАДНОЙ
// ============================================================

import { state } from '../../modules/state.js';
import { getClientData } from '../../modules/client.js';
import { calculateTotalWithServices } from '../../modules/cart.js';
import { getAllProducts, getPriceForPrint, roundTo50 } from './core.js';
import { setActionsCompleted } from './ui.js';

// ========== ПЕЧАТЬ НАКЛАДНОЙ ==========
export async function printInvoiceHandler() {
    const entries = Object.entries(state.cart).filter(([id, qty]) => qty > 0);

    if (entries.length === 0 && state.services.length === 0) {
        alert('Корзина пуста! Добавьте товары или услуги.');
        return;
    }

    let invoiceNumber = state.currentInvoiceNumber;
    if (!invoiceNumber) {
        invoiceNumber = 'ВРЕМЕННЫЙ-' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        alert(`⚠️ Заявка ещё не сохранена! Используется временный номер: ${invoiceNumber}\nРекомендуем сначала нажать "Записать".`);
    } else if (!state.isOrderSaved) {
        alert(`⚠️ Заявка №${invoiceNumber} ещё не сохранена!\nРекомендуем сначала нажать "Записать".`);
    }

    const clientData = getClientData();
    const totals = calculateTotalWithServices();

    const printData = {
        ...clientData,
        deliveryCost: totals.deliveryCost,
        cardFee: totals.cardFee,
        loadingCost: totals.loadingCost,
        hasLoading: totals.hasLoading,
        services: state.services,
        finalTotal: totals.finalTotal,
        invoiceNumber: invoiceNumber,
        cartPrices: state.cartPrices,
        getPrice: getPriceForPrint,
        totalWeight: totals.totalWeight || 0
    };

    printInvoiceWithWeight(invoiceNumber, getAllProducts(), state.cart, printData);
    setActionsCompleted(true);
}

// ========== ФУНКЦИЯ ПЕЧАТИ ==========
function printInvoiceWithWeight(invoiceNumber, productsData, cart, clientData) {
    const entries = Object.entries(cart).filter(([id, qty]) => qty > 0);
    
    if (entries.length === 0 && clientData.services?.length === 0) {
        alert('Корзина пуста!');
        return;
    }
    
    let totalGoods = 0;
    let totalVolume = 0;
    let totalWeight = clientData.totalWeight || 0;
    let rows = '';
    let itemCounter = 1;
    
    entries.forEach(([id, qty]) => {
        const p = productsData.find(p => p.id === parseInt(id));
        if (!p) return;
        
        const price = clientData.getPrice ? clientData.getPrice(parseInt(id)) : (clientData.cartPrices?.[id] || p.price);
        const sum = price * qty;
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
    
    const services = clientData.services || [];
    services.forEach(service => {
        rows += `<tr style="background-color:#f5faf5;">
            <td style="border:1px solid #000; padding:8px; text-align:center;">${itemCounter}</td>
            <td style="border:1px solid #000; padding:8px;">🛠️ ${service.name}</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;">1</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;">—</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">—</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;">${service.price.toLocaleString('ru-RU')}</td>
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
    const servicesTotal = services.reduce((sum, s) => sum + s.price, 0);
    const totalBeforeRounding = totalGoods + servicesTotal + deliveryCost + cardFee + loadingCost;
    const finalTotal = roundTo50(totalBeforeRounding);
    
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
    infoLines += `<p style="margin:5px 0;"><strong>⚖️ Общий вес:</strong> ${totalWeight.toFixed(1)} кг</p>`;
    
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