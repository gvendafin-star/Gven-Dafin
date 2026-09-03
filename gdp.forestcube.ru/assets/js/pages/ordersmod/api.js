import { API_BASE } from './config.js';

export async function fetchOrders(statusFilter) {
    let url = `${API_BASE}/orders.php?action=all`;
    if (statusFilter && statusFilter !== 'all') {
        url += `&status=${encodeURIComponent(statusFilter)}`;
    }
    const response = await window.secureFetch(url, { method: 'GET', credentials: 'same-origin' });
    return response.json();
}

export async function fetchOrder(id) {
    const response = await window.secureFetch(`${API_BASE}/orders.php?action=get&id=${id}`, { method: 'GET', credentials: 'same-origin' });
    return response.json();
}

export async function updateOrder(data) {
    const response = await window.secureFetch(`${API_BASE}/order.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(data)
    });
    return response.json();
}

export async function deleteOrderApi(id, orderNumber) {
    const response = await window.secureFetch(`${API_BASE}/orders.php`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, order_number: orderNumber })
    });
    return response.json();
}