// ========== КОНСТАНТЫ ==========
const API_BASE = '/api';
const INCOME_API = `${API_BASE}/income.php`;
const DEFAULT_CUBE_PRICE = 16500;

// ========== ИМПОРТ ДАННЫХ ТОВАРОВ ==========
import { productsDataRaw, getProductById, calculateVolume } from '../modules/products-data.js';

// ========== СОСТОЯНИЕ ==========
let state = {
    items: [],          // [{product_id, product_name, quantity, volume}]
    editId: null,       // ID прихода при редактировании
    isEditing: false,
    suppliers: []
};

// ========== ЭЛЕМЕНТЫ ==========
const supplierInput = document.getElementById('supplierInput');
const supplierList = document.getElementById('supplierList');
const incomeDateInput = document.getElementById('incomeDateInput');
const noteInput = document.getElementById('noteInput');
const productSelect = document.getElementById('productSelect');
const quantityInput = document.getElementById('quantityInput');
const addItemBtn = document.getElementById('addItemBtn');
const itemsBody = document.getElementById('itemsBody');
const totalItemsCount = document.getElementById('totalItemsCount');
const totalQuantityCount = document.getElementById('totalQuantityCount');
const totalVolumeDisplay = document.getElementById('totalVolumeDisplay');
const itemVolumePreview = document.getElementById('itemVolumePreview');
const saveIncomeBtn = document.getElementById('saveIncomeBtn');
const newIncomeBtn = document.getElementById('newIncomeBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');
const formStatus = document.getElementById('formStatus');
const editIncomeId = document.getElementById('editIncomeId');
const historyContainer = document.getElementById('incomeHistoryContainer');

