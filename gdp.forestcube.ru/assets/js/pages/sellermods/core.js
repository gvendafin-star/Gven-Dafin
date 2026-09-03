// ============================================================
// ЯДРО ПАНЕЛИ ПРОДАВЦА - КОНСТАНТЫ И УТИЛИТЫ
// ============================================================

import { state } from '../../modules/state.js';

export const DEFAULT_LOADING_PRICE = 150;

// Получить все товары (пиломатериалы + стройматериалы)
export function getAllProducts() {
    const buildingProducts = window.__buildingProducts || [];
    return [...state.productsData, ...buildingProducts];
}

// Получить товар по ID
export function getProductById(id) {
    const all = getAllProducts();
    return all.find(p => p.id === id);
}

// Округлить до 50
export function roundTo50(amount) {
    return Math.ceil(amount / 50) * 50;
}

// Получить цену для печати
export function getPriceForPrint(productId) {
    if (state.cartPrices[productId] !== undefined) {
        return state.cartPrices[productId];
    }
    const p = getProductById(productId);
    return p ? p.price : 0;
}