// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

export function roundTo50(amount) {
    return Math.round(amount / 50) * 50;
}

export function calculateTotalVolume(cart, productsData) {
    const entries = Object.entries(cart).filter(([id, qty]) => qty > 0);
    return entries.reduce((sum, [id, qty]) => {
        const p = productsData.find(p => p.id === parseInt(id));
        return sum + (p ? p.volume * qty : 0);
    }, 0);
}

export function getStockStatus(available, isPreorderMode) {
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

export function groupProductsByType(products) {
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

export function calculateVolumeFromName(name) {
    const parts = name.split('x').map(p => parseFloat(p.trim().replace(',', '.')));
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return parts[0] * parts[1] * parts[2];
    }
    return 0;
}

export function recalculateProductPrices(productsDataRaw, cubePrice) {
    return productsDataRaw.map(p => ({
        ...p,
        price: Math.round(p.volume * cubePrice)
    }));
}