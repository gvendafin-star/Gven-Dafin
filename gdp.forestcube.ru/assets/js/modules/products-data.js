// ========== ЕДИНЫЙ ФАЙЛ ДАННЫХ ТОВАРОВ ==========
// Подключается во всех страницах и модулях

export const productsDataRaw = [
    { id: 1, group: 'брус', name: '0.15 x 0.15 x 6', volume: 0.1350, qtyInCube: 7.4 },
    { id: 2, group: 'брус', name: '0.15 x 0.15 x 5', volume: 0.1125, qtyInCube: 8.9 },
    { id: 3, group: 'брус', name: '0.15 x 0.15 x 4', volume: 0.0900, qtyInCube: 11.1 },
    { id: 4, group: 'брус', name: '0.15 x 0.1 x 6', volume: 0.0900, qtyInCube: 11.1 },
    { id: 5, group: 'брус', name: '0.15 x 0.1 x 5', volume: 0.0750, qtyInCube: 13.3 },
    { id: 6, group: 'брус', name: '0.15 x 0.1 x 4', volume: 0.0600, qtyInCube: 16.7 },
    { id: 7, group: 'брус', name: '0.1 x 0.1 x 6', volume: 0.0600, qtyInCube: 16.7 },
    { id: 8, group: 'брус', name: '0.1 x 0.1 x 5', volume: 0.0500, qtyInCube: 20.0 },
    { id: 9, group: 'брус', name: '0.1 x 0.1 x 4', volume: 0.0400, qtyInCube: 25.0 },
    { id: 10, group: 'доска50', name: '0.1 x 0.05 x 6', volume: 0.0300, qtyInCube: 33.3 },
    { id: 11, group: 'доска50', name: '0.1 x 0.05 x 5', volume: 0.0250, qtyInCube: 40.0 },
    { id: 12, group: 'доска50', name: '0.1 x 0.05 x 4', volume: 0.0200, qtyInCube: 50.0 },
    { id: 13, group: 'доска40', name: '0.1 x 0.04 x 6', volume: 0.0240, qtyInCube: 41.7 },
    { id: 14, group: 'доска40', name: '0.1 x 0.04 x 5', volume: 0.0200, qtyInCube: 50.0 },
    { id: 15, group: 'доска40', name: '0.1 x 0.04 x 4', volume: 0.0160, qtyInCube: 62.5 },
    { id: 16, group: 'доска50', name: '0.2 x 0.05 x 6', volume: 0.0600, qtyInCube: 16.7 },
    { id: 17, group: 'доска50', name: '0.2 x 0.05 x 5', volume: 0.0500, qtyInCube: 20.0 },
    { id: 18, group: 'доска50', name: '0.2 x 0.05 x 4', volume: 0.0400, qtyInCube: 25.0 },
    { id: 19, group: 'доска50', name: '0.15 x 0.05 x 6', volume: 0.0450, qtyInCube: 22.2 },
    { id: 20, group: 'доска50', name: '0.15 x 0.05 x 5', volume: 0.0375, qtyInCube: 26.7 },
    { id: 21, group: 'доска50', name: '0.15 x 0.05 x 4', volume: 0.0300, qtyInCube: 33.3 },
    { id: 22, group: 'доска40', name: '0.2 x 0.04 x 6', volume: 0.0480, qtyInCube: 20.8 },
    { id: 23, group: 'доска40', name: '0.2 x 0.04 x 5', volume: 0.0400, qtyInCube: 25.0 },
    { id: 24, group: 'доска40', name: '0.2 x 0.04 x 4', volume: 0.0320, qtyInCube: 31.3 },
    { id: 25, group: 'доска40', name: '0.15 x 0.04 x 6', volume: 0.0360, qtyInCube: 27.8 },
    { id: 26, group: 'доска40', name: '0.15 x 0.04 x 5', volume: 0.0300, qtyInCube: 33.3 },
    { id: 27, group: 'доска40', name: '0.15 x 0.04 x 4', volume: 0.0240, qtyInCube: 41.7 },
    { id: 28, group: 'дюймовка', name: '0.2 x 0.03 x 6', volume: 0.0360, qtyInCube: 27.8 },
    { id: 29, group: 'дюймовка', name: '0.2 x 0.03 x 5', volume: 0.0300, qtyInCube: 33.3 },
    { id: 30, group: 'дюймовка', name: '0.2 x 0.03 x 4', volume: 0.0240, qtyInCube: 41.7 },
    { id: 31, group: 'дюймовка', name: '0.15 x 0.03 x 6', volume: 0.0270, qtyInCube: 37.0 },
    { id: 32, group: 'дюймовка', name: '0.15 x 0.03 x 5', volume: 0.0225, qtyInCube: 44.4 },
    { id: 33, group: 'дюймовка', name: '0.15 x 0.03 x 4', volume: 0.0180, qtyInCube: 55.6 },
    { id: 34, group: 'дюймовка', name: '0.13 x 0.03 x 6', volume: 0.0234, qtyInCube: 44.4 },
    { id: 35, group: 'дюймовка', name: '0.13 x 0.03 x 5', volume: 0.0195, qtyInCube: 53.3 },
    { id: 36, group: 'дюймовка', name: '0.13 x 0.03 x 4', volume: 0.0156, qtyInCube: 66.7 },
    { id: 37, group: 'дюймовка', name: '0.1 x 0.03 x 6', volume: 0.0180, qtyInCube: 55.6 },
    { id: 38, group: 'дюймовка', name: '0.1 x 0.03 x 5', volume: 0.0150, qtyInCube: 66.7 },
    { id: 39, group: 'дюймовка', name: '0.1 x 0.03 x 4', volume: 0.0120, qtyInCube: 83.3 }
];

// ============================================================
// ⭐ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ВСЕ ЭКСПОРТИРУЮТСЯ)
// ============================================================

export function getProductById(id) {
    return productsDataRaw.find(p => p.id === id);
}

export function getProductsByGroup(group) {
    return productsDataRaw.filter(p => p.group === group);
}

export function getProductGroups() {
    const groups = {};
    productsDataRaw.forEach(p => {
        if (!groups[p.group]) groups[p.group] = [];
        groups[p.group].push(p);
    });
    return groups;
}

export function calculateVolume(productId, quantity) {
    const product = getProductById(productId);
    if (!product) return 0;
    return product.volume * quantity;
}

export function calculateVolumeByName(productName, quantity) {
    const product = productsDataRaw.find(p => p.name === productName);
    if (!product) return 0;
    return product.volume * quantity;
}

export function getProductByName(name) {
    return productsDataRaw.find(p => p.name === name);
}

// ⭐ ДЛЯ НЕ-МОДУЛЬНЫХ СКРИПТОВ (если нужно)
if (typeof window !== 'undefined') {
    window.productsDataRaw = productsDataRaw;
    window.getProductById = getProductById;
    window.getProductByName = getProductByName;
    window.calculateVolume = calculateVolume;
}

// Для совместимости со старым кодом
export default productsDataRaw;