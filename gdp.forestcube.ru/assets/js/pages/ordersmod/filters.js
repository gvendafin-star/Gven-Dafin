import { fetchOrders } from './api.js';
import { state } from './state.js';
import { renderOrders, updateStats } from './render.js';
import { calculateVolumeFromItems } from './utils.js';

export async function loadOrders(statusFilter) {
    const container = document.getElementById('ordersContainer');
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="margin-top:12px;">Загрузка заявок...</p></div>`;
    
    try {
        const result = await fetchOrders(statusFilter);
        if (result.success && result.orders) {
            state.allOrders = result.orders.map(order => {
                order.volume = calculateVolumeFromItems(order.items);
                return order;
            });
            renderOrders(state.allOrders);
            updateStats(state.allOrders);
        } else {
            container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>Нет заявок</p></div>`;
        }
    } catch(e) {
        console.error('❌ Ошибка загрузки:', e);
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Не удалось загрузить заявки: ${e.message}</p></div>`;
    }
}

export function applyFilter() {
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    state.currentStatusFilter = statusFilter;
    loadOrdersWithDateFilter(statusFilter, dateFrom, dateTo);
}

export async function loadOrdersWithDateFilter(statusFilter, dateFrom, dateTo) {
    const container = document.getElementById('ordersContainer');
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="margin-top:12px;">Загрузка заявок...</p></div>`;
    
    try {
        const result = await fetchOrders(statusFilter);
        if (result.success && result.orders) {
            let filtered = result.orders.map(order => {
                order.volume = calculateVolumeFromItems(order.items);
                return order;
            });
            
            if (dateFrom) {
                const from = new Date(dateFrom);
                from.setHours(0, 0, 0, 0);
                filtered = filtered.filter(o => new Date(o.created_at) >= from);
            }
            if (dateTo) {
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                filtered = filtered.filter(o => new Date(o.created_at) <= to);
            }
            
            state.allOrders = filtered;
            renderOrders(filtered);
            updateStats(filtered);
        } else {
            container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>Нет заявок</p></div>`;
        }
    } catch(e) {
        console.error('❌ Ошибка загрузки:', e);
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Не удалось загрузить заявки: ${e.message}</p></div>`;
    }
}

export function resetFilter() {
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    state.currentStatusFilter = 'all';
    loadOrders('all');
}