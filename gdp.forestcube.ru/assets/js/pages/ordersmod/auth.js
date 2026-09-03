import { API_BASE } from './config.js';

export async function checkAuth() {
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
            window.location.href = '/login';
        }
    } catch(e) { 
        localStorage.setItem('redirect_after_login', window.location.pathname);
        window.location.href = '/login'; 
    }
}

export async function logout() {
    try { await window.secureFetch(`${API_BASE}/logout.php`, { method: 'POST', credentials: 'same-origin' }); } catch(e) {}
    localStorage.removeItem('redirect_after_login');
    window.location.href = '/login';
}