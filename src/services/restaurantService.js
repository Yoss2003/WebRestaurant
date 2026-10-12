import api from './api';

export const restaurantService = {
    // 1. Traer todos los platos disponibles
    getMenu: async () => {
        const response = await api.get('/Dishes');
        return response.data;
    },

    // 2. Enviar el pedido a la mesa
    sendOrder: async (tableId, cartItems) => {
        // Mapeamos el carrito de React al OrderCreateDTO que pide tu C#
        const orderPayload = {
            tableId: tableId,
            items: cartItems.map(item => ({
                dishId: item.id,
                quantity: item.quantity,
                notes: item.notes || ""
            }))
        };

        const response = await api.post('/Orders', orderPayload);
        return response.data;
    }
};