// ========== ЗАГРУЗКА ТОВАРОВ В SELECT ==========
function loadProductsSelect() {
    productSelect.innerHTML = '<option value="">Выберите товар...</option>';
    
    const groups = {};
    productsDataRaw.forEach(p => {
        if (!groups[p.group]) groups[p.group] = [];
        groups[p.group].push(p);
    });
    
    Object.keys(groups).forEach(group => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = group.charAt(0).toUpperCase() + group.slice(1);
        groups[group].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${p.volume.toFixed(3)} м³)`;
            optgroup.appendChild(opt);
        });
        productSelect.appendChild(optgroup);
    });
}

// ========== ОБНОВЛЕНИЕ ПРЕДПРОСМОТРА ОБЪЁМА ==========
function updateVolumePreview() {
    const productId = parseInt(productSelect.value);
    const qty = parseInt(quantityInput.value) || 0;
    
    if (productId && qty > 0) {
        const volume = calculateVolume(productId, qty);
        if (volume > 0) {
            itemVolumePreview.textContent = `Объём: ${volume.toFixed(3)} м³`;
            return;
        }
    }
    itemVolumePreview.textContent = 'Объём: 0.000 м³';
}

// ========== ДОБАВЛЕНИЕ ПОЗИЦИИ ==========
function addItem() {
    const productId = parseInt(productSelect.value);
    const qty = parseInt(quantityInput.value) || 0;
    
    if (!productId) {
        showToast('⚠️ Выберите товар!', 'error');
        productSelect.focus();
        return;
    }
    
    if (qty <= 0) {
        showToast('⚠️ Укажите корректное количество!', 'error');
        quantityInput.focus();
        return;
    }
    
    const product = getProductById(productId);
    if (!product) {
        showToast('❌ Товар не найден!', 'error');
        return;
    }
    
    const volume = calculateVolume(productId, qty);
    
    // Проверяем, не добавлен ли уже этот товар
    const existing = state.items.find(item => item.product_id === productId);
    if (existing) {
        if (!confirm(`Товар "${product.name}" уже добавлен (${existing.quantity} шт). Добавить ещё?`)) {
            return;
        }
        existing.quantity += qty;
        existing.volume = existing.quantity * product.volume;
    } else {
        state.items.push({
            product_id: productId,
            product_name: product.name,
            quantity: qty,
            volume: volume
        });
    }
    
    // Очищаем поле количества
    quantityInput.value = '';
    productSelect.value = '';
    updateVolumePreview();
    renderItems();
    showToast(`✅ Добавлено: ${product.name} x ${qty} шт (${volume.toFixed(3)} м³)`);
    
    // Фокусируемся на поле выбора товара для быстрого добавления следующей позиции
    productSelect.focus();
}

// ========== УДАЛЕНИЕ ПОЗИЦИИ ==========
function removeItem(index) {
    if (!confirm(`Удалить позицию "${state.items[index].product_name}"?`)) return;
    state.items.splice(index, 1);
    renderItems();
    showToast('🗑️ Позиция удалена');
}

// ========== ОТРИСОВКА ПОЗИЦИЙ ==========
function renderItems() {
    if (state.items.length === 0) {
        itemsBody.innerHTML = `<tr><td colspan="5" class="income-items-empty">📭 Нет добавленных позиций</td></tr>`;
        updateTotals();
        return;
    }
    
    let html = '';
    state.items.forEach((item, index) => {
        html += `
            <tr>
                <td class="item-num">${index + 1}</td>
                <td class="item-name">${item.product_name}</td>
                <td class="item-qty">${item.quantity}</td>
                <td class="item-volume">${item.volume.toFixed(3)}</td>
                <td class="item-actions">
                    <button class="btn-remove-item" onclick="window.removeItem(${index})" title="Удалить">✕</button>
                </td>
            </tr>
        `;
    });
    itemsBody.innerHTML = html;
    updateTotals();
}

// ========== ОБНОВЛЕНИЕ ИТОГОВ ==========
function updateTotals() {
    const totalItems = state.items.length;
    const totalQuantity = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalVolume = state.items.reduce((sum, item) => sum + item.volume, 0);
    
    totalItemsCount.textContent = totalItems;
    totalQuantityCount.textContent = totalQuantity;
    totalVolumeDisplay.textContent = totalVolume.toFixed(3) + ' м³';
}

// ========== ОЧИСТКА ФОРМЫ ==========
function clearForm() {
    state.items = [];
    state.editId = null;
    state.isEditing = false;
    editIncomeId.value = '';
    
    supplierInput.value = '';
    incomeDateInput.value = new Date().toISOString().split('T')[0];
    noteInput.value = '';
    productSelect.value = '';
    quantityInput.value = '';
    
    formTitle.textContent = '📝 Новый приход';
    formStatus.textContent = 'Не сохранён';
    cancelEditBtn.style.display = 'none';
    saveIncomeBtn.textContent = '💾 Сохранить приход';
    
    renderItems();
    updateVolumePreview();
}

// ========== ЗАГРУЗКА ПРИХОДА ДЛЯ РЕДАКТИРОВАНИЯ ==========
async function loadIncomeForEdit(id) {
    try {
        const response = await window.secureFetch(`${INCOME_API}?action=get&id=${id}`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        
        if (result.success && result.income) {
            const income = result.income;
            
            state.editId = id;
            state.isEditing = true;
            editIncomeId.value = id;
            
            supplierInput.value = income.supplier;
            incomeDateInput.value = income.income_date;
            noteInput.value = income.note || '';
            
            state.items = income.items.map(item => ({
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                volume: parseFloat(item.volume) || 0
            }));
            
            formTitle.textContent = `✏️ Редактирование: ${income.supplier}`;
            formStatus.textContent = `📅 ${income.income_date} | Редактирование`;
            cancelEditBtn.style.display = 'inline-block';
            saveIncomeBtn.textContent = '💾 Обновить приход';
            
            renderItems();
            showToast('📝 Приход загружен для редактирования');
        }
    } catch(e) {
        console.error('❌ Ошибка загрузки прихода:', e);
        showToast('❌ Ошибка загрузки прихода для редактирования', 'error');
    }
}

// ========== ПРОСМОТР ПРИХОДА ==========
async function viewIncome(id) {
    try {
        const response = await window.secureFetch(`${INCOME_API}?action=get&id=${id}`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        
        if (result.success && result.income) {
            const income = result.income;
            const items = income.items || [];
            
            let itemsHtml = '';
            if (items.length === 0) {
                itemsHtml = '<p style="color:#a6977c;">Нет позиций</p>';
            } else {
                itemsHtml = `
                    <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:0.85rem;">
                        <thead>
                            <tr>
                                <th style="text-align:left; padding:4px 6px; border-bottom:1px solid #d9ceb5;">№</th>
                                <th style="text-align:left; padding:4px 6px; border-bottom:1px solid #d9ceb5;">Наименование</th>
                                <th style="text-align:center; padding:4px 6px; border-bottom:1px solid #d9ceb5;">Кол-во</th>
                                <th style="text-align:center; padding:4px 6px; border-bottom:1px solid #d9ceb5;">Объём (м³)</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                items.forEach((item, idx) => {
                    itemsHtml += `
                        <tr>
                            <td style="padding:4px 6px; border-bottom:1px solid #ede3d2;">${idx + 1}</td>
                            <td style="padding:4px 6px; border-bottom:1px solid #ede3d2;">${item.product_name}</td>
                            <td style="text-align:center; padding:4px 6px; border-bottom:1px solid #ede3d2;">${item.quantity}</td>
                            <td style="text-align:center; padding:4px 6px; border-bottom:1px solid #ede3d2;">${parseFloat(item.volume).toFixed(3)}</td>
                        </tr>
                    `;
                });
                itemsHtml += `
                        </tbody>
                    </table>
                `;
            }
            
            const totalVolume = parseFloat(income.total_volume) || 0;
            const totalQuantity = parseInt(income.total_quantity) || 0;
            const totalItems = parseInt(income.total_items) || 0;
            const date = new Date(income.income_date).toLocaleDateString('ru-RU');
            
            const modalHtml = `
                <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; display:flex; justify-content:center; align-items:center; animation:fadeIn 0.2s;">
                    <div style="background:white; border-radius:16px; padding:24px; max-width:600px; width:90%; max-height:80vh; overflow-y:auto; position:relative;">
                        <button onclick="this.closest('div[style]').remove()" style="position:absolute; top:12px; right:20px; font-size:1.5rem; cursor:pointer; color:#999; background:none; border:none;">×</button>
                        <h3 style="margin-bottom:16px; color:#3c2a1f; border-bottom:2px solid #e2dccd; padding-bottom:8px;">📦 Приход: ${income.supplier}</h3>
                        <div style="margin-bottom:12px;">
                            <p><strong>📅 Дата:</strong> ${date}</p>
                            <p><strong>📊 Общий объём:</strong> <span style="color:#1f5e1f; font-weight:700;">${totalVolume.toFixed(3)} м³</span></p>
                            <p><strong>📦 Всего позиций:</strong> ${totalItems}</p>
                            <p><strong>🔢 Всего штук:</strong> ${totalQuantity}</p>
                            ${income.note ? `<p><strong>📝 Примечание:</strong> ${income.note}</p>` : ''}
                        </div>
                        <div style="border-top:1px solid #ede3d2; padding-top:12px;">
                            <strong>📋 Позиции:</strong>
                            ${itemsHtml}
                        </div>
                        <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
                            <button onclick="window.editIncome(${income.id})" style="background:#f57c00; color:white; border:none; padding:8px 20px; border-radius:30px; cursor:pointer; font-weight:600;">✏️ Редактировать</button>
                            <button onclick="window.deleteIncome(${income.id})" style="background:#c62828; color:white; border:none; padding:8px 20px; border-radius:30px; cursor:pointer; font-weight:600;">🗑️ Удалить</button>
                            <button onclick="this.closest('div[style]').remove()" style="background:#5a4a32; color:white; border:none; padding:8px 20px; border-radius:30px; cursor:pointer; font-weight:600;">❌ Закрыть</button>
                        </div>
                    </div>
                </div>
                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                </style>
            `;
            
            // Добавляем модальное окно в body
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalHtml;
            document.body.appendChild(tempDiv.firstElementChild);
        }
    } catch(e) {
        console.error('❌ Ошибка просмотра прихода:', e);
        showToast('❌ Ошибка загрузки прихода для просмотра', 'error');
    }
}

