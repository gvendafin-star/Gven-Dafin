// ============================================================
// КОРЗИНА (ОБЩАЯ) - С ПОДДЕРЖКОЙ ВЕСА
// ============================================================

import { state } from './state.js';
import { renderCatalog } from '../pages/sellermods/ui.js';
import { getProductById } from '../pages/sellermods/core.js';
import { calculateTotalVolume, roundTo50 } from './utils.js';

let addTimer = null;

// ========== КОНСТАНТЫ ПОГРУЗКИ ==========
const LOADING_RATE_PER_KG = 0.30;
const LOADING_MIN_COST = 100;
const WOOD_DENSITY = 680;

// ========== ПОЛУЧИТЬ АКТУАЛЬНУЮ ЦЕНУ ИЗ БД ==========
function getCurrentPrice(productId) {
    const p = getProductById(productId);
    if (!p) return 0;
    return p.price || 0;
}

// ========== ПОЛУЧИТЬ ВЕС ТОВАРА ==========
function getProductWeight(productId) {
    const p = getProductById(productId);
    if (!p) return 0;
    
    if (p.isBuilding) {
        return p.weight_kg || 0;
    } else {
        return (p.volume || 0) * WOOD_DENSITY;
    }
}

// ========== РАССЧИТАТЬ ОБЩИЙ ВЕС КОРЗИНЫ ==========
function calculateTotalWeight() {
    const entries = Object.entries(state.cart).filter(([id, qty]) => qty > 0);
    let totalWeight = 0;
    
    entries.forEach(([id, qty]) => {
        const weightPerUnit = getProductWeight(parseInt(id));
        totalWeight += weightPerUnit * qty;
    });
    
    return totalWeight;
}

// ========== РАССЧИТАТЬ СТОИМОСТЬ ПОГРУЗКИ ==========
function calculateLoadingCost(weight) {
    if (weight <= 0) return 0;
    const calculated = Math.round(weight * LOADING_RATE_PER_KG);
    return Math.max(LOADING_MIN_COST, calculated);
}

// ========== ДОБАВИТЬ В КОРЗИНУ ==========
export function addToCart(id, qty) {
    const p = getProductById(id);
    if (!p) {
        console.warn('⚠️ Товар не найден:', id);
        return;
    }
    
    const available = getProductStock(id);
    const inCart = state.cart[id] || 0;
    const maxQty = available - inCart;
    
    if (!state.isPreorderMode && maxQty <= 0) {
        alert(`❌ Нет в наличии! Доступно: ${available} шт, в корзине: ${inCart} шт`);
        return;
    }
    
    let finalQty = qty;
    if (!state.isPreorderMode && finalQty > maxQty) {
        alert(`⚠️ Доступно только ${maxQty} шт`);
        finalQty = maxQty;
        if (finalQty <= 0) return;
    }
    
    state.cartPrices[id] = getCurrentPrice(id);
    state.cart[id] = (state.cart[id] || 0) + finalQty;
    state.isOrderSaved = false;
    
    renderCart();
    renderCatalog(state.currentGroup);
}

// ========== ДОБАВИТЬ ИЗ СТРОКИ КАТАЛОГА ==========
export function addToCartFromRow(id) {
    const input = document.getElementById(`qty_${id}`);
    if (!input) return;
    
    const val = parseInt(input.value);
    const qty = (isNaN(val) || val <= 0) ? 1 : val;
    
    const p = getProductById(id);
    if (!p) {
        alert('❌ Товар не найден!');
        return;
    }
    
    const available = getProductStock(id);
    const inCart = state.cart[id] || 0;
    const maxQty = available - inCart;
    
    if (!state.isPreorderMode && maxQty <= 0) {
        alert(`❌ Нет в наличии! Доступно: ${available} шт, в корзине: ${inCart} шт`);
        input.value = '';
        return;
    }
    
    let finalQty = qty;
    if (!state.isPreorderMode && finalQty > maxQty) {
        alert(`⚠️ Доступно только ${maxQty} шт`);
        finalQty = maxQty;
        input.value = finalQty;
    }
    
    state.cartPrices[id] = getCurrentPrice(id);
    state.cart[id] = (state.cart[id] || 0) + finalQty;
    state.isOrderSaved = false;
    
    renderCart();
    renderCatalog(state.currentGroup);
}

// ========== АВТОДОБАВЛЕНИЕ ==========
export function scheduleAddToCart(id) {
    if (addTimer) {
        clearTimeout(addTimer);
        addTimer = null;
    }
    
    addTimer = setTimeout(function() {
        addTimer = null;
        addToCartFromRow(id);
    }, 2000);
}

