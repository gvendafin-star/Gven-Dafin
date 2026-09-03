// ============================================================
// ГЛАВНЫЙ ФАЙЛ СТРАНИЦЫ ЗАЯВОК
// Вся логика разбита на модули в папке ordersmod/
// ============================================================

import { API_BASE, productsData } from './ordersmod/config.js';
import { state, resetState } from './ordersmod/state.js';
import { calculateVolumeFromItems, calculateAvgDailyVolume, getStatusInfo } from './ordersmod/utils.js';
import { fetchOrders, fetchOrder, updateOrder, deleteOrderApi } from './ordersmod/api.js';
import { renderOrders, updateStats } from './ordersmod/render.js';
import { loadOrders, applyFilter, loadOrdersWithDateFilter, resetFilter } from './ordersmod/filters.js';
import { viewOrder } from './ordersmod/view.js';
import { editOrder, editChangeQty, editRemoveService, editAddService, updateEditTotal } from './ordersmod/edit.js';
import { saveEditedOrder } from './ordersmod/save.js';
import { printModalOrder, printSavedOrder } from './ordersmod/print.js';
import { deleteOrder } from './ordersmod/delete.js';
import { checkAuth, logout } from './ordersmod/auth.js';
import { closeModal } from './ordersmod/modal.js';

// ============================================================
// ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ INLINE-ОБРАБОТЧИКОВ
// ============================================================
window.viewOrder = viewOrder;
window.editOrder = editOrder;
window.editChangeQty = editChangeQty;
window.editRemoveService = editRemoveService;
window.editAddService = editAddService;
window.updateEditTotal = updateEditTotal;
window.saveEditedOrder = saveEditedOrder;
window.printModalOrder = printModalOrder;
window.printSavedOrder = printSavedOrder;
window.closeModal = closeModal;
window.deleteOrder = deleteOrder;
window.applyFilter = applyFilter;
window.resetFilter = resetFilter;
window.logout = logout;
window.printSavedInvoice = window.printSavedInvoice || function() {};

// ⭐ ГЛОБАЛЬНАЯ ФУНКЦИЯ ПЕРЕЗАГРУЗКИ СПИСКА (для delete.js и других)
window.loadOrders = async function(status) {
    const filter = status || state.currentStatusFilter || 'all';
    state.currentStatusFilter = filter;
    await loadOrders(filter);
};

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
async function init() {
    await checkAuth();
    await loadOrders('all');
}

init();

// ============================================================
// ЭКСПОРТЫ
// ============================================================
export {
    API_BASE,
    productsData,
    state,
    resetState,
    calculateVolumeFromItems,
    calculateAvgDailyVolume,
    getStatusInfo,
    fetchOrders,
    fetchOrder,
    updateOrder,
    deleteOrderApi,
    renderOrders,
    updateStats,
    loadOrders,
    applyFilter,
    loadOrdersWithDateFilter,
    resetFilter,
    viewOrder,
    editOrder,
    editChangeQty,
    editRemoveService,
    editAddService,
    updateEditTotal,
    saveEditedOrder,
    printModalOrder,
    printSavedOrder,
    deleteOrder,
    checkAuth,
    logout,
    closeModal
};