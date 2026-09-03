// ========== АВТОДОПОЛНЕНИЕ ==========

import { renderCart } from './cart.js';
import { saveClientData } from './client.js';

export function setupAutocomplete() {
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    
    if (!nameInput || !phoneInput) return;
    
    const nameContainer = document.createElement('div');
    nameContainer.id = 'suggestionsName';
    nameContainer.style.cssText = `
        position: absolute;
        background: white;
        border: 1px solid #d9ceb5;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        width: 100%;
        max-height: 200px;
        overflow-y: auto;
        display: none;
        top: 100%;
        left: 0;
    `;
    nameInput.parentNode.style.position = 'relative';
    nameInput.parentNode.appendChild(nameContainer);
    
    const phoneContainer = document.createElement('div');
    phoneContainer.id = 'suggestionsPhone';
    phoneContainer.style.cssText = `
        position: absolute;
        background: white;
        border: 1px solid #d9ceb5;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        width: 100%;
        max-height: 200px;
        overflow-y: auto;
        display: none;
        top: 100%;
        left: 0;
    `;
    phoneInput.parentNode.style.position = 'relative';
    phoneInput.parentNode.appendChild(phoneContainer);
    
    nameInput.addEventListener('focus', function() {
        hideSuggestions('phone');
        const val = this.value.trim();
        if (val.length >= 2) {
            const suggestions = getClientSuggestions(val, 'client_name');
            showSuggestions('name', suggestions);
        }
    });
    
    nameInput.addEventListener('input', function() {
        const val = this.value.trim();
        if (val.length < 2) {
            hideSuggestions('name');
            return;
        }
        const suggestions = getClientSuggestions(val, 'client_name');
        showSuggestions('name', suggestions);
    });
    
    nameInput.addEventListener('blur', function() {
        setTimeout(() => {
            const active = document.activeElement;
            const container = document.getElementById('suggestionsName');
            if (container && container.contains(active)) {
                return;
            }
            hideSuggestions('name');
        }, 200);
    });
    
    phoneInput.addEventListener('focus', function() {
        hideSuggestions('name');
        const val = this.value.trim();
        if (val.length >= 2) {
            const suggestions = getClientSuggestions(val, 'phone');
            showSuggestions('phone', suggestions);
        }
    });
    
    phoneInput.addEventListener('input', function() {
        const val = this.value.trim();
        if (val.length < 2) {
            hideSuggestions('phone');
            return;
        }
        const suggestions = getClientSuggestions(val, 'phone');
        showSuggestions('phone', suggestions);
    });
    
    phoneInput.addEventListener('blur', function() {
        setTimeout(() => {
            const active = document.activeElement;
            const container = document.getElementById('suggestionsPhone');
            if (container && container.contains(active)) {
                return;
            }
            hideSuggestions('phone');
        }, 200);
    });
    
    document.addEventListener('click', function(e) {
        const nameContainer = document.getElementById('suggestionsName');
        const phoneContainer = document.getElementById('suggestionsPhone');
        
        if (nameContainer && !nameContainer.contains(e.target) && e.target.id !== 'clientName') {
            hideSuggestions('name');
        }
        if (phoneContainer && !phoneContainer.contains(e.target) && e.target.id !== 'clientPhone') {
            hideSuggestions('phone');
        }
    });
    
    function showSuggestions(type, suggestions) {
        const container = document.getElementById(type === 'name' ? 'suggestionsName' : 'suggestionsPhone');
        if (!container) return;
        
        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }
        
        let html = '';
        suggestions.forEach(s => {
            const name = s.client_name || '';
            const phone = s.phone || '';
            const address = s.address || '';
            
            let mainText = '';
            let subText = '';
            
            if (type === 'name') {
                mainText = name;
                subText = phone + (address ? ' | ' + address : '');
            } else {
                mainText = phone;
                subText = name + (address ? ' | ' + address : '');
            }
            
            const safeName = name.replace(/'/g, "\\'");
            const safePhone = phone.replace(/'/g, "\\'");
            const safeAddress = (address || '').replace(/'/g, "\\'");
            
            html += `
                <div style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #f0ebdf; font-size:0.9rem;"
                     onmouseover="this.style.background='#f0ebdf'" 
                     onmouseout="this.style.background='white'"
                     onmousedown="window.selectSuggestion('${type}', '${safeName}', '${safePhone}', '${safeAddress}')">
                    <div style="font-weight:600;">${mainText}</div>
                    ${subText ? `<div style="font-size:0.75rem; color:#8a7b64;">${subText}</div>` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
        container.style.display = 'block';
    }
    
    function hideSuggestions(type) {
        if (type === 'name' || !type) {
            const container = document.getElementById('suggestionsName');
            if (container) {
                container.innerHTML = '';
                container.style.display = 'none';
            }
        }
        if (type === 'phone' || !type) {
            const container = document.getElementById('suggestionsPhone');
            if (container) {
                container.innerHTML = '';
                container.style.display = 'none';
            }
        }
    }
}

export function getClientSuggestions(input, field) {
    if (!input || input.length < 2) return [];
    const lower = input.toLowerCase();
    const clients = JSON.parse(localStorage.getItem('clientsCache') || '[]');
    return clients
        .filter(c => {
            const val = c[field] || '';
            return val.toLowerCase().includes(lower);
        })
        .slice(0, 5);
}

export function selectSuggestion(type, name, phone, address) {
    console.log('🔍 selectSuggestion вызвана:', type, name, phone, address);
    
    if (type === 'name') {
        document.getElementById('clientName').value = name;
        document.getElementById('clientPhone').value = phone;
        if (address && document.getElementById('clientAddress')) {
            document.getElementById('clientAddress').value = address;
        }
    } else {
        document.getElementById('clientPhone').value = phone;
        document.getElementById('clientName').value = name;
        if (address && document.getElementById('clientAddress')) {
            document.getElementById('clientAddress').value = address;
        }
    }
    
    const nameContainer = document.getElementById('suggestionsName');
    const phoneContainer = document.getElementById('suggestionsPhone');
    if (nameContainer) { nameContainer.innerHTML = ''; nameContainer.style.display = 'none'; }
    if (phoneContainer) { phoneContainer.innerHTML = ''; phoneContainer.style.display = 'none'; }
    
    saveClientData();
    renderCart();
}