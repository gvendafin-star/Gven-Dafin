// ============================================================
// НОМЕНКЛАТУРА СТРОЙМАТЕРИАЛОВ (building-products.js)
// ============================================================

let products = [];
let editingId = null;

// ========== ПОЛУЧЕНИЕ CSRF-ТОКЕНА ==========
async function getCSRFToken() {
    try {
        const response = await fetch('/api/security.php?action=token', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        if (result.success && result.csrf_token) {
            localStorage.setItem('csrf_token', result.csrf_token);
            return result.csrf_token;
        }
        return null;
    } catch(e) {
        console.warn('⚠️ Ошибка получения CSRF-токена:', e);
        return null;
    }
}

// ========== БЕЗОПАСНЫЙ FETCH ==========
async function secureFetch(url, options = {}) {
    let token = localStorage.getItem('csrf_token');
    if (!token) {
        token = await getCSRFToken();
    }
    
    const method = options.method || 'GET';
    if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
        options.headers = options.headers || {};
        options.headers['X-CSRF-Token'] = token || '';
        if (options.body && typeof options.body === 'string') {
            try {
                const body = JSON.parse(options.body);
                if (!body.csrf_token && token) {
                    body.csrf_token = token;
                    options.body = JSON.stringify(body);
                }
            } catch(e) {}
        }
    }
    return fetch(url, options);
}

// ========== ЗАГРУЗКА ТОВАРОВ ==========
async function loadProducts() {
    const container = document.getElementById('productsContainer');
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>`;
    
    try {
        const response = await secureFetch('/api/building/products.php?action=list', {
            method: 'GET',
            credentials: 'same-origin'
        });
        if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
        
        const result = await response.json();
        if (result.success && result.products) {
            products = result.products;
            renderProducts(products);
        } else {
            container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>Нет товаров</p></div>`;
        }
    } catch(e) {
        console.error('❌ Ошибка загрузки:', e);
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Ошибка загрузки: ${e.message}</p></div>`;
    }
}

// ========== ОТРИСОВКА ТАБЛИЦЫ ==========
function renderProducts(products) {
    const container = document.getElementById('productsContainer');
    if (!products || products.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>Нет товаров</p></div>`;
        return;
    }
    
    let html = `
        <table class="products-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Название</th>
                    <th>Ед.</th>
                    <th>Цена</th>
                    <th>Вес (кг)</th>
                    <th>Остаток</th>
                    <th>Статус</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    products.forEach(p => {
        const isActive = p.is_active == 1;
        const weight = parseFloat(p.weight_kg) || 0;
        html += `
            <tr>
                <td>${p.id}</td>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td>${p.unit || 'шт'}</td>
                <td>${Number(p.price).toLocaleString('ru-RU')} ₽</td>
                <td>${weight > 0 ? weight.toFixed(1) : '—'}</td>
                <td>${p.stock || 0}</td>
                <td><span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? '✅ Активен' : '🚫 Скрыт'}</span></td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="window.editProduct(${p.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="window.deleteProduct(${p.id}, '${escapeHtml(p.name)}')">🗑️</button>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ========== ESCAPE HTML ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== ПОКАЗАТЬ ФОРМУ ==========
function showForm(product = null) {
    const form = document.getElementById('productForm');
    const title = document.getElementById('formTitle');
    const editId = document.getElementById('editId');
    const name = document.getElementById('productName');
    const unit = document.getElementById('productUnit');
    const price = document.getElementById('productPrice');
    const weight = document.getElementById('productWeight');
    const stock = document.getElementById('productStock');
    const active = document.getElementById('productActive');
    const saveBtn = document.getElementById('saveBtn');
    const showBtn = document.getElementById('showFormBtn');
    
    form.classList.add('visible');
    showBtn.style.display = 'none';
    
    if (product) {
        title.textContent = '✏️ Редактировать товар';
        editId.value = product.id;
        name.value = product.name;
        unit.value = product.unit || 'шт';
        price.value = product.price || 0;
        weight.value = product.weight_kg || 0;
        stock.value = product.stock || 0;
        active.checked = product.is_active == 1;
        saveBtn.textContent = '💾 Обновить';
        saveBtn.dataset.action = 'update';
    } else {
        title.textContent = '➕ Добавить товар';
        editId.value = '';
        name.value = '';
        unit.value = 'шт';
        price.value = '';
        weight.value = '';
        stock.value = '';
        active.checked = true;
        saveBtn.textContent = '💾 Сохранить';
        saveBtn.dataset.action = 'create';
    }
    
    setTimeout(() => name.focus(), 100);
}

