export const state = {
    allOrders: [],
    currentOrderId: null,
    editMode: false,
    editCart: {},
    editServices: [],
    editOrderData: {},
    currentStatusFilter: 'all'
};

export function resetState() {
    state.allOrders = [];
    state.currentOrderId = null;
    state.editMode = false;
    state.editCart = {};
    state.editServices = [];
    state.editOrderData = {};
    state.currentStatusFilter = 'all';
}