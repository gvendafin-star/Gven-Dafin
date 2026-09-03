// ============================================================
// СТРОЙМАТЕРИАЛЫ - КАТАЛОГ
// ============================================================

export function renderBuildingCatalog(products, cart, isPreorderMode) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (!products || products.length === 0) {
        grid.innerHTML = `
            <div style="text-align:center;padding:40px;color:#a6977c;">
                <div style="font-size:3rem;margin-bottom:12px;">🧱</div>
                <p>Нет стройматериалов</p>
                <p style="font-size:0.8rem;margin-top:8px;">
                    Добавьте товары в <a href="/pages/building/products.php" style="color:#2c6e2c;">номенклатуре стройматериалов</a>
                </p>
            </div>
        `;
        return;
    }

    let html = `<div style="display:grid; gap:10px;">`;
    
    products.forEach(p => {
        const available = p.stock || 0;
        const inCart = cart[p.id] || 0;
        const stockLabel = available > 0 ? `✅ ${available} шт` : (available === 0 ? '❌ 0 шт' : `📦 ${available} шт`);
        const stockClass = available > 0 ? 'ok' : (available === 0 ? 'error' : 'preorder');
        
        const weightDisplay = p.weight_kg > 0 ? `${p.weight_kg} кг/шт` : '';
        
        html += `
            <div class="seller-product-group" style="padding:12px 16px; background:#faf8f2; border:1px solid #e2dccd; border-radius:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div style="flex:1; min-width:150px;">
                        <span style="font-weight:600; font-size:0.9rem;">${p.name}</span>
                        <span style="font-size:0.7rem; color:#6b5f4a; margin-left:8px;">(${p.unit || 'шт'})</span>
                        <div style="font-size:0.7rem; color:#1f5e1f; font-weight:600;">${p.price.toLocaleString('ru-RU')} ₽ / ${p.unit || 'шт'}</div>
                        ${weightDisplay ? `<div style="font-size:0.65rem; color:#6b5f4a;">⚖️ ${weightDisplay}</div>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="stock ${stockClass}" style="font-size:0.7rem; font-weight:500; padding:2px 8px; border-radius:12px; ${stockClass === 'ok' ? 'background:#e8f5e9; color:#2e7d32;' : stockClass === 'error' ? 'background:#ffebee; color:#c62828;' : 'background:#e3f2fd; color:#0d47a1;'}">${stockLabel}</span>
                        <input type="number" class="qty-input" id="qty_${p.id}" min="1" placeholder="1" 
                            style="width:50px; padding:4px 4px; border-radius:12px; border:1px solid #d9ceb5; text-align:center; font-size:0.75rem; background:white;"
                            onfocus="this.placeholder=''" 
                            onblur="this.placeholder='1'" 
                            oninput="window.scheduleAddToCart(${p.id})">
                        <button onclick="window.addToCartFromRow(${p.id})" style="background:#5a4a32; color:white; border:none; border-radius:20px; padding:4px 16px; cursor:pointer; font-size:0.7rem; font-weight:600; transition:0.2s;">➕</button>
                    </div>
                </div>
                ${inCart > 0 ? `<div style="font-size:0.65rem; color:#1f5e1f; background:#e8f5e9; padding:2px 10px; border-radius:12px; margin-top:4px; display:inline-block;">В корзине: ${inCart} шт</div>` : ''}
            </div>
        `;
    });
    
    html += `</div>`;
    grid.innerHTML = html;
}

export function updateBuildingBadge(products) {
    const badge = document.getElementById('badge_стройматериалы');
    if (badge) {
        const total = products.reduce((sum, p) => sum + (p.stock || 0), 0);
        badge.textContent = total;
    }
}