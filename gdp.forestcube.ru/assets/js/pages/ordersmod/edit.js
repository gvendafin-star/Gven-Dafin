import { fetchOrder } from './api.js';
import { state } from './state.js';
import { productsData } from './config.js';

export async function editOrder(id) {
    try {
        const result = await fetchOrder(id);
        if (result.success && result.order) {
            const order = result.order;
            
            state.currentOrderId = id;
            state.editMode = true;
            
            const cleanDeliveryCost = String(order.delivery_cost || 0).replace(',', '.');
            const deliveryCostDisplay = parseFloat(cleanDeliveryCost) || 0;
            
            state.editOrderData = {
                client_name: order.client_name || '',
                phone: order.phone || '',
                address: order.address || '',
                delivery_needed: order.delivery_needed || 0,
                card_payment: order.card_payment || 0,
                delivery_cost: deliveryCostDisplay,
                card_fee: order.card_fee || 0,
                loading_cost: order.loading_cost || 0,
                status: order.status || 'shipped'
            };
            
            // ПАРСИМ ТОВАРЫ
            const itemsMap = {};
            if (order.items) {
                order.items.split(',').forEach(item => {
                    const match = item.trim().match(/^(.+?)\s*[-–]\s*(\d+)\s*шт/);
                    if (match) {
                        const name = match[1].trim();
                        const qty = parseInt(match[2]);
                        const product = productsData.find(p => p.name === name);
                        if (product) {
                            itemsMap[product.id] = qty;
                        }
                    }
                });
            }
            state.editCart = itemsMap;
            
            // ЗАГРУЖАЕМ УСЛУГИ ИЗ БД
            state.editServices = order.services || [];

            const modal = document.getElementById('orderModal');
            document.getElementById('modalTitle').textContent = `✏️ Редактирование: ${order.order_number}`;

            let itemsHtml = '';
            let totalSum = 0;
            productsData.forEach(p => {
                const qty = state.editCart[p.id] || 0;
                const price = Math.round(p.volume * 16500);
                const sum = price * qty;
                totalSum += sum;
                itemsHtml += `
                    <div class="edit-item-row" style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #ede3d2; gap:8px; flex-wrap:wrap;">
                        <span class="item-name" style="font-weight:600; font-size:0.85rem; flex:1; min-width:150px;">${p.name}</span>
                        <div class="item-qty" style="display:flex; align-items:center; gap:6px;">
                            <button onclick="window.editChangeQty(${p.id}, -1)" style="width:28px; height:28px; border-radius:50%; border:none; background:#e2dccd; cursor:pointer; font-weight:700; font-size:1rem; transition:0.2s;">−</button>
                            <span class="qty-num" id="edit_qty_${p.id}" style="font-weight:700; font-size:1rem; min-width:30px; text-align:center;">${qty}</span>
                            <button onclick="window.editChangeQty(${p.id}, 1)" style="width:28px; height:28px; border-radius:50%; border:none; background:#e2dccd; cursor:pointer; font-weight:700; font-size:1rem; transition:0.2s;">+</button>
                        </div>
                        <span class="item-price" style="font-weight:600; color:#1f5e1f; min-width:80px; text-align:right;">${sum.toLocaleString('ru-RU')} ₽</span>
                    </div>
                `;
            });

            // РЕНДЕРИМ УСЛУГИ
            let servicesHtml = '';
            let servicesSum = 0;

            if (state.editServices.length > 0) {
                servicesHtml += `<div style="margin-top:12px; border-top:2px dashed #c8dcc8; padding-top:12px;"></div>`;
                servicesHtml += `<div style="font-size:0.8rem; font-weight:600; color:#1f5e1f; margin-bottom:6px;">🛠️ Дополнительные услуги:</div>`;
                
                state.editServices.forEach((service, idx) => {
                    servicesSum += service.price;
                    servicesHtml += `
                        <div class="edit-item-row" style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; margin-bottom:4px; border-radius:6px; background:#f0f8f0; border:1px solid #c8dcc8; gap:8px; flex-wrap:wrap;">
                            <span class="item-name" style="font-weight:600; font-size:0.85rem; flex:1; min-width:150px; color:#1f5e1f;">🛠️ ${service.name}</span>
                            <div class="item-qty" style="display:flex; align-items:center; gap:12px;">
                                <span style="font-weight:700; color:#1f5e1f;">${service.price.toLocaleString('ru-RU')} ₽</span>
                                <button onclick="window.editRemoveService(${idx})" style="background:#ffcdd2; border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; font-weight:700; color:#c62828; transition:0.2s;">✕</button>
                            </div>
                            <span class="item-price" style="font-weight:600; color:#1f5e1f; min-width:80px; text-align:right;">${service.price.toLocaleString('ru-RU')} ₽</span>
                        </div>
                    `;
                });
            } else {
                servicesHtml = `<div style="color:#a6977c; font-size:0.8rem; margin-top:8px;">Нет дополнительных услуг</div>`;
            }

            // БЛОК ДОБАВЛЕНИЯ НОВОЙ УСЛУГИ
            servicesHtml += `
                <div style="display:flex; gap:8px; margin-top:12px; align-items:center; flex-wrap:wrap;">
                    <input type="text" id="editServiceName" placeholder="Название услуги" style="flex:2; min-width:120px; padding:6px 10px; border-radius:8px; border:1px solid #d9ceb5; font-size:0.8rem;">
                    <input type="text" id="editServicePrice" placeholder="Цена" style="width:80px; padding:6px 10px; border-radius:8px; border:1px solid #d9ceb5; font-size:0.8rem; text-align:center;">
                    <button onclick="window.editAddService()" style="background:#2c6e2c; color:white; border:none; padding:6px 16px; border-radius:30px; cursor:pointer; font-weight:600; font-size:0.8rem;">➕ Добавить услугу</button>
                </div>
            `;

            const loadingCost = Number(order.loading_cost) || 0;
            const hasLoading = loadingCost > 0;

            const finalTotal = totalSum + servicesSum + deliveryCostDisplay + (order.card_fee || 0) + loadingCost;

            document.getElementById('modalBody').innerHTML = `
                <div class="detail-row" style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:0.9rem; flex-wrap:wrap;">
                    <strong style="min-width:110px;">👤 Покупатель:</strong>
                    <input type="text" id="editClientName" value="${order.client_name || ''}" placeholder="Введите имя" style="flex:1; padding:6px 10px; border-radius:8px; border:1px solid #d9ceb5; font-size:0.85rem; min-width:120px;">
                </div>
                <div class="detail-row" style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:0.9rem; flex-wrap:wrap;">
                    <strong style="min-width:110px;">📞 Телефон:</strong>
                    <input type="text" id="editClientPhone" value="${order.phone || ''}" placeholder="+7 XXX XXX-XX-XX" style="flex:1; padding:6px 10px; border-radius:8px; border:1px solid #d9ceb5; font-size:0.85rem; min-width:120px;">
                </div>
                <div class="detail-row" style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:0.9rem; flex-wrap:wrap;">
                    <strong style="min-width:110px;">📍 Адрес:</strong>
                    <input type="text" id="editClientAddress" value="${order.address || ''}" placeholder="Населенный пункт" style="flex:1; padding:6px 10px; border-radius:8px; border:1px solid #d9ceb5; font-size:0.85rem; min-width:120px;">
                </div>
                <div class="detail-row" style="display:flex; align-items:center; gap:10px; padding:4px 0; font-size:0.9rem; flex-wrap:wrap;">
                    <strong style="min-width:110px;">📌 Статус:</strong>
                    <select id="editStatus" style="padding:6px 12px; border-radius:8px; border:1px solid #d9ceb5; font-size:0.85rem; background:white; min-width:150px;">
                        <option value="preorder" ${order.status === 'preorder' ? 'selected' : ''}>📦 Предзаказ</option>
                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>✅ Отгружена</option>
                        <option value="unpaid" ${order.status === 'unpaid' ? 'selected' : ''}>📌 Не оплачена</option>
                    </select>
                    <span style="font-size:0.7rem; color:#6b5f4a;">(изменение статуса влияет на остатки)</span>
                </div>
                <div class="edit-checkbox" style="display:flex; align-items:center; gap:10px; padding:4px 0;">
                    <input type="checkbox" id="editDelivery" ${order.delivery_needed ? 'checked' : ''}>
                    <label for="editDelivery">🚚 Доставка</label>
                    <input type="text" id="editDeliveryCost" value="${deliveryCostDisplay}" placeholder="Стоимость" style="width:100px; padding:4px 8px; border-radius:8px; border:1px solid #d9ceb5; margin-left:8px;">
                    <span>₽</span>
                </div>
                <div class="edit-checkbox" style="display:flex; align-items:center; gap:10px; padding:4px 0;">
                    <input type="checkbox" id="editCard" ${order.card_payment ? 'checked' : ''}>
                    <label for="editCard">💳 Оплата картой (+10%)</label>
                </div>
                <div class="edit-checkbox" style="display:flex; align-items:center; gap:10px; padding:4px 0;">
                    <input type="checkbox" id="editLoading" ${hasLoading ? 'checked' : ''} style="accent-color:#1565c0;">
                    <label for="editLoading" style="color:#1565c0;">🔄 Погрузка (100 ₽/м³)</label>
                    <span style="font-size:0.7rem; color:#6b5f4a; margin-left:4px;">(автоматически)</span>
                </div>
                <div style="margin-top:12px; max-height:300px; overflow-y:auto; border:1px solid #ede3d2; border-radius:8px; padding:8px;">
                    ${itemsHtml}
                    ${servicesHtml}
                </div>
                <div class="edit-total" style="background:#e9e0cf; padding:10px 16px; border-radius:10px; margin-top:12px; display:flex; justify-content:space-between; font-weight:700; font-size:1.1rem;">
                    <span>ИТОГО:</span>
                    <span class="sum" id="editTotalSum" style="color:#1f5e1f;">${finalTotal.toLocaleString('ru-RU')} ₽</span>
                </div>
                <div style="font-size:0.7rem; color:#8a7b64; margin-top:4px;">⚠️ Изменение количества повлияет на остатки</div>
            `;

            document.getElementById('editDeliveryCost').addEventListener('input', window.updateEditTotal);
            document.getElementById('editDelivery').addEventListener('change', window.updateEditTotal);
            document.getElementById('editCard').addEventListener('change', window.updateEditTotal);
            document.getElementById('editLoading').addEventListener('change', window.updateEditTotal);

            const modalActions = document.getElementById('modalActions');
            if (modalActions) {
                modalActions.innerHTML = `
                    <button class="btn-edit-save" onclick="window.saveEditedOrder()" style="background:#2c6e2c; color:white; border:none; padding:10px 20px; border-radius:30px; cursor:pointer; font-weight:700; font-size:0.9rem; transition:0.2s; width:100%;">💾 Сохранить изменения</button>
                    <button class="btn-print-in-modal" onclick="window.printModalOrder()" style="background:#d32f2f; color:white; border:none; padding:10px 20px; border-radius:30px; cursor:pointer; font-weight:600; font-size:0.9rem; transition:0.2s; width:100%;">🖨️ Распечатать накладную</button>
                    <button class="btn-edit-save" onclick="window.closeModal()" style="background:#5a4a32; color:white; border:none; padding:10px 20px; border-radius:30px; cursor:pointer; font-weight:700; font-size:0.9rem; transition:0.2s; width:100%;">❌ Отмена</button>
                `;
            }
            modal.classList.add('active');
            window.updateEditTotal();
        }
    } catch(e) {
        console.error('❌ Ошибка редактирования:', e);
        alert('Не удалось загрузить заявку для редактирования');
    }
}

