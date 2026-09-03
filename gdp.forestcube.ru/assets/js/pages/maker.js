// ============================================================
// МЕЙКЕР (maker.js) - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ
// ============================================================

const API_BASE = '/api';
const NOTIFICATION_SOUND = '/other/notification.mp3';
let audio = new Audio(NOTIFICATION_SOUND);
let tasks = [];
let allCompletedOrders = []; // Только для подсчёта заработка
let todayEarnings = 0;
let totalEarnings = 0;
let isLoading = false;
let lastOrderCount = 0;
let lastCheckTime = 0;
let notificationEnabled = false;
let firstLoad = true;

// ========== СОХРАНЕНИЕ СОСТОЯНИЯ ==========
function saveLastOrderCount(count) {
    try {
        localStorage.setItem('maker_last_order_count', String(count));
    } catch(e) {}
}

function loadLastOrderCount() {
    try {
        const saved = localStorage.getItem('maker_last_order_count');
        return saved ? parseInt(saved) : 0;
    } catch(e) {
        return 0;
    }
}

// ========== ПРОВЕРКА ПОДДЕРЖКИ УВЕДОМЛЕНИЙ ==========
function isPushSupported() {
    return 'Notification' in window && 
           'serviceWorker' in navigator && 
           'PushManager' in window;
}

// ========== ЗАПРОС РАЗРЕШЕНИЯ НА УВЕДОМЛЕНИЯ ==========
async function requestNotificationPermission() {
    if (!isPushSupported()) {
        console.warn('⚠️ Push-уведомления не поддерживаются в этом браузере');
        return false;
    }

    try {
        if (Notification.permission === 'granted') {
            notificationEnabled = true;
            const statusEl = document.getElementById('pushStatus');
            if (statusEl) {
                statusEl.textContent = '🔔 Уведомления включены';
                statusEl.style.color = '#2e7d32';
            }
            return true;
        }

        if (Notification.permission === 'denied') {
            const statusEl = document.getElementById('pushStatus');
            if (statusEl) {
                statusEl.textContent = '🔕 Уведомления заблокированы';
                statusEl.style.color = '#c62828';
            }
            return false;
        }

        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            notificationEnabled = true;
            const statusEl = document.getElementById('pushStatus');
            if (statusEl) {
                statusEl.textContent = '🔔 Уведомления включены';
                statusEl.style.color = '#2e7d32';
            }
            return true;
        } else {
            const statusEl = document.getElementById('pushStatus');
            if (statusEl) {
                statusEl.textContent = '🔕 Уведомления не включены';
                statusEl.style.color = '#8a7b64';
            }
            return false;
        }
    } catch(e) {
        console.warn('⚠️ Ошибка запроса уведомлений:', e);
        return false;
    }
}

// ========== ОТПРАВКА УВЕДОМЛЕНИЯ ==========
function sendNotification(title, body) {
    console.log(`🔔 Уведомление: ${title} - ${body}`);
    
    try {
        audio.currentTime = 0;
        audio.play().catch(e => console.warn('⚠️ Звук не воспроизведён:', e));
    } catch(e) {}

    if (Notification.permission === 'granted') {
        try {
            const notification = new Notification(title, {
                body: body,
                icon: '/favicon-32x32.png',
                badge: '/favicon-32x32.png',
                tag: 'new-order-' + Date.now(),
                vibrate: [200, 100, 200],
                requireInteraction: true,
                data: { url: '/maker' }
            });

            notification.onclick = function() {
                window.focus();
                window.location.href = '/maker';
                notification.close();
            };

            setTimeout(() => notification.close(), 15000);
        } catch(e) {
            console.warn('⚠️ Не удалось показать уведомление:', e);
        }
    }

    try {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                title: title,
                body: body,
                icon: '/favicon-32x32.png',
                url: '/maker'
            });
        }
    } catch(e) {}
}

