// ========== ЕСЛИ secureFetch НЕ ЗАГРУЗИЛСЯ ИЗ COMMON.JS ==========
if (typeof window.secureFetch === 'undefined') {
    console.warn('⚠️ secureFetch не загружен, используем резервную версию');
    window.secureFetch = async function(url, options = {}) {
        const token = localStorage.getItem('csrf_token') || '';
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
    };
}

// ========== КОНСТАНТЫ ==========
const API_BASE = '/api';
const NOMINALS = [5000, 2000, 1000, 500, 200, 100, 50];
const CLEAR_PASSWORD = '1861';
let currentSession = null;

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function initCashier() {
    const grid = document.getElementById('cashGrid');
    grid.innerHTML = '';
    NOMINALS.forEach(nominal => {
        const div = document.createElement('div');
        div.className = 'cash-item';
        div.innerHTML = `
            <div class="nominal">${nominal} ₽</div>
            <input type="number" class="cash-input" data-nominal="${nominal}" 
                   name="cash_count_${nominal}" 
                   min="0" value="" placeholder="0" 
                   autocomplete="off">
            <div class="total" id="total_nominal_${nominal}">0 ₽</div>
        `;
        grid.appendChild(div);
    });

    const commentInput = document.getElementById('cashComment');
    const amountInput = document.getElementById('cashAmount');
    const actionBtn = document.getElementById('cashActionBtn');

    function checkCashReady() {
        const amount = parseInt(amountInput.value) || 0;
        const comment = commentInput.value.trim();
        actionBtn.disabled = !(amount > 0 && comment.length > 0);
    }

    commentInput.addEventListener('input', checkCashReady);
    amountInput.addEventListener('input', checkCashReady);
    document.getElementById('cashAction').addEventListener('change', checkCashReady);

    await loadSession();
}

// ========== ЗАГРУЗКА СЕССИИ ИЗ БД ==========
async function loadSession() {
    try {
        const response = await window.secureFetch(`${API_BASE}/cashier.php?action=session`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const result = await response.json();
        
        if (result.success && result.session) {
            currentSession = result.session;
            
            document.getElementById('startBalance').value = currentSession.start_balance || '';
            document.getElementById('startBalanceDisplay').textContent = 
                (currentSession.start_balance || 0).toLocaleString('ru-RU') + ' ₽';
            
            renderHistory(currentSession.payments || []);
            updateSummary();
            
            const historyBtn = document.querySelector('#historyList .btn-secondary');
            if (historyBtn) {
                historyBtn.style.display = 'inline-block';
            }
            const backBtnContainer = document.getElementById('backToCurrentBtnContainer');
            if (backBtnContainer) {
                backBtnContainer.style.display = 'none';
            }
        }
    } catch(e) {
        console.error('❌ Ошибка загрузки сессии:', e);
    }
}

// ========== ПРИНЯТЬ ОПЛАТУ ==========
async function acceptPayment() {
    const tn = document.getElementById('tnNumber').value.trim();
    const amount = parseInt(document.getElementById('tnAmount').value) || 0;
    const statusEl = document.getElementById('paymentStatus');

    if (!tn) {
        statusEl.textContent = '❌ Введите номер ТН!';
        statusEl.style.color = '#c62828';
        return;
    }
    if (amount <= 0) {
        statusEl.textContent = '❌ Введите корректную сумму!';
        statusEl.style.color = '#c62828';
        return;
    }

    try {
        const response = await window.secureFetch(`${API_BASE}/cashier.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: 'accept_payment',
                tn: tn,
                amount: amount
            })
        });
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('tnNumber').value = '';
            document.getElementById('tnAmount').value = '';
            statusEl.textContent = `✅ ${result.message}`;
            statusEl.style.color = '#2e7d32';
            await loadSession();
        } else {
            statusEl.textContent = `❌ ${result.error}`;
            statusEl.style.color = '#c62828';
        }
    } catch(e) {
        console.error('❌ Ошибка:', e);
        statusEl.textContent = '❌ Ошибка сервера';
        statusEl.style.color = '#c62828';
    }
}

// ========== ВЗЯТЬ ИЛИ ВНЕСТИ ==========
async function processCashOperation() {
    const action = document.getElementById('cashAction').value;
    const amount = parseInt(document.getElementById('cashAmount').value) || 0;
    const comment = document.getElementById('cashComment').value.trim();
    const statusEl = document.getElementById('cashActionStatus');

    if (amount <= 0) {
        statusEl.textContent = '❌ Введите корректную сумму!';
        statusEl.style.color = '#c62828';
        return;
    }
    if (!comment) {
        statusEl.textContent = '❌ Обязательно укажите комментарий!';
        statusEl.style.color = '#c62828';
        return;
    }

    if (action === 'withdraw') {
        const startBalance = parseInt(document.getElementById('startBalance').value) || 0;
        const actualCash = document.getElementById('actualCash').textContent.replace(/[^\d]/g, '');
        const currentCash = parseInt(actualCash) || startBalance;
        if (amount > currentCash) {
            if (!confirm(`⚠️ В кассе сейчас ${currentCash.toLocaleString('ru-RU')} ₽. Вы пытаетесь взять ${amount.toLocaleString('ru-RU')} ₽. Продолжить?`)) {
                return;
            }
        }
    }

    try {
        const response = await window.secureFetch(`${API_BASE}/cashier.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: action,
                amount: amount,
                comment: comment
            })
        });
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('cashAmount').value = '';
            document.getElementById('cashComment').value = '';
            document.getElementById('cashActionBtn').disabled = true;
            statusEl.textContent = `✅ ${result.message}`;
            statusEl.style.color = '#2e7d32';
            await loadSession();
        } else {
            statusEl.textContent = `❌ ${result.error}`;
            statusEl.style.color = '#c62828';
        }
    } catch(e) {
        console.error('❌ Ошибка:', e);
        statusEl.textContent = '❌ Ошибка сервера';
        statusEl.style.color = '#c62828';
    }
}

