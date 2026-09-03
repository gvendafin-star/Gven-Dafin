import { fetchOrder, updateOrder } from './api.js';
import { state } from './state.js';
import { productsData } from './config.js';

export async function saveEditedOrder() {
    if (!state.currentOrderId) return;

    const client_name = document.getElementById('editClientName').value.trim();
    const phone = document.getElementById('editClientPhone').value.trim();
    const address = document.getElementById('editClientAddress').value.trim();
    const delivery_needed = document.getElementById('editDelivery').checked ? 1 : 0;
    const card_payment = document.getElementById('editCard').checked ? 1 : 0;
    const hasLoading = document.getElementById('editLoading').checked || false;
    const status = document.getElementById('editStatus').value;

    const deliveryCostRaw = document.getElementById('editDeliveryCost').value.replace(/[^\d]/g, '');
    const delivery_cost = parseInt(deliveryCostRaw) || 0;

    const entries = Object.entries(state.editCart).filter(([id, qty]) => qty > 0);
    if (entries.length === 0 && state.editServices.length === 0) {
        if (!confirm('Заявка будет пустой. Удалить её?')) return;
    }

    if (!client_name || !phone) {
        alert('⚠️ Заполните имя и телефон покупателя!');
        return;
    }

    if (!confirm('Сохранить изменения? Остатки будут пересчитаны.')) return;

    const btn = document.querySelector('.btn-edit-save');
    btn.disabled = true;
    btn.textContent = '⏳ Сохранение...';

    let csrfToken = localStorage.getItem('csrf_token');
    if (!csrfToken) {
        try {
            const tokenResponse = await fetch('/api/security.php?action=token', {
                method: 'GET',
                credentials: 'same-origin'
            });
            const tokenResult = await tokenResponse.json();
            if (tokenResult.success && tokenResult.csrf_token) {
                csrfToken = tokenResult.csrf_token;
                localStorage.setItem('csrf_token', csrfToken);
                if (window.csrfToken) window.csrfToken = csrfToken;
            }
        } catch(e) {
            console.error('❌ Ошибка получения CSRF-токена:', e);
        }
    }

    if (!csrfToken) {
        alert('❌ Не удалось получить CSRF-токен для авторизации. Перезагрузите страницу.');
        btn.disabled = false;
        btn.textContent = '💾 Сохранить изменения';
        return;
    }

    try {
        const result = await fetchOrder(state.currentOrderId);
        if (!result.success || !result.order) {
            alert('❌ Не удалось загрузить оригинальную заявку');
            btn.disabled = false;
            btn.textContent = '💾 Сохранить изменения';
            return;
        }

        const originalOrder = result.order;
        const originalStatus = originalOrder.status;

        // ===== ПРАВИЛЬНАЯ ЛОГИКА СТАТУСОВ (по твоей таблице) =====

        // 1. Переход в "не оплачена" (unpaid) — ВСЕГДА возврат + уменьшение суммы
        if (status === 'unpaid' && originalStatus !== 'unpaid') {
            if (!confirm('⚠️ Вы меняете статус на "Не оплачена". Товары вернутся на склад, сумма уберётся из статистики. Продолжить?')) {
                return;
            }
        }

        // 2. Выход из "не оплачена" (unpaid) — ВСЕГДА списание + увеличение суммы
        if (originalStatus === 'unpaid' && status !== 'unpaid') {
            if (!confirm('⚠️ Вы выходите из статуса "Не оплачена". Товары будут списаны, сумма прибавится к статистике. Продолжить?')) {
                return;
            }
        }

        // 3. Переходы между preorder и shipped — ничего с остатками
        if (
            (originalStatus === 'preorder' && status === 'shipped') ||
            (originalStatus === 'shipped' && status === 'preorder')
        ) {
            // Только подтверждение, без изменения остатков
            if (!confirm('⚠️ Вы меняете статус. Остатки не изменятся. Продолжить?')) {
                return;
            }
        }

        // ПАРСИМ ТОВАРЫ
        const oldItems = {};
        if (originalOrder.items) {
            originalOrder.items.split(',').forEach(item => {
                const match = item.trim().match(/^(.+?)\s*[-–]\s*(\d+)\s*шт/);
                if (match) {
                    const name = match[1].trim();
                    const qty = parseInt(match[2]);
                    const product = productsData.find(p => p.name === name);
                    if (product) {
                        oldItems[product.id] = qty;
                    }
                }
            });
        }

        const newItemsList = [];
        const cart_items = {};
        let totalSum = 0;
        let totalVolume = 0;

        // ТОВАРЫ
        productsData.forEach(p => {
            const qty = state.editCart[p.id] || 0;
            if (qty > 0) {
                const price = Math.round(p.volume * 16500);
                const sum = price * qty;
                totalSum += sum;
                totalVolume += p.volume * qty;
                newItemsList.push(`${p.name} - ${qty} шт (${price} ₽/шт)`);
                cart_items[p.id] = qty;
            }
        });

        // УСЛУГИ
        const servicesData = state.editServices.map(service => ({
            name: service.name,
            price: service.price
        }));
        let servicesSum = state.editServices.reduce((sum, s) => sum + s.price, 0);
        state.editServices.forEach(service => {
            newItemsList.push(`🛠️ Услуга: ${service.name} - ${service.price} ₽`);
        });

        const cardFee = card_payment ? Math.round(totalSum * 0.10) : 0;
        const loadingRate = parseFloat(localStorage.getItem('loadingPrice')) || 150;
        const calculated = Math.round(totalVolume * loadingRate);
        const loadingCost = hasLoading ? Math.max(100, calculated) : 0;

        const finalTotal = totalSum + (delivery_needed ? delivery_cost : 0) + cardFee + loadingCost + servicesSum;

        const requestBody = {
            action: 'update',
            id: state.currentOrderId,
            order_number: originalOrder.order_number,
            client_name: client_name,
            phone: phone,
            address: address,
            total: finalTotal,
            delivery_cost: delivery_cost,
            card_fee: cardFee,
            loading_cost: loadingCost,
            items: newItemsList.join(', '),
            delivery_needed: delivery_needed,
            card_payment: card_payment,
            cart_items: cart_items,
            old_items: oldItems,
            status: status,
            services: servicesData,
            csrf_token: csrfToken
        };

        const updateResult = await updateOrder(requestBody);

        if (updateResult.success) {
            alert(`✅ Заявка ${originalOrder.order_number} обновлена! Остатки пересчитаны.`);
            window.closeModal();
            await window.loadOrders(state.currentStatusFilter);
        } else {
            alert('❌ Ошибка обновления: ' + (updateResult.error || 'Неизвестная ошибка'));
        }
    } catch(e) {
        console.error('❌ Ошибка сохранения:', e);
        alert('❌ Ошибка сервера');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Сохранить изменения';
    }
}