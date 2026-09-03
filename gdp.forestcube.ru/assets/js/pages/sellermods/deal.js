// ============================================================
// УПРАВЛЕНИЕ СДЕЛКОЙ
// ============================================================

import { state } from '../../modules/state.js';
import { renderCart } from '../../modules/cart.js';
import { renderCatalog, resetReminders, setActionsCompleted } from './ui.js';
import { DEFAULT_LOADING_PRICE } from './core.js';
import { DEFAULT_CUBE_PRICE } from '../../modules/config.js';

// ========== НОВАЯ СДЕЛКА ==========
export function newDeal() {
    const hasItems = Object.keys(state.cart).length > 0;
    const hasServices = state.services.length > 0;

    if (hasItems || hasServices) {
        if (!confirm('⚠️ В корзине есть товары или услуги. Начать новую сделку? Текущие данные будут очищены.')) {
            return;
        }
    }

    state.cart = {};
    state.cartPrices = {};
    state.services = [];
    state.currentInvoiceNumber = null;
    state.isOrderSaved = false;
    state.isPreorderMode = false;
    state.isLoadingEnabled = false;
    
    resetReminders();
    setActionsCompleted(false);

    document.querySelectorAll('.qty-input').forEach(input => {
        input.value = '';
        input.placeholder = '1';
    });

    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientAddress').value = '';
    document.getElementById('clientComment').value = '';

    const deliveryCheckbox = document.getElementById('optionDelivery');
    const cardCheckbox = document.getElementById('optionCard');
    const preorderCheckbox = document.getElementById('optionPreorder');
    const loadingCheckbox = document.getElementById('optionLoading');
    const unpaidCheckbox = document.getElementById('optionUnpaid');
    
    if (deliveryCheckbox) deliveryCheckbox.checked = false;
    if (cardCheckbox) cardCheckbox.checked = false;
    if (preorderCheckbox) preorderCheckbox.checked = false;
    if (loadingCheckbox) loadingCheckbox.checked = false;
    if (unpaidCheckbox) unpaidCheckbox.checked = false;

    const deliveryBlock = document.getElementById('deliveryCostBlock');
    if (deliveryBlock) deliveryBlock.classList.remove('show');
    
    const deliveryCostInput = document.getElementById('deliveryCostInput');
    if (deliveryCostInput) deliveryCostInput.value = '';

    document.getElementById('serviceName').value = '';
    document.getElementById('servicePrice').value = '';
    
    const servicesList = document.getElementById('servicesList');
    if (servicesList) servicesList.innerHTML = '';

    localStorage.removeItem('seller_client_name');
    localStorage.removeItem('seller_client_phone');
    localStorage.removeItem('seller_client_address');
    localStorage.removeItem('seller_client_comment');
    localStorage.removeItem('seller_client_delivery');
    localStorage.removeItem('seller_client_delivery_cost');
    localStorage.removeItem('seller_client_card');
    localStorage.removeItem('seller_client_loading');
    localStorage.removeItem('last_invoice_number');
    localStorage.removeItem('seller_preorder_mode');

    renderCart();
    renderCatalog(state.currentGroup);
    
    const loadingInput = document.getElementById('loadingPriceInput');
    if (loadingInput) {
        const savedLoadingPrice = localStorage.getItem('loadingPrice');
        if (savedLoadingPrice) {
            loadingInput.value = savedLoadingPrice;
        } else {
            loadingInput.value = DEFAULT_LOADING_PRICE;
        }
    }

    console.log('🔄 Новая сделка: все данные очищены');
}

// ========== СБРОС ЦЕНЫ КУБА ==========
export function resetCubePrice() {
    const input = document.getElementById('cubePriceInput');
    if (input) {
        input.value = DEFAULT_CUBE_PRICE;
    }
    // Пересчет цен выполняется через глобальную функцию, которая создается в init.js
    if (typeof window.recalculatePrices === 'function') {
        window.recalculatePrices(DEFAULT_CUBE_PRICE);
    }
    const status = document.getElementById('cubePriceStatus');
    if (status) {
        status.textContent = `↺ Цена сброшена: ${DEFAULT_CUBE_PRICE} руб/м³`;
        status.style.color = '#e65100';
        setTimeout(() => { status.textContent = ''; }, 4000);
    }
}

// ========== СБРОС ЦЕНЫ ПОГРУЗКИ ==========
export function resetLoadingPrice() {
    const input = document.getElementById('loadingPriceInput');
    if (input) input.value = DEFAULT_LOADING_PRICE;
    localStorage.setItem('loadingPrice', DEFAULT_LOADING_PRICE);
    const status = document.getElementById('cubePriceStatus');
    if (status) {
        status.textContent = `↺ Цена погрузки сброшена: ${DEFAULT_LOADING_PRICE} руб/м³`;
        status.style.color = '#0d47a1';
        setTimeout(() => { status.textContent = ''; }, 4000);
    }
}