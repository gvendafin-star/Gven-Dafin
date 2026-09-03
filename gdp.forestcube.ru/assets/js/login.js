// ============================================================
// СТРАНИЦА ВХОДА - С ПОДДЕРЖКОЙ ЛОГИНА
// ============================================================

const API_BASE = '/api';
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const statusEl = document.getElementById('status');

async function login() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username) {
        statusEl.className = 'status error';
        statusEl.textContent = '❌ Введите логин!';
        usernameInput.focus();
        return;
    }

    if (!password) {
        statusEl.className = 'status error';
        statusEl.textContent = '❌ Введите пароль!';
        passwordInput.focus();
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '⏳ Проверка...';
    statusEl.textContent = '';
    statusEl.className = 'status';

    try {
        const response = await fetch(`${API_BASE}/login.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username: username, password: password })
        });

        const result = await response.json();

        if (result.success) {
            // Сохраняем CSRF-токен
            if (result.csrf_token) {
                localStorage.setItem('csrf_token', result.csrf_token);
                window.csrfToken = result.csrf_token;
            }

            statusEl.className = 'status success';
            statusEl.textContent = `✅ Добро пожаловать, ${username}! Перенаправление...`;
            
            // Очищаем поля
            usernameInput.value = '';
            passwordInput.value = '';

            // Получаем путь для редиректа
            const redirect = localStorage.getItem('redirect_after_login') || '/';
            localStorage.removeItem('redirect_after_login');
            
            setTimeout(() => {
                window.location.href = redirect;
            }, 800);
        } else {
            statusEl.className = 'status error';
            statusEl.textContent = `❌ ${result.error || 'Неверный логин или пароль!'}`;
            passwordInput.value = '';
            passwordInput.focus();
        }
    } catch (e) {
        console.error('❌ Ошибка входа:', e);
        statusEl.className = 'status error';
        statusEl.textContent = '❌ Ошибка сервера. Попробуйте позже.';
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = '🚪 Войти';
    }
}

// ========== ОБРАБОТЧИКИ ==========
loginBtn.addEventListener('click', login);

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') passwordInput.focus();
});

passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});

// Автофокус на поле логина
usernameInput.focus();

// Если был редирект — показываем сообщение
const redirectPath = localStorage.getItem('redirect_after_login');
if (redirectPath && redirectPath !== '/') {
    statusEl.className = 'status';
    statusEl.textContent = `ℹ️ Для доступа к ${redirectPath} войдите в систему`;
    statusEl.style.color = '#6b5f4a';
}