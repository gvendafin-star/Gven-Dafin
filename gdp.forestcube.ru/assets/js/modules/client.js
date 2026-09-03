// ========== ДАННЫЕ КЛИЕНТА ==========

export function getClientData() {
    return {
        name: document.getElementById('clientName')?.value?.trim() || '',
        phone: document.getElementById('clientPhone')?.value?.trim() || '',
        address: document.getElementById('clientAddress')?.value?.trim() || '',
        comment: document.getElementById('clientComment')?.value?.trim() || '',
        delivery: document.getElementById('optionDelivery')?.checked || false,
        deliveryCost: parseInt(document.getElementById('deliveryCostInput')?.value?.replace(/[^\d]/g, '') || 0) || 0,
        card: document.getElementById('optionCard')?.checked || false,
        loading: document.getElementById('optionLoading')?.checked || false
    };
}

export function saveClientData() {
    const data = getClientData();
    localStorage.setItem('seller_client_name', data.name);
    localStorage.setItem('seller_client_phone', data.phone);
    localStorage.setItem('seller_client_address', data.address);
    localStorage.setItem('seller_client_comment', data.comment);
    localStorage.setItem('seller_client_delivery', data.delivery ? '1' : '0');
    localStorage.setItem('seller_client_delivery_cost', data.deliveryCost.toString());
    localStorage.setItem('seller_client_card', data.card ? '1' : '0');
    localStorage.setItem('seller_client_loading', data.loading ? '1' : '0');
}

export function loadClientData() {
    const name = localStorage.getItem('seller_client_name') || '';
    const phone = localStorage.getItem('seller_client_phone') || '';
    const address = localStorage.getItem('seller_client_address') || '';
    const comment = localStorage.getItem('seller_client_comment') || '';
    const delivery = localStorage.getItem('seller_client_delivery') === '1';
    const deliveryCost = localStorage.getItem('seller_client_delivery_cost') || '';
    const card = localStorage.getItem('seller_client_card') === '1';
    const loading = localStorage.getItem('seller_client_loading') === '1';
    
    if (document.getElementById('clientName')) document.getElementById('clientName').value = name;
    if (document.getElementById('clientPhone')) document.getElementById('clientPhone').value = phone;
    if (document.getElementById('clientAddress')) document.getElementById('clientAddress').value = address;
    if (document.getElementById('clientComment')) document.getElementById('clientComment').value = comment;
    if (document.getElementById('optionDelivery')) document.getElementById('optionDelivery').checked = delivery;
    if (document.getElementById('deliveryCostInput')) document.getElementById('deliveryCostInput').value = deliveryCost;
    if (document.getElementById('optionCard')) document.getElementById('optionCard').checked = card;
    if (document.getElementById('optionLoading')) document.getElementById('optionLoading').checked = loading;
    
    toggleDeliveryField(delivery);
}

export function toggleDeliveryField(show) {
    const block = document.getElementById('deliveryCostBlock');
    if (block) block.classList.toggle('show', show);
}