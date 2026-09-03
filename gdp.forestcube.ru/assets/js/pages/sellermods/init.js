// ============================================================
// ИНИЦИАЛИЗАЦИЯ ПАНЕЛИ ПРОДАВЦА
// ============================================================

import { state, updateProductsData } from '../../modules/state.js';
import { DEFAULT_CUBE_PRICE } from '../../modules/config.js';
import {
    loadStocks, getNewInvoiceNumber, saveOrderToServer,
    loadClients, checkAuth, logout, getCSRFToken
} from '../../modules/api.js';
import { renderCart, clearCart, calculateTotalWithServices, addToCartFromRow, changeQty, scheduleAddToCart } from '../../modules/cart.js';
import { getClientData, saveClientData } from '../../modules/client.js';
import { addService, removeService } from '../../modules/services.js';
import { setupAutocomplete, selectSuggestion } from '../../modules/autocomplete.js';

// Импорт модулей стройматериалов
import { loadBuildingMaterials } from './building/api.js';
import { renderBuildingCatalog, updateBuildingBadge } from './building/catalog.js';
import { renderLumberCatalog, updateLumberBadges } from './lumber/catalog.js';

// Импорт из новых модулей
import { DEFAULT_LOADING_PRICE } from './core.js';
import {
    renderCatalog,
    showReminderModal,
    resetReminders,
    setActionsCompleted,
    getActionsCompleted,
    setBuildingProducts
} from './ui.js';
import { printInvoiceHandler } from './invoice.js';
import { saveOrder, sendOrder } from './order.js';
import { newDeal, resetCubePrice, resetLoadingPrice } from './deal.js';

// ========== ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let buildingProducts = [];

// ========== ФУНКЦИЯ ПЕРЕСЧЕТА ЦЕН ==========
function recalculatePrices(cubePriceValue) {
    const cubePrice = cubePriceValue || DEFAULT_CUBE_PRICE;
    updateProductsData(cubePrice);
    renderCatalog(state.currentGroup);
    localStorage.setItem('cubePrice', cubePrice);
}

// Делаем функцию доступной глобально для resetCubePrice
window.recalculatePrices = recalculatePrices;