// ========== СОХРАНЕНИЕ ПРИХОДА ==========
async function saveIncome() {
    const supplier = supplierInput.value.trim();
    const incomeDate = incomeDateInput.value;
    const note = noteInput.value.trim();
    
    if (!supplier) {
        showToast('⚠️ Введите поставщика!', 'error');
        supplierInput.focus();
        return;
    }
    
    if (state.items.length === 0) {
        showToast('⚠️ Добавьте хотя бы одну позицию!', 'error');
        return;
    }
    
    const isEdit = state.isEditing && state.editId;
    const action = isEdit ? 'update' : 'create';
    
    const data = {
        action: action,
        supplier: supplier,
        income_date: incomeDate,
        note: note,
        items: state.items.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            volume: item.volume
        }))
    };
    
    if (isEdit) {
        data.id = state.editId;
    }
    
    const btn = saveIncomeBtn;
    btn.disabled = true;
    btn.textContent = '⏳ Сохранение...';
    
    try {
        const response = await window.secureFetch(INCOME_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`✅ ${result.message}`);
            clearForm();
            await loadIncomeHistory();
            await loadSuppliers();
        } else {
            showToast(`❌ ${result.error || 'Ошибка сохранения'}`, 'error');
        }
    } catch(e) {
        console.error('❌ Ошибка сохранения:', e);
        showToast('❌ Ошибка сервера', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = isEdit ? '💾 Обновить приход' : '💾 Сохранить приход';
    }
}

