// components/Menu.jsx
import { useState, useEffect } from 'react';
import { restaurantService } from '../services/restaurantService';

export default function Menu() {
    const [dishes, setDishes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error] = useState(null);
    const [cart, setCart] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tableId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const mesa = params.get('mesa');
        return mesa ? parseInt(mesa) : null;
    });

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const data = await restaurantService.getMenu();
                setDishes(data);
            } catch (err){
                console.error("Hubo un error al cargar el menú: ", err);
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
            
            if (newQty < 0 || newQty > dish.maxAvailable) return prev;
            
            if (newQty === 0) {
                const newCart = { ...prev };
                delete newCart[dish.id];
                return newCart;
            }
            
            return {
                ...prev,
                [dish.id]: { 
                    ...dish, 
                    quantity: newQty,
                    notes: prev[dish.id]?.notes || "" // Mantener notas si ya existían
                }
            };
        });
    };

    const updateNotes = (dishId, notes) => {
        setCart(prev => ({
            ...prev,
            [dishId]: { ...prev[dishId], notes }
        }));
    };

    const handleConfirmOrder = async () => {
        setIsSubmitting(true);
        try {
            const cartItems = Object.values(cart);
            // Ahora usa el tableId dinámico
            await restaurantService.sendOrder(tableId, cartItems);
            
            alert(`¡Pedido enviado a cocina para la Mesa ${tableId}!`);
            setCart({});
            
            // Recargar para actualizar disponibilidades
            const data = await restaurantService.getMenu();
            setDishes(data);
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="text-center p-10 text-gray-400">Cargando la carta...</div>;
    if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 bg-[#1f2228] min-h-screen font-sans pb-32">
            <h1 className="text-3xl font-black text-gray-200 mb-2 text-center">Menú Sonqo</h1>
            <p className="text-center text-[#f97316] font-bold mb-8">Mesa {tableId}</p>
            
            <div className="space-y-4">
                {dishes.map((dish) => {
                    const cartItem = cart[dish.id];
                    const currentQty = cartItem?.quantity || 0;
                    const isSoldOut = dish.maxAvailable <= 0;
                    
                    return (
                        <div key={dish.id} className="bg-[#242731] rounded-xl overflow-hidden border border-gray-700/50 p-4 flex flex-col shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 pr-2">
                                    <h2 className="text-lg font-bold text-gray-100">{dish.name}</h2>
                                    <div className="flex flex-col mt-1">
                                        <span className="text-[#f97316] font-semibold">S/ {dish.price.toFixed(2)}</span>
                                        <span className={`text-sm font-semibold mt-1 ${isSoldOut ? 'text-red-500' : 'text-[#10b981]'}`}>
                                            {isSoldOut ? 'AGOTADO' : `Disponibles: ${dish.maxAvailable}`}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 bg-[#13151a] rounded-lg p-1 border border-gray-700/50">
                                    <button 
                                        onClick={() => updateQuantity(dish, -1)}
                                        disabled={currentQty === 0}
                                        className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
                                    >-</button>
                                    <span className="w-6 text-center font-bold text-gray-200">{currentQty}</span>
                                    <button 
                                        onClick={() => updateQuantity(dish, 1)}
                                        disabled={currentQty >= dish.maxAvailable || isSoldOut}
                                        className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
                                    >+</button>
                                </div>
                            </div>

                            {/* Campo de notas condicional (solo aparece si hay al menos 1 en el carrito) */}
                            {currentQty > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-700/50">
                                    <input 
                                        type="text"
                                        placeholder="Ej: Sin ají, bien cocido..."
                                        value={cartItem.notes || ''}
                                        onChange={(e) => updateNotes(dish.id, e.target.value)}
                                        className="w-full bg-[#13151a] text-gray-200 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#f97316]"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {Object.keys(cart).length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-[#242731] border-t border-gray-700/50 p-4 shadow-lg z-50">
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
                            {isSubmitting ? 'Procesando...' : 'Pedir ahora'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}