// ========== ИНИЦИАЛИЗАЦИЯ ==========
export async function initSeller() {
    try {
        console.log('🚀 Инициализация панели продавца...');

        await getCSRFToken();
        console.log('✅ CSRF-токен получен');

        // ===== АВТОРИЗАЦИЯ =====
        let auth = false;
        try {
            console.log('🔐 Проверка авторизации...');
            auth = await checkAuth();
            console.log(`✅ Авторизация: ${auth ? 'успешна' : 'не пройдена'}`);
        } catch(e) {
            console.warn('⚠️ Ошибка авторизации:', e.message);
            auth = localStorage.getItem('calculator_auth') === 'true';
            if (!auth) {
                const currentPath = window.location.pathname;
                if (!currentPath.includes('index.html') && currentPath !== '/') {
                    localStorage.setItem('redirect_after_login', currentPath);
                    window.location.href = 'index.html';
                    return;
                }
            }
        }

        if (!auth) {
            console.warn('⚠️ Не авторизован, перенаправление');
            const currentPath = window.location.pathname;
            if (!currentPath.includes('index.html') && currentPath !== '/') {
                localStorage.setItem('redirect_after_login', currentPath);
            }
            window.location.href = 'index.html';
            return;
        }

        // ===== НАСТРОЙКА ЦЕНЫ КУБА =====
        const cubeInput = document.getElementById('cubePriceInput');
        if (cubeInput) {
            cubeInput.addEventListener('change', function() {
                const newPrice = parseFloat(this.value.replace(',', '.'));
                if (!isNaN(newPrice) && newPrice > 0) {
                    recalculatePrices(newPrice);
                }
            });
            cubeInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.dispatchEvent(new Event('change'));
                }
            });
        }

        const saved = localStorage.getItem('cubePrice');
        if (saved) {
            const val = parseFloat(saved);
            if (!isNaN(val) && val > 0) {
                recalculatePrices(val);
                console.log(`💰 Загружена цена из localStorage: ${val} руб/м³`);
            } else {
                recalculatePrices(DEFAULT_CUBE_PRICE);
            }
        } else {
            recalculatePrices(DEFAULT_CUBE_PRICE);
        }

        // ===== НАСТРОЙКА ЦЕНЫ ПОГРУЗКИ =====
        const loadingInput = document.getElementById('loadingPriceInput');
        if (loadingInput) {
            const savedLoadingPrice = localStorage.getItem('loadingPrice');
            if (savedLoadingPrice) {
                const val = parseFloat(savedLoadingPrice);
                if (!isNaN(val) && val > 0) {
                    loadingInput.value = val;
                }
            }

            loadingInput.addEventListener('change', function() {
                const newPrice = parseFloat(this.value.replace(',', '.'));
                if (!isNaN(newPrice) && newPrice > 0) {
                    localStorage.setItem('loadingPrice', newPrice);
                    renderCart();
                    const status = document.getElementById('cubePriceStatus');
                    if (status) {
                        status.textContent = `✅ Цена погрузки: ${newPrice} руб/м³`;
                        status.style.color = '#0d47a1';
                        setTimeout(() => { status.textContent = ''; }, 3000);
                    }
                }
            });
            loadingInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.dispatchEvent(new Event('change'));
                }
            });
        }

        // ===== ЗАГРУЗКА СТРОЙМАТЕРИАЛОВ =====
        try {
            console.log('🧱 Загрузка стройматериалов...');
            const loaded = await loadBuildingMaterials();
            buildingProducts = loaded;
            setBuildingProducts(loaded);
            console.log(`🧱 Загружено ${loaded.length} стройматериалов`);
        } catch(e) {
            console.warn('⚠️ Ошибка загрузки стройматериалов:', e.message);
            buildingProducts = [];
            setBuildingProducts([]);
        }

        // ===== ЗАГРУЗКА КЛИЕНТОВ =====
        try {
            console.log('📥 Загрузка списка клиентов...');
            const clients = await loadClients();
            if (clients && clients.length > 0) {
                localStorage.setItem('clientsCache', JSON.stringify(clients));
                console.log(`✅ Загружено ${clients.length} клиентов`);
            }
        } catch(e) {
            console.warn('⚠️ Ошибка загрузки клиентов:', e.message);
            try {
                const cached = localStorage.getItem('clientsCache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.length > 0) {
                        console.log(`📦 Используем кеш клиентов (${parsed.length} записей)`);
                    }
                }
            } catch(cacheError) {}
        }

        // ===== ЗАГРУЗКА ОСТАТКОВ =====
        try {
            console.log('📦 Загрузка остатков...');
            const stocks = await loadStocks();
            state.stocks = stocks || {};
            console.log('✅ Остатки загружены');
        } catch(e) {
            console.warn('⚠️ Ошибка загрузки остатков:', e.message);
            state.stocks = {};
            renderCatalog(state.currentGroup);
        }

        // ===== НАСТРОЙКА АВТОДОПОЛНЕНИЯ =====
        setupAutocomplete();
        console.log('🔍 Автодополнение настроено');

        // ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML =====
        window.addToCartFromRow = addToCartFromRow;
        window.changeQty = changeQty;
        window.scheduleAddToCart = scheduleAddToCart;
        window.clearCart = clearCart;
        window.saveOrder = saveOrder;
        window.printInvoiceHandler = printInvoiceHandler;
        window.sendOrder = sendOrder;
        window.logout = logout;
        window.newDeal = newDeal;
        window.resetCubePrice = resetCubePrice;
        window.resetLoadingPrice = resetLoadingPrice;
        window.addService = addService;
        window.removeService = removeService;
        window.selectSuggestion = selectSuggestion;

        // ===== СОБЫТИЯ =====
        document.getElementById('clientName')?.addEventListener('input', saveClientData);
        document.getElementById('clientPhone')?.addEventListener('input', saveClientData);
        document.getElementById('clientAddress')?.addEventListener('input', saveClientData);

        document.getElementById('optionCard')?.addEventListener('change', function() {
            saveClientData();
            renderCart();
        });

        document.getElementById('optionPreorder')?.addEventListener('change', function() {
            state.isPreorderMode = this.checked;
            const label = this.nextElementSibling;
            if (this.checked) {
                label.textContent = '📦 Предзаказ (ВКЛ)';
                label.style.color = '#c62828';
            } else {
                label.textContent = '📦 Предзаказ (списание в минус)';
                label.style.color = '#e65100';
            }
            renderCatalog(state.currentGroup);
        });

        const unpaidCheckbox = document.getElementById('optionUnpaid');
        if (unpaidCheckbox) {
            unpaidCheckbox.addEventListener('change', function() {
                const label = this.nextElementSibling;
                if (this.checked) {
                    label.textContent = '📌 Не оплачена (ВКЛ)';
                    label.style.color = '#c62828';
                } else {
                    label.textContent = '📌 Не оплачена';
                    label.style.color = '#8a7b64';
                }
            });
        }

        const loadingCheckbox = document.getElementById('optionLoading');
        if (loadingCheckbox) {
            state.isLoadingEnabled = loadingCheckbox.checked;
            loadingCheckbox.addEventListener('change', function() {
                state.isLoadingEnabled = this.checked;
                renderCart();
                saveClientData();
            });
        }

        const deliveryCheckbox = document.getElementById('optionDelivery');
        const deliveryBlock = document.getElementById('deliveryCostBlock');
        const deliveryCostInput = document.getElementById('deliveryCostInput');

        if (deliveryCheckbox && deliveryBlock) {
            deliveryCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    deliveryBlock.classList.add('show');
                    setTimeout(() => {
                        if (deliveryCostInput) deliveryCostInput.focus();
                    }, 100);
                } else {
                    deliveryBlock.classList.remove('show');
                    if (deliveryCostInput) deliveryCostInput.value = '';
                }
                renderCart();
                saveClientData();
            });

            if (deliveryCheckbox.checked) {
                deliveryBlock.classList.add('show');
            }
        }

        if (deliveryCostInput) {
            deliveryCostInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^\d]/g, '');
                renderCart();
                saveClientData();
            });
        }

        const addServiceBtn = document.getElementById('addServiceBtn');
        if (addServiceBtn) {
            addServiceBtn.addEventListener('click', addService);
        }

        const serviceNameInput = document.getElementById('serviceName');
        const servicePriceInput = document.getElementById('servicePrice');
        if (serviceNameInput) {
            serviceNameInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (servicePriceInput) servicePriceInput.focus();
                }
            });
        }
        if (servicePriceInput) {
            servicePriceInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addService();
                }
            });
            servicePriceInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^\d]/g, '');
            });
        }

        // ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
        document.getElementById('groupTabs').addEventListener('click', function(e) {
            const tab = e.target.closest('.tab');
            if (!tab) return;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentGroup = tab.dataset.group;
            renderCatalog(state.currentGroup);
        });

        // ===== НАПОМИНАНИЯ =====
        document.addEventListener('click', function(e) {
            if (e.target.closest('#reminderModal')) return;
            const btn = e.target.closest('button');
            if (btn) {
                const text = btn.textContent.trim();
                if (text.includes('Печать накладной') || text.includes('Отправить в MAX')) {
                    return;
                }
            }
            if (getActionsCompleted()) {
                showReminderModal();
            }
        });

        document.addEventListener('input', function(e) {
            if (e.target.closest('#reminderModal')) return;
            if (getActionsCompleted()) {
                showReminderModal();
            }
        });

        document.addEventListener('focus', function(e) {
            if (e.target.closest('#reminderModal')) return;
            if (getActionsCompleted()) {
                showReminderModal();
            }
        });

        // ===== ФИНАЛЬНЫЙ РЕНДЕРИНГ =====
        renderCart();
        renderCatalog(state.currentGroup);
        console.log('✅ Инициализация завершена успешно');

    } catch(e) {
        console.error('❌ Критическая ошибка инициализации:', e);
        const grid = document.getElementById('productsGrid');
        if (grid) {
            grid.innerHTML = `
                <div style="text-align:center;padding:40px;color:#c62828;">
                    <div style="font-size:2rem;margin-bottom:12px;">⚠️</div>
                    <p style="font-weight:600;">Ошибка загрузки данных</p>
                    <p style="font-size:0.85rem;color:#6b5f4a;margin-top:8px;">Проверьте подключение к интернету</p>
                    <button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;border-radius:30px;border:none;background:#5a4a32;color:white;font-weight:600;cursor:pointer;">⟳ Обновить</button>
                </div>
            `;
        }
    }
}