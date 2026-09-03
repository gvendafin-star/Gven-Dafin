import { deleteOrderApi } from './api.js';
import { state } from './state.js';

export async function deleteOrder(id, orderNumber) {
    if (!confirm(`Удалить заявку ${orderNumber}? Номер будет освобождён.`)) return;
    try {
        const result = await deleteOrderApi(id, orderNumber);
        if (result.success) {
            alert('✅ Заявка удалена, номер освобождён');
            window.loadOrders(state.currentStatusFilter);
        } else {
            alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch(e) {
        console.error('❌ Ошибка удаления:', e);
        alert('❌ Ошибка сервера');
    }
}