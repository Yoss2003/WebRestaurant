import api from './api';

export const restaurantService = {
    getMenu: async (options = {}) => {
        const { restaurantId, tableId, signal } = options;
        const params = {};
        if (restaurantId) params.restaurantId = restaurantId;
        if (tableId) params.tableId = tableId;

        const response = await api.get('/Dishes', { params, signal });
        return response.data;
    },

    sendOrder: async (tableId, cartItems, restaurantId = 1) => {
        const payload = {
            tableId: Number(tableId),
            restaurantId: Number(restaurantId),
            items: cartItems.map(item => ({
                dishId: Number(item.id),
                quantity: Number(item.quantity),
                notes: (item.notes || '').trim()
            }))
        };
        const response = await api.post('/Orders', payload);
        return response.data;
    }
};