// ========== ПРОВЕРКА НОВЫХ ЗАКАЗОВ ==========
function checkNewOrders(orders) {
    // orders уже отфильтрованы сервером — только активные
    const currentCount = orders.length;
    
    console.log(`🔔 checkNewOrders: было ${lastOrderCount}, стало ${currentCount}, firstLoad=${firstLoad}`);
    
    if (firstLoad) {
        firstLoad = false;
        const savedCount = loadLastOrderCount();
        if (savedCount > 0) {
            lastOrderCount = savedCount;
            console.log(`📊 Восстановлено из localStorage: ${lastOrderCount} заданий`);
        } else {
            lastOrderCount = currentCount;
            console.log(`📊 Первая загрузка: запомнено ${lastOrderCount} заданий`);
        }
        saveLastOrderCount(lastOrderCount);
        return;
    }
    
    if (currentCount > lastOrderCount) {
        const newOrder = orders[0]; // Сервер уже отсортировал по created_at DESC
        
        if (newOrder) {
            const taskType = newOrder.status === 'preorder' ? '📦 Предзаказ' : '📦 Отгрузка';
            const clientName = newOrder.client_name || 'Новый клиент';
            
            console.log(`🔔 НОВОЕ ЗАДАНИЕ! #${newOrder.order_number}`);
            sendNotification(
                `🛠️ Новое задание #${newOrder.order_number}`,
                `${taskType} для ${clientName}`
            );
        } else {
            sendNotification(
                '🛠️ Новое задание!',
                `Поступило новое задание в мейкере (всего активных: ${currentCount})`
            );
        }
    }
    
    lastOrderCount = currentCount;
    saveLastOrderCount(lastOrderCount);
}

// ========== КАНАЛ ДЛЯ МГНОВЕННЫХ УВЕДОМЛЕНИЙ ==========
const channel = new BroadcastChannel('maker_channel');

channel.onmessage = (event) => {
    console.log('📢 Событие получено:', event.data);

    if (event.data && event.data.type === 'new_order') {
        console.log('🛠️ Новое задание! Обновляем список...');
        
        if (event.data.order_number) {
            const taskType = event.data.status === 'preorder' ? '📦 Предзаказ' : '📦 Отгрузка';
            sendNotification(
                `🛠️ Новое задание #${event.data.order_number}`,
                `${taskType} для ${event.data.client_name || 'Нового клиента'}`
            );
        } else {
            sendNotification('🛠️ Новое задание!', 'Поступило новое задание в мейкере');
        }
        
        loadTasks();
    }
};

// ========== ФОРМАТИРОВАНИЕ ДАТЫ ==========
function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
        const parts = dateStr.split(/[- :]/);
        if (parts.length >= 6) {
            const year = parts[0];
            const month = parts[1];
            const day = parts[2];
            const hours = parts[3];
            const minutes = parts[4];
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        }
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        }
        return dateStr;
    } catch(e) {
        return dateStr;
    }
}

// ========== ПРОВЕРКА: СЕГОДНЯ ЛИ ДАТА ==========
function isToday(dateStr) {
    if (!dateStr) return false;
    try {
        const parts = dateStr.split(/[- :]/);
        if (parts.length >= 6) {
            const today = new Date();
            const day = parseInt(parts[2]);
            const month = parseInt(parts[1]) - 1;
            const year = parseInt(parts[0]);
            return day === today.getDate() && 
                   month === today.getMonth() && 
                   year === today.getFullYear();
        }
        return false;
    } catch(e) {
        return false;
    }
}