// ========== ИЗМЕНИТЬ КОЛИЧЕСТВО ==========
export function changeQty(id, delta) {
    const current = state.cart[id] || 0;
    const newQty = current + delta;
    
    if (newQty <= 0) {
        delete state.cart[id];
        delete state.cartPrices[id];
    } else {
        state.cart[id] = newQty;
        state.cartPrices[id] = getCurrentPrice(id);
    }
    
    state.isOrderSaved = false;
    renderCart();
    renderCatalog(state.currentGroup);
}

// ========== РАССЧИТАТЬ ИТОГИ ==========
export function calculateTotalWithServices() {
    const entries = Object.entries(state.cart).filter(([id, qty]) => qty > 0);
    
    let totalSum = entries.reduce((sum, [id, qty]) => {
        const price = getCurrentPrice(parseInt(id));
        return sum + (price * qty);
    }, 0);
    
    const totalVolume = entries.reduce((sum, [id, qty]) => {
        const p = getProductById(parseInt(id));
        return sum + (p ? (p.volume || 0) * qty : 0);
    }, 0);
    
    const totalWeight = calculateTotalWeight();
    
    const clientData = getClientData();
    let deliveryCost = 0;
    let cardFee = 0;
    let loadingCost = 0;
    
    if (clientData.delivery) {
        deliveryCost = parseInt(document.getElementById('deliveryCostInput')?.value?.replace(/[^\d]/g, '') || 0) || 0;
    }
    
    if (clientData.card) {
        cardFee = Math.round(totalSum * 0.10);
    }
    
    if (state.isLoadingEnabled && totalWeight > 0) {
        loadingCost = calculateLoadingCost(totalWeight);
    }
    
    const servicesTotal = state.services.reduce((sum, s) => sum + s.price, 0);
    const finalTotalRaw = totalSum + deliveryCost + cardFee + loadingCost + servicesTotal;
    const finalTotal = roundTo50(finalTotalRaw);
    
    return {
        totalSum,
        deliveryCost,
        cardFee,
        loadingCost,
        servicesTotal,
        finalTotal,
        finalTotalRaw,
        totalVolume,
        totalWeight,
        hasDelivery: clientData.delivery,
        hasCard: clientData.card,
        hasLoading: state.isLoadingEnabled && totalWeight > 0
    };
}

