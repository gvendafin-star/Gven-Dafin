import { fetchOrder } from './api.js';
import { state } from './state.js';
import { calculateVolumeFromItems, getStatusInfo } from './utils.js';

export async function viewOrder(id) {
    try {
        const result = await fetchOrder(id);
        if (result.success && result.order) {
            const order = result.order;
            state.currentOrderId = id;
            state.editMode = false;
            const modal = document.getElementById('orderModal');
            document.getElementById('modalTitle').textContent = `Заявка №${order.order_number}`;
            const date = new Date(order.created_at).toLocaleString('ru-RU');
            const itemsList = order.items ? order.items.split(',').join('\n') : '—';
            const deliveryCost = Number(order.delivery_cost) || 0;
            const cardFee = Number(order.card_fee) || 0;
            const loadingCost = Number(order.loading_cost) || 0;
            const volume = calculateVolumeFromItems(order.items);
            const statusInfo = getStatusInfo(order.status || 'shipped');
            
            document.getElementById('modalBody').innerHTML = `
                <div class="detail-row"><strong>📅 Дата:</strong> ${date}</div>
                <div class="detail-row"><strong>👤 Покупатель:</strong> ${order.client_name || '—'}</div>
                <div class="detail-row"><strong>📞 Телефон:</strong> ${order.phone || '—'}</div>
                <div class="detail-row"><strong>📍 Адрес:</strong> ${order.address || '—'}</div>
                <div class="detail-row"><strong>📦 Статус:</strong> <span class="status-badge ${statusInfo.class}" style="font-size:0.9rem;">${statusInfo.label}</span></div>
                <div class="detail-row"><strong>📐 Объём:</strong> <strong style="color:#0d47a1;">${volume.toFixed(3)} м³</strong></div>
                ${deliveryCost > 0 ? `<div class="detail-row"><strong>🚚 Доставка:</strong> ${deliveryCost.toLocaleString('ru-RU')} ₽</div>` : ''}
                ${cardFee > 0 ? `<div class="detail-row"><strong>💳 Комиссия 10%:</strong> ${cardFee.toLocaleString('ru-RU')} ₽</div>` : ''}
                ${loadingCost > 0 ? `<div class="detail-row"><strong>🔄 Погрузка:</strong> ${loadingCost.toLocaleString('ru-RU')} ₽</div>` : ''}
                <div class="detail-row"><strong>💰 ИТОГО:</strong> <strong style="color:#1f5e1f;font-size:1.1rem;">${Number(order.total).toLocaleString('ru-RU')} ₽</strong></div>
                <div class="detail-row" style="margin-top:10px;"><strong>📦 Товары:</strong></div>
                <div class="items-list">${itemsList}</div>
            `;
            
            const modalActions = document.getElementById('modalActions');
            if (modalActions) {
                modalActions.innerHTML = `
                    <button class="btn-print-in-modal" onclick="window.printModalOrder()">🖨️ Распечатать накладную</button>
                    <button class="btn-edit-save" onclick="window.editOrder(${id})" style="background:#f57c00;">✏️ Редактировать заявку</button>
                    <button class="btn-edit-save" onclick="window.closeModal()" style="background:#5a4a32;">❌ Закрыть</button>
                `;
            }
            modal.classList.add('active');
        }
    } catch(e) {
        console.error('❌ Ошибка просмотра:', e);
        alert('Не удалось загрузить заявку');
    }
}