// ========== ЗАГРУЗКА ЗАДАНИЙ (ТОЛЬКО АКТИВНЫЕ) ==========
async function loadTasks() {
    if (isLoading) return;
    
    isLoading = true;
    const container = document.getElementById('tasksContainer');
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Загрузка заданий...</p></div>`;

    try {
        // ⭐ ЗАГРУЖАЕМ ТОЛЬКО АКТИВНЫЕ ЗАДАНИЯ (фильтр на сервере)
        const response = await window.secureFetch(`${API_BASE}/orders.php?action=all&filter=active`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();

        if (result.success && result.orders) {
            // Проверяем новые заказы (до отрисовки)
            checkNewOrders(result.orders);
            
            // Сервер уже отдал только активные, фильтровать не нужно
            tasks = result.orders;
            
            console.log(`📊 Загружено ${tasks.length} активных заданий`);
            
            renderTasks();
            await updateEarnings(); // отдельно загружает выполненные для заработка
        } else {
            container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>Нет активных заданий</p></div>`;
        }
    } catch(e) {
        console.error('❌ Ошибка загрузки заданий:', e);
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Ошибка загрузки</p></div>`;
    } finally {
        isLoading = false;
    }
}

// ========== ОБНОВЛЕНИЕ ЗАРАБОТКА (ОТДЕЛЬНЫЙ ЗАПРОС) ==========
async function updateEarnings() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
        // ⭐ ЗАГРУЖАЕМ ВСЕ ВЫПОЛНЕННЫЕ ДЛЯ ПОДСЧЁТА ЗАРАБОТКА
        const response = await window.secureFetch(`${API_BASE}/orders.php?action=all`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        
        if (!result.success) return;
        
        const completedOrders = result.orders.filter(o => o.maker_completed == 1);
        
        const daysMap = new Map();
        let totalServicesSum = 0;
        let todayServicesSum = 0;
        let uniqueDays = new Set();

        for (const order of completedOrders) {
            const orderDate = new Date(order.created_at);
            orderDate.setHours(0, 0, 0, 0);
            const dateKey = orderDate.toDateString();
            const servicesSum = parseInt(order.services_sum) || 0;
            
            uniqueDays.add(dateKey);
            
            if (!daysMap.has(dateKey)) {
                daysMap.set(dateKey, 0);
            }
            daysMap.set(dateKey, daysMap.get(dateKey) + servicesSum);
            
            totalServicesSum += servicesSum;
            
            if (orderDate.getTime() === today.getTime()) {
                todayServicesSum += servicesSum;
            }
        }

        const daysWorked = uniqueDays.size;

        const todayTotal = 1000 + todayServicesSum;
        const totalTotal = (1000 * daysWorked) + totalServicesSum;

        document.getElementById('todayEarnings').textContent = todayTotal + ' ₽';
        document.getElementById('totalEarnings').textContent = totalTotal + ' ₽';
        
        console.log(`💰 Заработок: сегодня ${todayTotal} ₽, всего ${totalTotal} ₽ (${daysWorked} дней)`);
        
    } catch(e) {
        console.error('❌ Ошибка подсчёта заработка:', e);
    }
}

// ========== ПАРСИНГ УСЛУГ ИЗ ITEMS ==========
function parseServicesFromItems(itemsString) {
    if (!itemsString) return [];
    const services = [];
    const parts = itemsString.split(',').map(s => s.trim());
    for (const part of parts) {
        if (part.includes('Услуга:')) {
            const nameMatch = part.match(/Услуга:\s*(.+?)\s*[-–]/);
            const priceMatch = part.match(/[-–]\s*(\d+)\s*₽/);
            if (nameMatch && priceMatch) {
                services.push({
                    name: nameMatch[1].trim(),
                    price: parseInt(priceMatch[1])
                });
            }
        }
    }
    return services;
}

// ========== ОТРИСОВКА ==========
function renderTasks() {
    const container = document.getElementById('tasksContainer');
    if (!tasks || tasks.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>Нет активных заданий</p></div>`;
        return;
    }

    let html = '';
    tasks.forEach(task => {
        const isCompleted = task.maker_completed == 1;
        const cardColor = isCompleted 
            ? 'border-color: #66bb6a; background: #f0f8f0;' 
            : 'border-color: #ef5350; background: #fff8f0;';
        const statusText = isCompleted 
            ? '✅ Выполнено' 
            : (task.status === 'preorder' ? '📦 Предзаказ' : '⏳ Ожидает');

        const createdDate = formatDateTime(task.created_at);
        const isTodayDate = isToday(task.created_at);

        let itemsHtml = '';
        if (task.items) {
            const items = task.items.split(',').map(item => item.trim());
            items.forEach((item, idx) => {
                if (item.includes('Услуга:')) return;
                const match = item.match(/^(.+?)\s*[-–]\s*(\d+)\s*шт/);
                if (match) {
                    const name = match[1].trim();
                    const qty = match[2];
                    itemsHtml += `<div class="task-item">${idx + 1}. ${name} – ${qty} шт</div>`;
                }
            });
        }

        const services = parseServicesFromItems(task.items);
        let hasLoading = false;
        let loadingCost = 0;
        let extraServicesHtml = '';

        services.forEach(s => {
            if (s.name.toLowerCase().includes('погрузка')) {
                hasLoading = true;
                loadingCost = s.price;
            } else {
                extraServicesHtml += `
                    <div class="service-tag" style="display:inline-block; background:#e3f2fd; border:1px solid #90caf9; padding:4px 14px; border-radius:20px; font-size:0.8rem; color:#0d47a1; font-weight:600; margin:2px;">
                        🛠️ ${s.name} – ${s.price} ₽
                    </div>
                `;
            }
        });

        if (!hasLoading && task.loading_cost && task.loading_cost > 0) {
            hasLoading = true;
            loadingCost = task.loading_cost;
        }

        const loadingText = hasLoading 
            ? `✅ Включена (${loadingCost} ₽)` 
            : '🚫 Грузит клиент';

        const servicesSum = parseInt(task.services_sum) || 0;
        const taskType = task.status === 'preorder' ? '📦 Предзаказ' : '📦 Отгрузка';

        let dateBadge = '';
        if (task.status === 'preorder') {
            dateBadge = '<span style="background:#fff3e0; color:#e65100; font-size:0.65rem; font-weight:700; padding:2px 10px; border-radius:12px;">Предзаказ</span>';
        } else if (isTodayDate) {
            dateBadge = '<span style="background:#e8f5e9; color:#2e7d32; font-size:0.65rem; font-weight:700; padding:2px 10px; border-radius:12px;">Сегодня</span>';
        } else {
            dateBadge = '<span style="background:#ffebee; color:#c62828; font-size:0.65rem; font-weight:700; padding:2px 10px; border-radius:12px;">Просрочено</span>';
        }

        html += `
            <div class="task-card" data-id="${task.id}" style="${cardColor}">
                <div class="task-header">
                    <span class="task-number">${taskType} #${task.order_number}</span>
                    <span class="task-status">${statusText}</span>
                </div>
                <div class="task-body">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #e8e0d0; margin-bottom:8px; flex-wrap:wrap; gap:4px;">
                        <span style="font-size:0.8rem; color:#4a3b28; font-weight:600;">
                            ${isTodayDate ? '🟢' : '📅'} ${createdDate}
                        </span>
                        ${dateBadge}
                    </div>
                    
                    <div class="task-info">
                        <div><strong>👤 Клиент:</strong> ${task.client_name || '—'}</div>
                        <div><strong>📍 Адрес:</strong> ${task.address || '—'}</div>
                        <div><strong>📞 Телефон:</strong> ${task.phone || '—'}</div>
                    </div>
                    
                    <div class="task-items">
                        <strong>📦 Позиции к погрузке:</strong>
                        ${itemsHtml || '<div class="no-items">Нет товаров</div>'}
                    </div>
                    
                    <div class="task-services">
                        <div class="service-row">
                            <span>🔄 Погрузка:</span>
                            <span class="service-status">${loadingText}</span>
                        </div>
                        
                        ${extraServicesHtml ? `
                            <div class="service-row" style="margin-top:6px; padding-top:6px; border-top:1px dashed #d4c9b2;">
                                <span style="font-weight:600; color:#0d47a1;">🛠️ Доп. услуги:</span>
                                <div class="service-tags" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                                    ${extraServicesHtml}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${servicesSum > 0 ? `
                            <div class="service-row" style="margin-top:6px; padding-top:6px; border-top:2px solid #d4c9b2;">
                                <span style="font-weight:700;">💰 Итого услуги:</span>
                                <span style="font-weight:700; color:#1f5e1f;">${servicesSum} ₽</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="task-footer">
                    ${isCompleted ? '' : `<button class="btn-complete" onclick="completeTask(${task.id})">✅ Завершить задание</button>`}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ========== ЗАВЕРШИТЬ ЗАДАНИЕ ==========
async function completeTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task && task.maker_completed == 1) {
        alert('⚠️ Это задание уже выполнено!');
        return;
    }

    if (!confirm('Завершить задание?')) return;

    try {
        const response = await window.secureFetch(`${API_BASE}/order.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: 'complete',
                id: id
            })
        });
        const result = await response.json();
        if (result.success) {
            alert('✅ Задание завершено!');
            loadTasks();
        } else {
            alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch(e) {
        console.error('❌ Ошибка завершения:', e);
        alert('❌ Ошибка сервера');
    }
}

// ========== АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ ==========
function startAutoRefresh() {
    setInterval(() => {
        loadTasks();
    }, 30000);
}

// ========== ВЫХОД ==========
async function logout() {
    try { await window.secureFetch(`${API_BASE}/logout.php`, { method: 'POST', credentials: 'same-origin' }); } catch(e) {}
    localStorage.removeItem('redirect_after_login');
    window.location.href = '/login';
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function init() {
    await requestNotificationPermission();
    await loadTasks();
    startAutoRefresh();
}

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==========
window.completeTask = completeTask;
window.logout = logout;

init();