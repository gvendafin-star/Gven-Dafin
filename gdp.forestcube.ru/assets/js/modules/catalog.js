// ========== КАТАЛОГ ==========

import { state } from './state.js';
import { GROUPS } from './config.js';
import { getStockStatus, groupProductsByType } from './utils.js';

export function renderCatalog(group) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    const filtered = state.productsData.filter(p => p.group === group);
    const grouped = groupProductsByType(filtered);
    
    updateBadges();
    
    grid.innerHTML = '';
    Object.keys(grouped).forEach(key => {
        const items = grouped[key];
        const totalStock = items.reduce((sum, p) => sum + (state.stocks[p.id] || 0), 0);
        const totalClass = totalStock === 0 ? 'empty' : (totalStock < 10 ? 'warning' : 'ok');
        const totalLabel = totalStock === 0 ? 'Нет' : (totalStock < 10 ? 'Мало: ' + totalStock : totalStock + ' шт');
        
        let html = `<div class="seller-product-group">
            <div class="group-header">
                <span class="group-title">${key}</span>
                <span class="group-total ${totalClass}">${totalLabel}</span>
            </div>`;
        
        items.forEach(p => {
            const available = state.stocks[p.id] || 0;
            const stockInfo = getStockStatus(available, state.isPreorderMode);
            const inCart = state.cart[p.id] || 0;
            
            const parts = p.name.split('x').map(s => s.trim());
            const length = parts.length === 3 ? parts[2] : '';
            const qtyInCube = p.qtyInCube || '—';
            
            html += `
                <div class="seller-product-row">
                    <div class="product-info" onclick="addToCartFromRow(${p.id})">
                        <span class="size">${parts.slice(0, 2).join(' x ')} <span class="length">× ${length}</span></span>
                        <span class="price">${p.price.toLocaleString('ru-RU')} ₽</span>
                        <span class="qty-in-cube">${qtyInCube} шт/м³</span>
                    </div>
                    <div class="product-actions">
                        <span class="stock ${stockInfo.status}" title="${stockInfo.label}">${stockInfo.label}</span>
                        <input type="number" class="qty-input" id="qty_${p.id}" min="1" max="${!state.isPreorderMode && available > 0 ? available : 999}" placeholder="1" 
                            onfocus="this.placeholder=''" 
                            onblur="this.placeholder='1'" 
                            oninput="scheduleAddToCart(${p.id})"
                            onclick="event.stopPropagation();">
                    </div>
                    ${inCart > 0 ? `<div class="in-cart-badge">В корзине: ${inCart} шт</div>` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        grid.innerHTML += html;
    });
    
    updateStatsIfExists();
}

export function updateBadges() {
    GROUPS.forEach(g => {
        const filtered = state.productsData.filter(p => p.group === g);
        const total = filtered.reduce((sum, p) => sum + (state.stocks[p.id] || 0), 0);
        const badge = document.getElementById(`badge_${g}`);
        if (badge) badge.textContent = total;
    });
}

export function updateStatsIfExists() {
    const statTotal = document.getElementById('statTotal');
    const statInStock = document.getElementById('statInStock');
    const statLowStock = document.getElementById('statLowStock');
    const statOutOfStock = document.getElementById('statOutOfStock');
    const statTotalStock = document.getElementById('statTotalStock');
    const statPreorder = document.getElementById('statPreorder');
    
    const total = state.productsData.length;
    const inStock = state.productsData.filter(p => (state.stocks[p.id] || 0) > 0).length;
    const lowStock = state.productsData.filter(p => (state.stocks[p.id] || 0) > 0 && (state.stocks[p.id] || 0) < 10).length;
    const outOfStock = state.productsData.filter(p => (state.stocks[p.id] || 0) === 0).length;
    const preorder = state.productsData.filter(p => (state.stocks[p.id] || 0) < 0).length;
    const totalAvailable = state.productsData.reduce((sum, p) => sum + (state.stocks[p.id] || 0), 0);
    
    if (statTotal) statTotal.textContent = total;
    if (statInStock) statInStock.textContent = inStock;
    if (statLowStock) statLowStock.textContent = lowStock;
    if (statOutOfStock) statOutOfStock.textContent = outOfStock;
    if (statTotalStock) statTotalStock.textContent = totalAvailable;
    if (statPreorder) statPreorder.textContent = preorder;
}