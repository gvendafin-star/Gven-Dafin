// ========== API-ЗАПРОСЫ ==========

import { API_BASE } from './config.js';

let csrfToken = null;

export async function getCSRFToken() {
    try {
        const response = await fetch('/api/security.php?action=token', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        if (result.success && result.csrf_token) {
            csrfToken = result.csrf_token;
            localStorage.setItem('csrf_token', csrfToken);
            window.csrfToken = csrfToken;
            return csrfToken;
        }
    } catch(e) {
        console.warn('⚠️ Не удалось получить CSRF-токен:', e);
    }
    return null;
}

export async function secureFetch(url, options = {}) {
    let token = window.csrfToken || localStorage.getItem('csrf_token');
    
    if (!token) {
        token = await getCSRFToken();
    }
    
    const method = options.method || 'GET';
    
    if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
        options.headers = options.headers || {};
        options.headers['X-CSRF-Token'] = token || '';
        
        if (options.body && typeof options.body === 'string') {
            try {
                const body = JSON.parse(options.body);
                if (!body.csrf_token && token) {
                    body.csrf_token = token;
                    options.body = JSON.stringify(body);
                }
            } catch(e) {}
        }
    }
    
    return fetch(url, options);
}

export async function loadStocks() {
    try {
        const response = await secureFetch(`${API_BASE}/stocks.php`, { 
            method: 'GET', 
            credentials: 'same-origin' 
        });
        
        if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
        
        const result = await response.json();
        
        if (result.success && result.stocks) {
            const stocks = {};
            result.stocks.forEach(item => { 
                const id = parseInt(item.product_id);
                const available = parseInt(item.stock_available) || 0;
                stocks[id] = available;
            });
            return stocks;
        }
        return {};
    } catch(e) {
        console.error('❌ Ошибка запроса stocks:', e);
        return {};
    }
}

export async function getNewInvoiceNumber() {
    try {
        const response = await secureFetch(`${API_BASE}/invoice.php`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        if (result.success) {
            return result.invoice_number;
        }
        return null;
    } catch(e) {
        console.error('❌ Ошибка запроса номера:', e);
        return null;
    }
}

export async function saveOrderToServer(orderData) {
    try {
        const response = await secureFetch(`${API_BASE}/order.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(orderData)
        });
        return await response.json();
    } catch(e) {
        console.error('❌ Ошибка сохранения:', e);
        throw e;
    }
}

export async function loadClients() {
    try {
        const response = await secureFetch(`${API_BASE}/orders.php?action=clients`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        if (result.success && result.clients) {
            const seen = new Set();
            return result.clients.filter(c => {
                const key = c.client_name + c.phone;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }
        return [];
    } catch(e) {
        console.warn('❌ Ошибка загрузки клиентов:', e);
        return [];
    }
}

export async function checkAuth() {
    try {
        const response = await secureFetch(`${API_BASE}/check_auth.php`, { 
            method: 'GET', 
            credentials: 'same-origin',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
        
        const result = await response.json();
        return result.authorized === true;
    } catch(e) {
        console.error('❌ Ошибка проверки авторизации:', e);
        return false;
    }
}

export async function logout() {
    try { 
        const token = window.csrfToken || localStorage.getItem('csrf_token') || '';
        await fetch(`${API_BASE}/logout.php`, { 
            method: 'POST', 
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': token }
        }); 
    } catch(e) {}
    localStorage.removeItem('redirect_after_login');
    window.location.href = 'index.html';
}