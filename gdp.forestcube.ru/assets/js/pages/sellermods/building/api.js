// ============================================================
// СТРОЙМАТЕРИАЛЫ - API (ЗАГРУЗКА ИЗ БД)
// ============================================================

export async function loadBuildingMaterials() {
    try {
        const response = await window.secureFetch('/api/building/products.php?action=list', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        if (result.success && result.products) {
            return result.products
                .filter(p => p.is_active == 1)
                .map(p => ({
                    id: 10000 + p.id,
                    group: 'стройматериалы',
                    name: p.name,
                    volume: 0,
                    qtyInCube: 0,
                    type: 'building',
                    unit: p.unit || 'шт',
                    price: parseFloat(p.price) || 0,
                    stock: p.stock || 0,
                    weight_kg: parseFloat(p.weight_kg) || 0,
                    is_active: p.is_active,
                    isBuilding: true
                }));
        }
        return [];
    } catch(e) {
        console.error('❌ Ошибка загрузки стройматериалов:', e);
        return [];
    }
}