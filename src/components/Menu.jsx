import { useState, useEffect } from 'react';
import { restaurantService } from '../services/restaurantService';

export default function Menu() {
    const [dishes, setDishes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cart, setCart] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const data = await restaurantService.getMenu();
                setDishes(data);
            } catch (err) {
                setError("Error al cargar la carta. Verifica la conexión.");
            } finally {
                setLoading(false);
            }
        };
        fetchMenu();
    }, []);

    const updateQuantity = (dish, delta) => {
        setCart(prev => {
            const currentQty = prev[dish.id]?.quantity || 0;
            const newQty = currentQty + delta;
            
            // Regla de oro: No menos de 0, y NO superar el límite de stock de la cocina
            if (newQty < 0 || newQty > dish.maxAvailable) return prev;
            
            if (newQty === 0) {
                const newCart = { ...prev };
                delete newCart[dish.id];
                return newCart;
            }
            
            return {
                ...prev,
                [dish.id]: { ...dish, quantity: newQty }
            };
        });
    };

    const handleConfirmOrder = async () => {
        setIsSubmitting(true);

        try {
            // 1. Extraemos los platos del carrito como un arreglo (Array)
            const cartItems = Object.values(cart);

            // 2. Llamamos a "sendOrder" (el nombre correcto) pasándole la Mesa 1 y el carrito
            await restaurantService.sendOrder(1, cartItems);

            // 3. Éxito: Limpiamos y avisamos
            alert("¡Pedido enviado a cocina exitosamente!");
            setCart({});
            
            // 4. Actualizamos el menú para refrescar la cantidad de "Disponibles"
            fetchMenu(); 

        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="text-center p-10 text-gray-400">Cargando la carta...</div>;
    if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

    return (
        // Aplicamos el fondo oscuro de tu diseño referencial
        <div className="max-w-2xl mx-auto px-4 py-8 bg-[#1f2228] min-h-screen font-sans">
            <h1 className="text-3xl font-black text-gray-200 mb-8 text-center">Menú Sonqo</h1>
            
            <div className="space-y-4">
                {dishes.map((dish) => {
                    const currentQty = cart[dish.id]?.quantity || 0;
                    const isSoldOut = dish.maxAvailable <= 0;

                    return (
                        <div key={dish.id} className="bg-[#242731] rounded-xl overflow-hidden border border-gray-700/50 p-4 flex items-center justify-between shadow-sm">
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-gray-100">{dish.name}</h2>
                                <div className="flex flex-col mt-1">
                                    <span className="text-[#f97316] font-semibold">S/ {dish.price.toFixed(2)}</span>
                                    {/* Indicador de porciones en color verde estilo diseño */}
                                    <span className={`text-sm font-semibold mt-1 ${isSoldOut ? 'text-red-500' : 'text-[#10b981]'}`}>
                                        {isSoldOut ? 'AGOTADO' : `Disponibles: ${dish.maxAvailable} porciones`}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Panel oscuro de botones numéricos */}
                            <div className="flex items-center gap-2 bg-[#13151a] rounded-lg p-1 border border-gray-700/50">
                                <button 
                                    onClick={() => updateQuantity(dish, -1)}
                                    disabled={currentQty === 0}
                                    className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
                                >
                                    -
                                </button>
                                <span className="w-6 text-center font-bold text-gray-200">
                                    {currentQty}
                                </span>
                                <button 
                                    onClick={() => updateQuantity(dish, 1)}
                                    disabled={currentQty >= dish.maxAvailable || isSoldOut}
                                    className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Barra flotante inferior (Carrito) */}
            {Object.keys(cart).length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-[#242731] border-t border-gray-700/50 p-4 shadow-lg">
                    <div className="max-w-2xl mx-auto flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-400">Total a pagar</p>
                            <p className="text-xl font-bold text-gray-100">
                                S/ {Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                            </p>
                        </div>
                        <button 
                            onClick={handleConfirmOrder}
                            disabled={isSubmitting}
                            className="bg-[#f97316] hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Procesando...' : 'Confirmar Pedido'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}