function hideForm() {
    document.getElementById('productForm').classList.remove('visible');
    document.getElementById('showFormBtn').style.display = 'inline-block';
    document.getElementById('editId').value = '';
}

// ========== СОХРАНИТЬ ТОВАР ==========
async function saveProduct() {
    const editId = document.getElementById('editId').value;
    const name = document.getElementById('productName').value.trim();
    const unit = document.getElementById('productUnit').value;
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    const weight = parseFloat(document.getElementById('productWeight').value) || 0;
    const stock = parseInt(document.getElementById('productStock').value) || 0;
    const is_active = document.getElementById('productActive').checked ? 1 : 0;
    const isEdit = editId !== '';
    
    if (!name) {
        showToast('⚠️ Введите название товара!', 'error');
        document.getElementById('productName').focus();
        return;
    }
    
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Сохранение...';
    
    try {
        const data = {
            action: isEdit ? 'update' : 'create',
            name: name,
            group: 'стройматериалы',
            unit: unit,
            price: price,
            weight_kg: weight,
            is_active: is_active
        };
        
        if (isEdit) {
            data.id = parseInt(editId);
            data.stock = stock;
        }
        
        const token = localStorage.getItem('csrf_token');
        if (token) data.csrf_token = token;
        
        const response = await secureFetch('/api/building/products.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
        
        const result = await response.json();
        if (result.success) {
            showToast(`✅ ${result.message}`);
            hideForm();
            await loadProducts();
        } else {
            showToast(`❌ ${result.error}`, 'error');
        }
    } catch(e) {
        console.error('❌ Ошибка сохранения:', e);
        showToast('❌ Ошибка сервера: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = isEdit ? '💾 Обновить' : '💾 Сохранить';
    }
}

// ========== РЕДАКТИРОВАТЬ ==========
async function editProduct(id) {
    try {
        const response = await secureFetch(`/api/building/products.php?action=get&id=${id}`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
        
        const result = await response.json();
        if (result.success && result.product) {
            showForm(result.product);
        } else {
            showToast('❌ Не удалось загрузить товар', 'error');
        }
    } catch(e) {
        console.error('❌ Ошибка:', e);
        showToast('❌ Ошибка загрузки: ' + e.message, 'error');
    }
}

// ========== УДАЛИТЬ ==========
async function deleteProduct(id, name) {
    if (!confirm(`Удалить товар "${name}"?`)) return;
    
    try {
        const token = localStorage.getItem('csrf_token');
        const response = await secureFetch('/api/building/products.php', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ id: id, csrf_token: token })
        });
        
        if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
        
        const result = await response.json();
        if (result.success) {
            showToast(`✅ ${result.message}`);
            await loadProducts();
        } else {
            showToast(`❌ ${result.error}`, 'error');
        }
    } catch(e) {
        console.error('❌ Ошибка удаления:', e);
        showToast('❌ Ошибка сервера: ' + e.message, 'error');
    }
}

// ========== TOAST ==========
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast' + (type === 'error' ? ' error' : '');
    toast.style.display = 'block';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// ========== ВЫХОД ==========
async function logout() {
    try {
        const token = localStorage.getItem('csrf_token');
        await fetch('/api/logout.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': token || '' }
        });
    } catch(e) {}
    localStorage.removeItem('redirect_after_login');
    window.location.href = '/login';
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', function() {
    getCSRFToken();
    
    document.getElementById('showFormBtn').addEventListener('click', () => showForm(null));
    document.getElementById('cancelBtn').addEventListener('click', hideForm);
    document.getElementById('saveBtn').addEventListener('click', saveProduct);
    
    document.getElementById('productName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') document.getElementById('productUnit').focus();
    });
    document.getElementById('productUnit').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') document.getElementById('productPrice').focus();
    });
    document.getElementById('productPrice').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') document.getElementById('productWeight').focus();
    });
    document.getElementById('productWeight').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') document.getElementById('productStock').focus();
    });
    document.getElementById('productStock').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') saveProduct();
    });
    
    loadProducts();
});

window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.logout = logout;
window.showToast = showToast;