// ============================================================
// ПИЛОМАТЕРИАЛЫ - КАТАЛОГ
// ============================================================

function groupProductsByType(products) {
    const groups = {};
    products.forEach(p => {
        const parts = p.name.split('x').map(s => s.trim());
        if (parts.length === 3) {
            const w = parts[0], h = parts[1], key = `${w} x ${h}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        } else {
            if (!groups[p.name]) groups[p.name] = [];
            groups[p.name].push(p);
        }
    });
    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => {
            const getLen = (name) => { 
                const parts = name.split('x').map(s => parseFloat(s.trim())); 
                return parts.length === 3 ? parts[2] : 0; 
            };
            return getLen(b.name) - getLen(a.name);
        });
    });
    return groups;
}

function getStockStatus(available, isPreorderMode) {
    if (isPreorderMode) {
        return { status: 'preorder', label: `📦 Предзаказ (${available} шт)` };
    }
    if (available < 0) {
        return { status: 'preorder', label: `Предзаказ: ${available}` };
    }
    if (available === 0) {
        return { status: 'error', label: '❌ 0 шт' };
    }
    if (available < 10) {
        return { status: 'warning', label: `⚠️ ${available} шт` };
    }
    return { status: 'ok', label: `✅ ${available} шт` };
}

export function renderLumberCatalog(group, productsData, stocks, cart, isPreorderMode) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const products = productsData.filter(p => p.group === group);
    
    if (!products || products.length === 0) {
        grid.innerHTML = `
            <div style="text-align:center;padding:40px;color:#a6977c;">
                <div style="font-size:3rem;margin-bottom:12px;">📭</div>
                <p>Нет товаров в этой категории</p>
            </div>
        `;
        return;
    }

    const grouped = groupProductsByType(products);
    let html = '';

    Object.keys(grouped).forEach(key => {
        const items = grouped[key];
        const totalStock = items.reduce((sum, p) => sum + (stocks[p.id] || 0), 0);
        const totalClass = totalStock === 0 ? 'empty' : (totalStock < 10 ? 'warning' : 'ok');
        const totalLabel = totalStock === 0 ? 'Нет' : (totalStock < 10 ? 'Мало: ' + totalStock : totalStock + ' шт');
        
        html += `<div class="seller-product-group">
            <div class="group-header">
                <span class="group-title">${key}</span>
                <span class="group-total ${totalClass}">${totalLabel}</span>
            </div>`;
        
        items.forEach(p => {
            const available = stocks[p.id] || 0;
            const stockInfo = getStockStatus(available, isPreorderMode);
            const inCart = cart[p.id] || 0;
            
            const parts = p.name.split('x').map(s => s.trim());
            const length = parts.length === 3 ? parts[2] : '';
            const qtyInCube = p.qtyInCube || '—';
            
            html += `
                <div class="seller-product-row">
                    <div class="product-info" onclick="window.addToCartFromRow(${p.id})">
                        <span class="size">${parts.slice(0, 2).join(' x ')} <span class="length">× ${length}</span></span>
                        <span class="price">${p.price.toLocaleString('ru-RU')} ₽</span>
                        <span class="qty-in-cube">${qtyInCube} шт/м³</span>
                    </div>
                    <div class="product-actions">
                        <span class="stock ${stockInfo.status}">${stockInfo.label}</span>
                        <input type="number" class="qty-input" id="qty_${p.id}" min="1" max="${!isPreorderMode && available > 0 ? available : 999}" placeholder="1" 
                            onfocus="this.placeholder=''" 
                            onblur="this.placeholder='1'" 
                            oninput="window.scheduleAddToCart(${p.id})"
                            onclick="event.stopPropagation();">
                    </div>
                    ${inCart > 0 ? `<div class="in-cart-badge">В корзине: ${inCart} шт</div>` : ''}
                </div>
            `;
        });
        
        html += '</div>';
    });

    grid.innerHTML = html;
}

export function updateLumberBadges(productsData, stocks) {
    const groups = ['брус', 'доска50', 'доска40', 'дюймовка'];
    groups.forEach(g => {
        const filtered = productsData.filter(p => p.group === g);
        const total = filtered.reduce((sum, p) => sum + (stocks[p.id] || 0), 0);
        const badge = document.getElementById(`badge_${g}`);
        if (badge) badge.textContent = total;
    });
}