export function editChangeQty(id, delta) {
    const current = state.editCart[id] || 0;
    const newQty = Math.max(0, current + delta);
    if (newQty === 0) {
        delete state.editCart[id];
    } else {
        state.editCart[id] = newQty;
    }
    document.getElementById(`edit_qty_${id}`).textContent = newQty;
    window.updateEditTotal();
}

export function editRemoveService(index) {
    if (!confirm(`Удалить услугу "${state.editServices[index].name}"?`)) return;
    state.editServices.splice(index, 1);
    window.updateEditTotal();
    window.editOrder(state.currentOrderId);
}

export function editAddService() {
    const nameInput = document.getElementById('editServiceName');
    const priceInput = document.getElementById('editServicePrice');

    const name = nameInput.value.trim();
    const price = parseInt(priceInput.value.replace(/[^\d]/g, '')) || 0;

    if (!name) {
        alert('⚠️ Введите название услуги!');
        nameInput.focus();
        return;
    }

    if (price <= 0) {
        alert('⚠️ Введите корректную цену!');
        priceInput.focus();
        return;
    }

    state.editServices.push({ name, price });

    nameInput.value = '';
    priceInput.value = '';
    nameInput.focus();

    window.editOrder(state.currentOrderId);
}

export function updateEditTotal() {
    let totalSum = 0;
    const volumeMap = {};
    
    productsData.forEach(p => {
        const qty = state.editCart[p.id] || 0;
        const price = Math.round(p.volume * 16500);
        totalSum += price * qty;
        if (qty > 0) {
            volumeMap[p.id] = p.volume * qty;
        }
    });
    
    const totalVolume = Object.values(volumeMap).reduce((sum, v) => sum + v, 0);
    
    const deliveryCost = parseInt(document.getElementById('editDeliveryCost')?.value?.replace(/[^\d]/g, '') || 0) || 0;
    const hasDelivery = document.getElementById('editDelivery')?.checked || false;
    const hasCard = document.getElementById('editCard')?.checked || false;
    const hasLoading = document.getElementById('editLoading')?.checked || false;
    
    const cardFee = hasCard ? Math.round(totalSum * 0.10) : 0;
    
    const loadingRate = parseFloat(localStorage.getItem('loadingPrice')) || 150;
    const calculated = Math.round(totalVolume * loadingRate);
    const loadingCost = hasLoading ? Math.max(100, calculated) : 0;
    
    const servicesSum = state.editServices.reduce((sum, s) => sum + s.price, 0);
    
    const finalTotal = totalSum + (hasDelivery ? deliveryCost : 0) + cardFee + loadingCost + servicesSum;
    
    const totalEl = document.getElementById('editTotalSum');
    if (totalEl) {
        totalEl.textContent = finalTotal.toLocaleString('ru-RU') + ' ₽';
    }
}