// ========== ОТРИСОВКА КОРЗИНЫ ==========
export function renderCart() {
    const container = document.getElementById('cartItems');
    if (!container) return;
    
    const countSpan = document.getElementById('cartCount');
    const totalQtySpan = document.getElementById('cartTotalQty');
    const totalVolumeSpan = document.getElementById('cartTotalVolume');
    const totalWeightSpan = document.getElementById('cartTotalWeight');
    const totalSumSpan = document.getElementById('cartTotalSum');
    const deliveryRow = document.getElementById('deliveryRow');
    const deliveryCostSpan = document.getElementById('cartDeliveryCost');
    const loadingRow = document.getElementById('loadingRow');
    const loadingCostSpan = document.getElementById('cartLoadingCost');
    const cardRow = document.getElementById('cardRow');
    const cardFeeSpan = document.getElementById('cartCardFee');
    const invoiceNumberSpan = document.getElementById('cartInvoiceNumber');
    const saveStatusSpan = document.getElementById('saveStatus');
    const servicesRow = document.getElementById('servicesRow');
    const servicesSumSpan = document.getElementById('cartServicesSum');
    
    const entries = Object.entries(state.cart).filter(([id, qty]) => qty > 0);
    const totalQty = entries.reduce((sum, [id, qty]) => sum + qty, 0);
    const totalVolume = entries.reduce((sum, [id, qty]) => {
        const p = getProductById(parseInt(id));
        return sum + (p ? (p.volume || 0) * qty : 0);
    }, 0);
    const totalWeight = calculateTotalWeight();
    const totals = calculateTotalWithServices();
    const finalTotalWithServices = totals.finalTotal;
    
    if (countSpan) countSpan.textContent = totalQty + ' шт' + (state.services.length > 0 ? ` +${state.services.length} услуг` : '');
    if (totalQtySpan) totalQtySpan.textContent = totalQty + ' шт';
    if (totalVolumeSpan) totalVolumeSpan.textContent = totalVolume.toFixed(3) + ' м³';
    if (totalWeightSpan) {
        totalWeightSpan.textContent = totalWeight > 0 ? totalWeight.toFixed(1) + ' кг' : '0 кг';
    }
    if (totalSumSpan) totalSumSpan.textContent = finalTotalWithServices.toLocaleString('ru-RU') + ' ₽';
    
    if (deliveryRow && deliveryCostSpan) {
        if (totals.hasDelivery && totals.deliveryCost > 0) {
            deliveryRow.style.display = 'flex';
            deliveryCostSpan.textContent = totals.deliveryCost.toLocaleString('ru-RU') + ' ₽';
        } else {
            deliveryRow.style.display = 'none';
        }
    }
    
    if (loadingRow && loadingCostSpan) {
        if (totals.hasLoading && totals.loadingCost > 0) {
            loadingRow.style.display = 'flex';
            loadingCostSpan.textContent = totals.loadingCost.toLocaleString('ru-RU') + ' ₽';
            const weightDisplay = document.getElementById('loadingWeightDisplay');
            if (weightDisplay) {
                weightDisplay.textContent = `(${totalWeight.toFixed(1)} кг)`;
            }
        } else {
            loadingRow.style.display = 'none';
        }
    }
    
    if (cardRow && cardFeeSpan) {
        if (totals.hasCard && totals.cardFee > 0) {
            cardRow.style.display = 'flex';
            cardFeeSpan.textContent = totals.cardFee.toLocaleString('ru-RU') + ' ₽';
        } else {
            cardRow.style.display = 'none';
        }
    }
    
    if (servicesRow && servicesSumSpan) {
        if (state.services.length > 0) {
            servicesRow.style.display = 'flex';
            servicesSumSpan.textContent = totals.servicesTotal.toLocaleString('ru-RU') + ' ₽';
        } else {
            servicesRow.style.display = 'none';
        }
    }
    
    const servicesContainer = document.getElementById('servicesList');
    if (servicesContainer) {
        if (state.services.length > 0) {
            servicesContainer.innerHTML = state.services.map((s, idx) => `
                <span style="display:inline-flex; align-items:center; gap:6px; background:#e8f5e9; padding:4px 12px; border-radius:20px; font-size:0.75rem; border:1px solid #a5d6a7;">
                    🛠️ ${s.name}
                    <span style="font-weight:700; color:#1f5e1f;">${s.price.toLocaleString('ru-RU')} ₽</span>
                    <button onclick="window.removeService(${idx})" style="background:none; border:none; color:#c62828; cursor:pointer; font-weight:700; font-size:0.9rem; padding:0 2px;">×</button>
                </span>
            `).join('');
        } else {
            servicesContainer.innerHTML = '';
        }
    }
    
    if (invoiceNumberSpan) {
        if (state.currentInvoiceNumber) {
            const statusText = state.isOrderSaved ? '✅ Сохранена' : '⏳ Не сохранена';
            invoiceNumberSpan.textContent = state.currentInvoiceNumber;
            if (saveStatusSpan) {
                saveStatusSpan.textContent = statusText;
                saveStatusSpan.style.color = state.isOrderSaved ? '#2e7d32' : '#e65100';
            }
        } else {
            invoiceNumberSpan.textContent = '--';
            if (saveStatusSpan) {
                saveStatusSpan.textContent = 'Новый заказ';
                saveStatusSpan.style.color = '#6b5f4a';
            }
        }
    }
    
    if (entries.length === 0 && state.services.length === 0) {
        container.innerHTML = `<div class="cart-empty"><div class="icon">🛒</div><p>Корзина пуста</p><p style="font-size:0.7rem;">Введите количество в каталоге или добавьте услугу</p></div>`;
        return;
    }
    
    let html = '';
    
    entries.forEach(([id, qty]) => {
        const p = getProductById(parseInt(id));
        if (!p) return;
        const currentPrice = state.cartPrices[id] !== undefined ? state.cartPrices[id] : p.price;
        const defaultPrice = p.price;
        const sum = currentPrice * qty;
        const isPriceChanged = currentPrice !== defaultPrice;
        const itemVolume = (p.volume || 0) * qty;
        const itemWeight = getProductWeight(parseInt(id)) * qty;
        
        html += `
            <div class="cart-item" data-id="${p.id}">
                <div class="info">
                    <div class="name">${p.name} ${state.isPreorderMode ? '<span style="color:#e65100; font-size:0.6rem;">📦 предзаказ</span>' : ''}</div>
                    <div class="detail">
                        <span style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span>Цена:</span>
                            <input type="text" class="cart-price-input" data-id="${p.id}" 
                                   value="${currentPrice}" 
                                   style="width:70px; padding:2px 6px; border-radius:8px; border:1px solid ${isPriceChanged ? '#b8860b' : '#d9ceb5'}; font-weight:${isPriceChanged ? '700' : '400'}; background:${isPriceChanged ? '#fffef0' : 'white'}; text-align:center; font-size:0.85rem;">
                            <span>₽ × ${qty} шт</span>
                            ${p.isBuilding ? `<span style="color:#6b5f4a; font-size:0.7rem; background:#f5f0e5; padding:1px 10px; border-radius:12px;">${p.unit || 'шт'}</span>` : `<span style="color:#0d47a1; font-weight:600; font-size:0.8rem; background:#e3f2fd; padding:1px 10px; border-radius:12px;">${itemVolume.toFixed(3)} м³</span>`}
                            ${itemWeight > 0 ? `<span style="color:#6b5f4a; font-size:0.65rem;">⚖️ ${itemWeight.toFixed(1)} кг</span>` : ''}
                            ${isPriceChanged ? '<span style="font-size:0.6rem; color:#e65100; background:#fff3e0; padding:1px 8px; border-radius:10px;">✏️ изменена</span>' : `<span style="font-size:0.6rem; color:#8a7b64;">(база: ${defaultPrice} ₽)</span>`}
                        </span>
                    </div>
                </div>
                <div class="qty-control">
                    <button onclick="window.changeQty(${p.id}, -1)">−</button>
                    <span class="qty">${qty}</span>
                    <button onclick="window.changeQty(${p.id}, 1)">+</button>
                    <button class="danger" onclick="window.changeQty(${p.id}, -999)" style="margin-left:4px; background:#ffcdd2;">✕</button>
                </div>
                <div class="item-sum">${sum.toLocaleString('ru-RU')} ₽</div>
            </div>
        `;
    });
    
    if (state.services.length > 0) {
        html += `<div style="margin-top:8px; padding-top:8px; border-top:2px dashed #c8dcc8;"></div>`;
        state.services.forEach((service, idx) => {
            html += `
                <div class="cart-item" style="background:#f0f8f0; border-radius:8px; padding:6px 12px; border-bottom:1px solid #dce8dc;">
                    <div class="info">
                        <div class="name" style="color:#1f3a1f;">🛠️ ${service.name}</div>
                        <div class="detail" style="font-size:0.7rem; color:#4a7a4a;">Услуга</div>
                    </div>
                    <div class="qty-control">
                        <span style="font-weight:700; color:#1f5e1f; margin-right:8px;">${service.price.toLocaleString('ru-RU')} ₽</span>
                        <button class="danger" onclick="window.removeService(${idx})" style="width:28px; height:28px; border-radius:50%; border:none; background:#ffcdd2; cursor:pointer; font-weight:700; font-size:0.9rem;">✕</button>
                    </div>
                    <div class="item-sum">${service.price.toLocaleString('ru-RU')} ₽</div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
    
    document.querySelectorAll('.cart-price-input').forEach(input => {
        input.addEventListener('change', function() {
            const id = parseInt(this.dataset.id);
            let newPrice = parseFloat(this.value.replace(',', '.'));
            const p = getProductById(id);
            const defaultPrice = p ? p.price : 0;
            
            if (isNaN(newPrice) || newPrice <= 0) newPrice = defaultPrice;
            newPrice = Math.round(newPrice);
            
            state.cartPrices[id] = newPrice;
            this.value = newPrice;
            
            const isChanged = newPrice !== defaultPrice;
            this.style.borderColor = isChanged ? '#b8860b' : '#d9ceb5';
            this.style.fontWeight = isChanged ? '700' : '400';
            this.style.background = isChanged ? '#fffef0' : 'white';
            
            renderCart();
        });
        
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^\d.,]/g, '');
        });
        
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') this.blur();
        });
    });
}

// ========== ПОЛУЧИТЬ ОСТАТОК ==========
function getProductStock(productId) {
    const p = getProductById(productId);
    if (!p) return 0;
    if (p.isBuilding) {
        return p.stock || 0;
    }
    return state.stocks[productId] || 0;
}

// ========== ПОЛУЧИТЬ ДАННЫЕ КЛИЕНТА ==========
function getClientData() {
    return {
        delivery: document.getElementById('optionDelivery')?.checked || false,
        card: document.getElementById('optionCard')?.checked || false,
        deliveryCost: parseInt(document.getElementById('deliveryCostInput')?.value?.replace(/[^\d]/g, '') || 0) || 0
    };
}

// ========== ОЧИСТИТЬ КОРЗИНУ ==========
export function clearCart() {
    const hasItems = Object.keys(state.cart).length > 0;
    const hasServices = state.services.length > 0;
    
    if (!hasItems && !hasServices) return;
    if (!confirm('Очистить корзину и услуги?')) return;
    
    state.cart = {};
    state.cartPrices = {};
    state.services = [];
    state.currentInvoiceNumber = null;
    state.isOrderSaved = false;
    
    document.querySelectorAll('.qty-input').forEach(input => {
        input.value = '';
        input.placeholder = '1';
    });
    
    renderCart();
    renderCatalog(state.currentGroup);
}