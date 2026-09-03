// ========== УСЛУГИ ==========

import { state } from './state.js';
import { renderCart } from './cart.js';

export function addService() {
    const nameInput = document.getElementById('serviceName');
    const priceInput = document.getElementById('servicePrice');
    
    const name = nameInput.value.trim();
    const price = parseInt(priceInput.value.replace(/[^\d]/g, '') || 0);
    
    if (!name) {
        alert('⚠️ Введите описание услуги!');
        nameInput.focus();
        return;
    }
    
    if (price <= 0) {
        alert('⚠️ Введите корректную стоимость услуги!');
        priceInput.focus();
        return;
    }
    
    state.services.push({ name, price });
    
    nameInput.value = '';
    priceInput.value = '';
    nameInput.focus();
    
    renderCart();
    state.isOrderSaved = false;
}

export function removeService(index) {
    state.services.splice(index, 1);
    renderCart();
    state.isOrderSaved = false;
}

export function clearServices() {
    if (state.services.length === 0) return;
    state.services = [];
    renderCart();
}