// ========== ОБНОВИТЬ ОСТАТОК ==========
async function updateBalance() {
    const balance = parseInt(document.getElementById('startBalance').value) || 0;
    
    try {
        const response = await window.secureFetch(`${API_BASE}/cashier.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: 'update_balance',
                start_balance: balance
            })
        });
        const result = await response.json();
        
        if (result.success) {
            await loadSession();
        } else {
            alert('❌ Ошибка: ' + result.error);
        }
    } catch(e) {
        console.error('❌ Ошибка:', e);
        alert('❌ Ошибка сервера');
    }
}

// ========== ПЕРЕСЧЁТ НАЛИЧНЫХ ==========
async function calculateCash() {
    let total = 0;
    document.querySelectorAll('.cash-input').forEach(input => {
        const nominal = parseInt(input.dataset.nominal);
        const count = parseInt(input.value) || 0;
        total += nominal * count;
        document.getElementById(`total_nominal_${nominal}`).textContent = (nominal * count).toLocaleString('ru-RU') + ' ₽';
    });
    
    try {
        const response = await window.secureFetch(`${API_BASE}/cashier.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: 'update_actual',
                actual_cash: total
            })
        });
        const result = await response.json();
        
        if (result.success) {
            await loadSession();
        } else {
            alert('❌ Ошибка: ' + result.error);
        }
    } catch(e) {
        console.error('❌ Ошибка:', e);
        alert('❌ Ошибка сервера');
    }
}

// ========== ОБНОВЛЕНИЕ СВОДКИ ==========
function updateSummary() {
    if (!currentSession) return;
    
    const start = currentSession.start_balance || 0;
    const expected = currentSession.expected_cash || 0;
    const actual = currentSession.actual_cash || 0;
    
    const totalExpected = start + expected;
    const diff = actual - totalExpected;
    
    const payments = currentSession.payments || [];
    const totalWithdraw = payments.filter(p => p.type === 'withdrawal').reduce((sum, p) => sum + p.amount, 0);
    
    document.getElementById('totalTnSum').textContent = 
        payments.filter(p => p.type === 'payment').reduce((sum, p) => sum + p.amount, 0).toLocaleString('ru-RU') + ' ₽';
    document.getElementById('totalWithdrawSum').textContent = 
        totalWithdraw.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('actualCash').textContent = actual.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('startBalanceDisplay').textContent = start.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('expectedCash').textContent = totalExpected.toLocaleString('ru-RU') + ' ₽';
    
    const diffEl = document.getElementById('difference');
    diffEl.textContent = diff.toLocaleString('ru-RU') + ' ₽';
    diffEl.className = 'value ' + (diff >= 0 ? 'green' : 'red');
}

