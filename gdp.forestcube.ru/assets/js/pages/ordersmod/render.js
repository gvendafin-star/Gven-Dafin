import { getStatusInfo, calculateAvgDailyVolume } from './utils.js';

// ========== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПАРСИНГА УСЛУГ ИЗ ITEMS ==========
function parseServicesFromItems(itemsString) {
    if (!itemsString) return [];
    
    const services = [];
    const parts = itemsString.split(',').map(s => s.trim());
    
    for (const part of parts) {
        // Ищем услуги по ключевому слову "Услуга:" (с любой иконкой)
        if (part.includes('Услуга:')) {
            const nameMatch = part.match(/Услуга:\s*(.+?)\s*[-–]/);
            const priceMatch = part.match(/[-–]\s*(\d+)\s*₽/);
            
            if (nameMatch && priceMatch) {
                services.push({
                    name: nameMatch[1].trim(),
                    price: parseInt(priceMatch[1])
                });
            }
        }
    }
    
    return services;
}

export function renderOrders(orders) {
    const container = document.getElementById('ordersContainer');
    if (!orders || orders.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>Нет заявок за выбранный период</p></div>`;
        return;
    }
    
    let html = `
        <table class="orders-table">
            <thead>
                <tr>
                    <th>№</th>
                    <th>Дата</th>
                    <th>Клиент</th>
                    <th>Телефон</th>
                    <th>Объём</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Отгрузка</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    orders.forEach(order => {
        const date = new Date(order.created_at).toLocaleString('ru-RU');
        const volume = order.volume || 0;
        const statusInfo = getStatusInfo(order.status || 'shipped');
        const rowClass = statusInfo.rowClass || '';
        
        // ===== ЛОГИКА ОТОБРАЖЕНИЯ СТАТУСА ОТГРУЗКИ =====
        let additionalRowClass = '';
        let additionalText = '';
        
        if (order.status === 'preorder') {
            if (order.maker_completed == 1) {
                additionalRowClass = 'row-fact-shipped';
                additionalText = '✅ По факту';
            } else {
                additionalRowClass = 'row-fact-pending';
                additionalText = '⏳ Ожидает';
            }
        } else if (order.status === 'shipped') {
            if (order.maker_completed == 1) {
                additionalRowClass = 'row-fact-shipped';
                additionalText = '✅ По факту';
            } else {
                additionalRowClass = 'row-fact-pending';
                additionalText = '⏳ Ожидает мейкера';
            }
        } else if (order.status === 'unpaid') {
            additionalRowClass = 'row-fact-pending';
            additionalText = '📌 Не оплачена';
        }
        
        const isShipped = additionalRowClass === 'row-fact-shipped';
        const badgeColor = isShipped 
            ? 'background:#e8f5e9; color:#2e7d32;' 
            : 'background:#ffebee; color:#c62828;';
        
        html += `
            <tr class="${rowClass} ${additionalRowClass}">
                <td><span class="order-number">${order.order_number}</span></td>
                <td>${date}</td>
                <td>${order.client_name || '—'}</td>
                <td>${order.phone || '—'}</td>
                <td class="volume">${volume.toFixed(3)} м³</td>
                <td class="total">${Number(order.total).toLocaleString('ru-RU')} ₽</td>
                <td><span class="status-badge ${statusInfo.class}">${statusInfo.label}</span></td>
                <td>
                    <span style="font-weight:600; font-size:0.75rem; padding:4px 12px; border-radius:12px; ${badgeColor}">
                        ${additionalText}
                    </span>
                </td>
                <td>
                    <button class="btn-action btn-view" onclick="window.viewOrder(${order.id})">👁️</button>
                    <button class="btn-action btn-edit" onclick="window.editOrder(${order.id})">✏️</button>
                    <button class="btn-action btn-print" onclick="window.printSavedOrder(${order.id})">🖨️</button>
                    <button class="btn-action btn-delete" onclick="window.deleteOrder(${order.id}, '${order.order_number}')">🗑️</button>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
}

export function updateStats(orders) {
    if (!orders) return;
    
    const activeOrders = orders.filter(o => o.status !== 'unpaid');
    
    const total = activeOrders.length;
    const delivery = activeOrders.filter(o => o.delivery_needed).length;
    const card = activeOrders.filter(o => o.card_payment).length;
    const sum = activeOrders.reduce((s, o) => s + Number(o.total), 0);
    const totalVolume = activeOrders.reduce((s, o) => s + (o.volume || 0), 0);
    const preorderSum = activeOrders.filter(o => o.status === 'preorder').reduce((s, o) => s + Number(o.total), 0);
    
    const deliverySum = activeOrders.reduce((s, o) => s + (Number(o.delivery_cost) || 0), 0);
    
    // ⭐ ПЕРЕСЧИТЫВАЕМ СУММУ УСЛУГ (ВКЛЮЧАЯ ПОГРУЗКУ И ВСЕ УСЛУГИ ИЗ ITEMS)
    let servicesSum = 0;
    activeOrders.forEach(o => {
        // Добавляем погрузку
        servicesSum += Number(o.loading_cost) || 0;
        
        // Парсим услуги из items
        if (o.items) {
            const services = parseServicesFromItems(o.items);
            services.forEach(service => {
                servicesSum += service.price;
            });
        }
    });
    
    const avgDaily = calculateAvgDailyVolume(orders);
    
    const volumeEl = document.getElementById('statVolume');
    if (volumeEl) volumeEl.textContent = totalVolume.toFixed(3) + ' м³';
    
    const sumEl = document.getElementById('statSum');
    if (sumEl) sumEl.textContent = sum.toLocaleString('ru-RU') + ' ₽';
    
    const deliveryEl = document.getElementById('statDelivery');
    if (deliveryEl) deliveryEl.textContent = delivery;
    
    const avgDailyEl = document.getElementById('statAvgDailyVolume');
    if (avgDailyEl) avgDailyEl.textContent = avgDaily.avg.toFixed(3) + ' м³';
    
    const daysInfoEl = document.getElementById('statDaysInfo');
    if (daysInfoEl) daysInfoEl.textContent = `за ${avgDaily.days} дней (всего ${avgDaily.totalVolume.toFixed(3)} м³)`;
    
    const deliverySumEl = document.getElementById('statDeliverySum');
    if (deliverySumEl) deliverySumEl.textContent = deliverySum.toLocaleString('ru-RU') + ' ₽';
    
    const servicesSumEl = document.getElementById('statServicesSum');
    if (servicesSumEl) servicesSumEl.textContent = servicesSum.toLocaleString('ru-RU') + ' ₽';
    
    const preorderSumEl = document.getElementById('statPreorderSum');
    if (preorderSumEl) {
        preorderSumEl.textContent = preorderSum.toLocaleString('ru-RU') + ' ₽';
    }
}