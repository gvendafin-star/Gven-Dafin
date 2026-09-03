export function calculateVolumeFromItems(itemsStr) {
    if (!itemsStr) return 0;
    const items = itemsStr.split(',').map(item => item.trim());
    let totalVolume = 0;
    items.forEach(item => {
        const match = item.match(/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*[-–]\s*(\d+)\s*шт/);
        if (match) {
            const w = parseFloat(match[1]), h = parseFloat(match[2]), l = parseFloat(match[3]), qty = parseInt(match[4]);
            if (!isNaN(w) && !isNaN(h) && !isNaN(l) && !isNaN(qty)) {
                totalVolume += w * h * l * qty;
            }
        }
    });
    return Math.round(totalVolume * 1000) / 1000;
}

export function calculateAvgDailyVolume(orders) {
    if (!orders || orders.length === 0) return { avg: 0, days: 0, totalVolume: 0 };
    const daysMap = new Map();
    orders.forEach(order => {
        const date = new Date(order.created_at).toDateString();
        daysMap.set(date, (daysMap.get(date) || 0) + (order.volume || 0));
    });
    const days = daysMap.size;
    const totalVolume = Array.from(daysMap.values()).reduce((sum, vol) => sum + vol, 0);
    return {
        avg: days > 0 ? Math.round((totalVolume / days) * 1000) / 1000 : 0,
        days: days,
        totalVolume: Math.round(totalVolume * 1000) / 1000
    };
}

export function getStatusInfo(status) {
    const statusMap = {
        'preorder': { 
            label: '📦 Предзаказ', 
            class: 'status-preorder',
            rowClass: 'status-preorder-row'
        },
        'shipped': { 
            label: '✅ Отгружена', 
            class: 'status-shipped',
            rowClass: 'status-shipped-row'
        },
        'unpaid': { 
            label: '❌ Не оплачена', 
            class: 'status-unpaid',
            rowClass: 'status-unpaid-row'
        }
    };
    return statusMap[status] || statusMap['shipped'];
}