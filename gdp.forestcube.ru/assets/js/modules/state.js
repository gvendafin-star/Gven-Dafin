// ========== ГЛОБАЛЬНОЕ СОСТОЯНИЕ ==========

import { DEFAULT_CUBE_PRICE } from './config.js';
import { productsDataRaw } from './products-data.js';
import { recalculateProductPrices } from './utils.js';

export const state = {
    cart: {},
    cartPrices: {},
    currentGroup: 'брус',
    stocks: {},
    currentInvoiceNumber: null,
    clientsCache: [],
    addTimer: null,
    isOrderSaved: false,
    cubePrice: DEFAULT_CUBE_PRICE,
    productsData: recalculateProductPrices(productsDataRaw, DEFAULT_CUBE_PRICE),
    productsDataRaw: productsDataRaw,
    isPreorderMode: false,
    isLoadingEnabled: false,
    services: []
};

export function updateProductsData(cubePrice) {
    state.cubePrice = cubePrice;
    state.productsData = recalculateProductPrices(productsDataRaw, cubePrice);
    localStorage.setItem('cubePrice', cubePrice);
}