// ========== ИСТОРИЯ (ТАБЛИЦА) ==========
function renderHistory(payments) {
    const container = document.getElementById('historyList');
    
    if (!payments || payments.length === 0) {
        container.innerHTML = `
            <div class="history-table-wrapper">
                <table class="history-table">
                    <tbody>
                        <tr class="empty-row">
                            <td colspan="4">📭 Пока нет операций</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        return;
    }

    let tbodyHtml = '';
    payments.forEach(p => {
        const isWithdrawal = p.type === 'withdrawal';
        const isDeposit = p.type === 'deposit';
        const sign = isWithdrawal ? '-' : (isDeposit ? '+' : '');
        const colorClass = isWithdrawal ? 'red' : (isDeposit ? 'green' : '');
        const tnDisplay = isWithdrawal ? '📤 Взято' : (isDeposit ? '📥 Внесено' : `📄 ${p.tn_number}`);
        
        let dateTime = '';
        if (p.created_at) {
            const date = new Date(p.created_at);
            dateTime = date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        tbodyHtml += `
            <tr>
                <td class="col-time">${dateTime}</td>
                <td class="col-tn">${tnDisplay}</td>
                <td class="col-amount ${colorClass}">${sign}${p.amount.toLocaleString('ru-RU')} ₽</td>
                <td class="col-comment" title="${p.comment || ''}">${p.comment || '—'}</td>
            </tr>
        `;
    });

    const tableHtml = `
        <div class="history-table-wrapper">
            <table class="history-table">
                <thead>
                    <tr>
                        <th>⏱ Время</th>
                        <th>📄 Операция</th>
                        <th style="text-align:right;">💰 Сумма</th>
                        <th>📝 Комментарий</th>
                    </tr>
                </thead>
                <tbody>
                    ${tbodyHtml}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHtml;
}

// ========== МОДАЛЬНОЕ ОКНО ==========
function openClearModal() {
    document.getElementById('clearModal').classList.add('active');
    document.getElementById('clearPassword').value = '';
    document.getElementById('clearStatus').textContent = '';
}

function closeClearModal() {
    document.getElementById('clearModal').classList.remove('active');
}

// ========== НОВАЯ СМЕНА (ИСТОРИЯ СОХРАНЯЕТСЯ) ==========
async function confirmNewShift() {
    const password = document.getElementById('clearPassword').value.trim();
    const statusEl = document.getElementById('clearStatus');

    if (password !== CLEAR_PASSWORD) {
        statusEl.textContent = '❌ Неверный пароль!';
        statusEl.style.color = '#c62828';
        return;
    }

    statusEl.textContent = '⏳ Открытие новой смены...';
    statusEl.style.color = '#6b5f4a';

    // ⭐ ПРИНУДИТЕЛЬНО ПОЛУЧАЕМ СВЕЖИЙ CSRF-ТОКЕН ПЕРЕД ДЕЙСТВИЕМ
    let csrfToken = localStorage.getItem('csrf_token');
    if (!csrfToken) {
        try {
            const tokenResponse = await fetch('/api/security.php?action=token', {
                method: 'GET',
                credentials: 'same-origin'
            });
            const tokenResult = await tokenResponse.json();
            if (tokenResult.success && tokenResult.csrf_token) {
                csrfToken = tokenResult.csrf_token;
                localStorage.setItem('csrf_token', csrfToken);
            }
        } catch(e) {
            console.error('❌ Ошибка получения CSRF-токена:', e);
        }
    }

    try {
        // 1. Закрываем текущую смену (история остаётся в БД)
        const closeResponse = await window.secureFetch(`${API_BASE}/cashier.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: 'close_session'
            })
        });
        await closeResponse.json();

        // ⭐ ПОСЛЕ ЗАКРЫТИЯ СЕССИИ ТОКЕН СТАНОВИТСЯ НЕДЕЙСТВИТЕЛЬНЫМ, ПОЛУЧАЕМ НОВЫЙ
        const newTokenResponse = await fetch('/api/security.php?action=token', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const newTokenResult = await newTokenResponse.json();
        if (newTokenResult.success && newTokenResult.csrf_token) {
            csrfToken = newTokenResult.csrf_token;
            localStorage.setItem('csrf_token', csrfToken);
        }

        // 2. Создаём новую смену с нулевым остатком
        const newResponse = await window.secureFetch(`${API_BASE}/cashier.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: 'update_balance',
                start_balance: 0
            })
        });
        const newResult = await newResponse.json();

        if (newResult.success) {
            // Очищаем только поля ввода, НЕ историю
            document.querySelectorAll('.cash-input').forEach(input => {
                input.value = '';
                const nominal = parseInt(input.dataset.nominal);
                document.getElementById(`total_nominal_${nominal}`).textContent = '0 ₽';
            });
            
            document.getElementById('tnNumber').value = '';
            document.getElementById('tnAmount').value = '';
            document.getElementById('paymentStatus').textContent = 'Ожидание оплаты...';
            document.getElementById('paymentStatus').style.color = '#6b5f4a';
            
            document.getElementById('cashAmount').value = '';
            document.getElementById('cashComment').value = '';
            document.getElementById('cashActionBtn').disabled = true;
            document.getElementById('cashActionStatus').textContent = 'Заполните сумму и комментарий';
            document.getElementById('cashActionStatus').style.color = '#6b5f4a';
            
            document.getElementById('startBalance').value = '';
            
            // Загружаем новую сессию (история подтянется из БД)
            await loadSession();
            
            statusEl.textContent = '✅ Новая смена открыта! История сохранена.';
            statusEl.style.color = '#2e7d32';
            setTimeout(closeClearModal, 1500);
        } else {
            statusEl.textContent = '❌ Ошибка: ' + (newResult.error || 'Неизвестная ошибка');
            statusEl.style.color = '#c62828';
        }
    } catch(e) {
        console.error('❌ Ошибка:', e);
        statusEl.textContent = '❌ Ошибка сервера';
        statusEl.style.color = '#c62828';
    }
}

