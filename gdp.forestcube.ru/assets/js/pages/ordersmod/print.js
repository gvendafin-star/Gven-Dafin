import { fetchOrder } from './api.js';
import { state } from './state.js';

export function printModalOrder() {
    if (!state.currentOrderId) return;
    window.printSavedOrder(state.currentOrderId);
}

export async function printSavedOrder(id) {
    try {
        const result = await fetchOrder(id);
        if (result.success && result.order) {
            window.printSavedInvoice(result.order);
        } else {
            alert('Не удалось загрузить заявку для печати');
        }
    } catch(e) {
        console.error('❌ Ошибка печати:', e);
        alert('Ошибка при печати');
    }
}