// ========== УДАЛЕНИЕ ПРИХОДА ==========
async function deleteIncome(id) {
    if (!confirm('Удалить этот приход? Остатки будут возвращены.')) return;
    
    try {
        const response = await window.secureFetch(INCOME_API, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ id: id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('✅ Приход удалён, остатки возвращены');
            // Закрываем модальное окно
            document.querySelectorAll('div[style*="position:fixed"]').forEach(el => el.remove());
            await loadIncomeHistory();
        } else {
            showToast(`❌ ${result.error || 'Ошибка удаления'}`, 'error');
        }
    } catch(e) {
        console.error('❌ Ошибка удаления:', e);
        showToast('❌ Ошибка сервера', 'error');
    }
}

// ========== ЗАГРУЗКА ИСТОРИИ ПРИХОДОВ (АДАПТИВНАЯ) ==========
async function loadIncomeHistory() {
    historyContainer.innerHTML = '<div class="empty">⏳ Загрузка...</div>';
    
    try {
        const response = await window.secureFetch(`${INCOME_API}?action=list`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        
        if (result.success && result.income) {
            if (result.income.length === 0) {
                historyContainer.innerHTML = '<div class="empty">📭 История приходов пуста</div>';
                return;
            }
            
            // Определяем мобильное устройство
            const isMobile = window.innerWidth <= 768;
            
            let html = '';
            
            if (isMobile) {
                // ===== МОБИЛЬНЫЙ ВАРИАНТ: КАРТОЧКИ =====
                html = `<div class="mobile-cards-container">`;
                
                result.income.forEach(item => {
                    const totalVolume = parseFloat(item.total_volume) || 0;
                    const totalQuantity = parseInt(item.total_quantity) || 0;
                    const totalItems = parseInt(item.total_items) || 0;
                    const date = new Date(item.income_date).toLocaleDateString('ru-RU');
                    
                    html += `
                        <div class="mobile-card">
                            <div class="row">
                                <span class="label">📅 Дата</span>
                                <span class="value">${date}</span>
                            </div>
                            <div class="row">
                                <span class="label">🏢 Поставщик</span>
                                <span class="value"><strong>${item.supplier}</strong></span>
                            </div>
                            <div class="row">
                                <span class="label">📦 Объём</span>
                                <span class="value volume">${totalVolume.toFixed(3)} м³</span>
                            </div>
                            <div class="row">
                                <span class="label">🔢 Штук</span>
                                <span class="value">${totalQuantity}</span>
                            </div>
                            <div class="row">
                                <span class="label">📋 Позиций</span>
                                <span class="value">${totalItems}</span>
                            </div>
                            ${item.note ? `
                            <div class="row">
                                <span class="label">📝 Примечание</span>
                                <span class="value" style="font-weight:400;font-size:0.7rem;">${item.note}</span>
                            </div>
                            ` : ''}
                            <div class="actions">
                                <button class="btn btn-view" onclick="window.viewIncome(${item.id})">👁️</button>
                                <button class="btn btn-edit" onclick="window.editIncome(${item.id})">✏️</button>
                                <button class="btn btn-delete" onclick="window.deleteIncome(${item.id})">🗑️</button>
                            </div>
                        </div>
                    `;
                });
                
                html += `</div>`;
            } else {
                // ===== ДЕСКТОПНЫЙ ВАРИАНТ: ТАБЛИЦА =====
                html = `
                    <table>
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Поставщик</th>
                                <th>Объём</th>
                                <th>Кол-во (шт)</th>
                                <th>Позиций</th>
                                <th>Примечание</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                result.income.forEach(item => {
                    const totalVolume = parseFloat(item.total_volume) || 0;
                    const totalQuantity = parseInt(item.total_quantity) || 0;
                    const totalItems = parseInt(item.total_items) || 0;
                    const date = new Date(item.income_date).toLocaleDateString('ru-RU');
                    
                    html += `
                        <tr>
                            <td>${date}</td>
                            <td><strong>${item.supplier}</strong></td>
                            <td class="volume">${totalVolume.toFixed(3)} м³</td>
                            <td>${totalQuantity}</td>
                            <td>${totalItems}</td>
                            <td>${item.note || '—'}</td>
                            <td>
                                <button class="btn-edit-income" onclick="window.viewIncome(${item.id})" style="background:#1976d2; color:white; border:none; padding:4px 10px; border-radius:20px; cursor:pointer; font-weight:600; font-size:0.7rem;">👁️</button>
                                <button class="btn-edit-income" onclick="window.editIncome(${item.id})" style="background:#f57c00; color:white; border:none; padding:4px 10px; border-radius:20px; cursor:pointer; font-weight:600; font-size:0.7rem;">✏️</button>
                                <button class="btn-edit-income" onclick="window.deleteIncome(${item.id})" style="background:#c62828; color:white; border:none; padding:4px 10px; border-radius:20px; cursor:pointer; font-weight:600; font-size:0.7rem;">🗑️</button>
                            </td>
                        </tr>
                    `;
                });
                
                html += `
                        </tbody>
                    </table>
                `;
            }
            
            historyContainer.innerHTML = html;
            
        } else {
            historyContainer.innerHTML = '<div class="empty">❌ Ошибка загрузки истории</div>';
        }
    } catch(e) {
        console.error('Ошибка:', e);
        historyContainer.innerHTML = '<div class="empty">❌ Ошибка загрузки истории</div>';
    }
}

// ========== ЗАГРУЗКА ПОСТАВЩИКОВ ==========
async function loadSuppliers() {
    try {
        const response = await window.secureFetch(`${INCOME_API}?action=suppliers`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        
        if (result.success && result.suppliers) {
            state.suppliers = result.suppliers;
            supplierList.innerHTML = '';
            state.suppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                supplierList.appendChild(opt);
            });
        }
    } catch(e) {
        console.warn('Ошибка загрузки поставщиков:', e);
    }
}

// ========== РЕДАКТИРОВАНИЕ ПРИХОДА ==========
function editIncome(id) {
    // Закрываем модальное окно если открыто
    document.querySelectorAll('div[style*="position:fixed"]').forEach(el => el.remove());
    loadIncomeForEdit(id);
}

// ========== ОТМЕНА РЕДАКТИРОВАНИЯ ==========
function cancelEdit() {
    if (!confirm('Отменить редактирование? Все изменения будут потеряны.')) return;
    clearForm();
    showToast('✅ Редактирование отменено');
}

// ========== TOAST УВЕДОМЛЕНИЕ ==========
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast' + (type === 'error' ? ' error' : '');
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}

// ========== ВЫХОД ==========
async function logout() {
    try { await window.secureFetch(`${API_BASE}/logout.php`, { method: 'POST', credentials: 'same-origin' }); } catch(e) {}
    localStorage.removeItem('redirect_after_login');
    window.location.href = 'index.html';
}

// ========== ПРОВЕРКА АВТОРИЗАЦИИ ==========
async function checkAuth() {
    try {
        const response = await window.secureFetch(`${API_BASE}/check_auth.php`, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
        const result = await response.json();
        if (!result.authorized) {
            localStorage.setItem('redirect_after_login', window.location.pathname);
            window.location.href = 'index.html';
            return false;
        }
        return true;
    } catch(e) {
        localStorage.setItem('redirect_after_login', window.location.pathname);
        window.location.href = 'index.html';
        return false;
    }
}

// ========== ОБНОВЛЕНИЕ ПРИ ИЗМЕНЕНИИ РАЗМЕРА ЭКРАНА ==========
let resizeTimeout = null;
window.addEventListener('resize', function() {
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(function() {
        // Перезагружаем историю при изменении размера экрана
        loadIncomeHistory();
    }, 500);
});

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function init() {
    const auth = await checkAuth();
    if (!auth) return;
    
    // Устанавливаем дату по умолчанию
    if (incomeDateInput) {
        incomeDateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // ОЧИСТКА ПОЛЯ КОЛИЧЕСТВА ПРИ ФОКУСЕ
    if (quantityInput) {
        quantityInput.addEventListener('focus', function() {
            this.value = '';
        });
        quantityInput.addEventListener('blur', function() {
            if (this.value === '' || this.value === '0') {
                this.value = '';
                this.placeholder = 'Кол-во';
            }
        });
        if (quantityInput.value === '0' || quantityInput.value === '') {
            quantityInput.value = '';
        }
    }
    
    loadProductsSelect();
    await loadSuppliers();
    await loadIncomeHistory();
    
    // События
    productSelect.addEventListener('change', updateVolumePreview);
    quantityInput.addEventListener('input', updateVolumePreview);
    addItemBtn.addEventListener('click', addItem);
    saveIncomeBtn.addEventListener('click', saveIncome);
    newIncomeBtn.addEventListener('click', () => {
        if (state.items.length > 0 || state.isEditing) {
            if (!confirm('Начать новый приход? Текущие данные будут очищены.')) return;
        }
        clearForm();
        showToast('🔄 Новый приход');
    });
    cancelEditBtn.addEventListener('click', cancelEdit);
    
    // Enter для добавления позиции
    quantityInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        }
    });
    productSelect.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            quantityInput.focus();
        }
    });
    
    // Enter для сохранения прихода
    noteInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            saveIncome();
        }
    });
    
    renderItems();
    updateVolumePreview();
    console.log('✅ Приход инициализирован');
}

// ============================================================
// ⭐ ДЕЛАЕМ ФУНКЦИИ ГЛОБАЛЬНЫМИ ДЛЯ INLINE-ОБРАБОТЧИКОВ
// ============================================================
window.removeItem = removeItem;
window.editIncome = editIncome;
window.viewIncome = viewIncome;
window.deleteIncome = deleteIncome;
window.cancelEdit = cancelEdit;
window.logout = logout;

init();