// ========== ФУНКЦИИ ДЛЯ ИСТОРИИ ПО ПЕРИОДАМ ==========
function openHistoryModal() {
    document.getElementById('historyModal').classList.add('active');
    document.getElementById('historyDateFrom').value = '';
    document.getElementById('historyDateTo').value = '';
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
}

async function loadHistoryByDate() {
    const dateFrom = document.getElementById('historyDateFrom').value;
    const dateTo = document.getElementById('historyDateTo').value;

    if (!dateFrom || !dateTo) {
        alert('⚠️ Выберите даты "От" и "До"');
        return;
    }

    if (dateFrom > dateTo) {
        alert('⚠️ Дата "От" не может быть позже даты "До"');
        return;
    }

    try {
        const response = await window.secureFetch(
            `${API_BASE}/cashier.php?action=history&from=${dateFrom}&to=${dateTo}`,
            {
                method: 'GET',
                credentials: 'same-origin'
            }
        );
        const result = await response.json();

        if (result.success && result.history) {
            closeHistoryModal();
            
            if (result.history.length === 0) {
                alert('📭 За выбранный период нет операций');
                return;
            }
            
            // Формируем таблицу истории
            let tbodyHtml = '';
            result.history.forEach(item => {
                const date = new Date(item.created_at).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const sign = item.type === 'withdrawal' ? '-' : (item.type === 'deposit' ? '+' : '');
                const amountDisplay = `${sign}${item.amount.toLocaleString('ru-RU')} ₽`;
                
                tbodyHtml += `
                    <tr>
                        <td class="col-time">${date}</td>
                        <td class="col-tn">${item.tn_number}</td>
                        <td class="col-amount ${item.type === 'withdrawal' ? 'red' : 'green'}">${amountDisplay}</td>
                        <td class="col-comment">${item.comment || '—'}</td>
                    </tr>
                `;
            });

            const tableHtml = `
                <div class="history-table-wrapper">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>⏱ Время</th>
                                <th>📄 Операция</th>
                                <th style="text-align:right;">💰 Сумма</th>
                                <th>📝 Комментарий</th>
                            </tr>
                        </thead>
                        <tbody>${tbodyHtml}</tbody>
                    </table>
                </div>
                <div style="margin-top: 8px; font-size: 0.8rem; color: #6b5f4a;">
                    📅 Период: ${dateFrom} — ${dateTo} | Всего операций: ${result.history.length}
                </div>
            `;
            
            const container = document.getElementById('historyList');
            container.innerHTML = tableHtml;
            
            // Скрываем кнопку "Смотреть историю", показываем "Вернуться к текущей смене"
            const historyBtn = document.querySelector('#historyList .btn-secondary');
            if (historyBtn) {
                historyBtn.style.display = 'none';
            }
            const backBtnContainer = document.getElementById('backToCurrentBtnContainer');
            if (backBtnContainer) {
                backBtnContainer.style.display = 'flex';
            }
        } else {
            alert('❌ Ошибка загрузки истории: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch(e) {
        console.error('❌ Ошибка:', e);
        alert('❌ Ошибка сервера');
    }
}

// ========== ВОЗВРАТ К ТЕКУЩЕЙ СМЕНЕ ==========
async function backToCurrentSession() {
    await loadSession();
}

// ========== ЗАПУСК ==========
document.addEventListener('DOMContentLoaded', initCashier);

// ========== ДЕЛАЕМ ФУНКЦИИ ГЛОБАЛЬНЫМИ ==========
window.acceptPayment = acceptPayment;
window.processCashOperation = processCashOperation;
window.updateBalance = updateBalance;
window.calculateCash = calculateCash;
window.openClearModal = openClearModal;
window.closeClearModal = closeClearModal;
window.confirmNewShift = confirmNewShift;
window.openHistoryModal = openHistoryModal;
window.closeHistoryModal = closeHistoryModal;
window.loadHistoryByDate = loadHistoryByDate;
window.backToCurrentSession = backToCurrentSession;