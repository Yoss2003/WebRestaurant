// components/Menu.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { restaurantService } from '../services/restaurantService';

const MAX_QUANTITY_PER_DISH = 100;

// Validación estricta de enteros positivos (rechaza '5abc', 'abc', '0' y negativos)
function parseStrictPositiveInt(value) {
    if (!value) return null;
    const str = String(value).trim();
    if (!/^[1-9]\d*$/.test(str)) return null;
    const num = Number(str);
    return Number.isSafeInteger(num) && num > 0 ? num : null;
}

// Validación del contrato recibido desde la API
function sanitizeDishes(rawData) {
    const list = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.$values)
            ? rawData.$values
            : Array.isArray(rawData?.data)
                ? rawData.data
                : null;

    if (!list) {
        throw new Error('Formato de menú inválido.');
    }

    return list
        .filter((d) => d && typeof d === 'object' && d.id != null && typeof d.name === 'string')
        .map((d) => {
            const price = Number(d.price);
            const hasMax = d.maxAvailable !== undefined && d.maxAvailable !== null && Number.isFinite(Number(d.maxAvailable));
            const maxAvailable = hasMax
                ? Math.max(0, Math.min(Math.floor(Number(d.maxAvailable)), MAX_QUANTITY_PER_DISH))
                : 0;

            return {
                ...d,
                id: Number(d.id),
                name: d.name.trim(),
                price: Number.isFinite(price) && price >= 0 ? price : null,
                maxAvailable
            };
        })
        .filter((d) => d.price !== null);
}

export default function Menu() {
    const [dishes, setDishes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cart, setCart] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'warning' | 'error', text: string }
    
    const submittingRef = useRef(false);
    const abortControllerRef = useRef(null);

    const [{ tableId, restaurantId, isTableValid }] = useState(() => {
        if (typeof window === 'undefined') {
            return { tableId: null, restaurantId: 1, isTableValid: false };
        }
        const params = new URLSearchParams(window.location.search);
        const parsedTable = parseStrictPositiveInt(params.get('mesa'));
        const rawRest = params.get('restaurante') ?? import.meta.env.VITE_DEFAULT_RESTAURANT_ID ?? '1';
        const parsedRest = parseStrictPositiveInt(rawRest) ?? 1;

        return {
            tableId: parsedTable,
            restaurantId: parsedRest,
            isTableValid: parsedTable !== null
        };
    });

    // Carga de menú estabilizada con useCallback
    const loadMenu = useCallback(async (signal) => {
        setLoading(true);
        setError(null);
        try {
            const data = await restaurantService.getMenu({ restaurantId, tableId, signal });
            if (!signal?.aborted) {
                setDishes(sanitizeDishes(data));
            }
        } catch (err) {
            if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
            console.error('Hubo un error al cargar el menú: ', err);
            if (!signal?.aborted) {
                setError('No se pudo cargar la carta. Verifica tu conexión e inténtalo de nuevo.');
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [restaurantId, tableId]);

    // useEffect limpio que cumple con las reglas de ESLint para efectos
    useEffect(() => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const fetchInitialMenu = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await restaurantService.getMenu({ 
                    restaurantId, 
                    tableId, 
                    signal: controller.signal 
                });
                if (!controller.signal.aborted) {
                    setDishes(sanitizeDishes(data));
                }
            } catch (err) {
                if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
                console.error('Hubo un error al cargar el menú: ', err);
                if (!controller.signal.aborted) {
                    setError('No se pudo cargar la carta. Verifica tu conexión e inténtalo de nuevo.');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchInitialMenu();

        return () => {
            controller.abort();
        };
    }, [restaurantId, tableId]);

    const handleRetry = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        loadMenu(controller.signal);
    };

    const updateQuantity = (dish, delta) => {
        if (isSubmitting || submittingRef.current || !isTableValid) return;

        const maxAllowed = Math.min(dish.maxAvailable ?? 0, MAX_QUANTITY_PER_DISH);

        setCart((prev) => {
            const currentQty = prev[dish.id]?.quantity || 0;
            const newQty = currentQty + delta;

            if (newQty < 0 || newQty > maxAllowed) return prev;

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
                    notes: prev[dish.id]?.notes || ''
                }
            };
        });
    };

    const updateNotes = (dishId, notes) => {
        if (isSubmitting || submittingRef.current) return;
        setCart((prev) => {
            if (!prev[dishId]) return prev;
            return {
                ...prev,
                [dishId]: { ...prev[dishId], notes: notes.slice(0, 200) }
            };
        });
    };

    const handleConfirmOrder = async () => {
        if (submittingRef.current || isSubmitting) return;

        if (!isTableValid || !tableId) {
            setFeedback({
                type: 'error',
                text: 'Enlace de mesa inválido. Escanea nuevamente el código QR de tu mesa.'
            });
            return;
        }

        const snapshotItems = Object.values(cart).map((item) => ({ ...item }));
        if (snapshotItems.length === 0) return;

        submittingRef.current = true;
        setIsSubmitting(true);
        setFeedback(null);

        // 1. Enviar el pedido
        try {
            const response = await restaurantService.sendOrder(tableId, snapshotItems, restaurantId);
            const orderId = response?.orderId ?? response?.id;

            setCart({});
            setFeedback({
                type: 'success',
                text: orderId
                    ? `¡Pedido #${orderId} enviado a cocina para la Mesa ${tableId}!`
                    : `¡Pedido enviado a cocina para la Mesa ${tableId}!`
            });
        } catch (err) {
            const backendMessage =
                typeof err.response?.data === 'string'
                    ? err.response.data
                    : err.response?.data?.message || err.message;
            setFeedback({
                type: 'error',
                text: `No se pudo enviar el pedido: ${backendMessage}`
            });
            submittingRef.current = false;
            setIsSubmitting(false);
            return;
        }

        // 2. Recargar disponibilidad en bloque separado
        try {
            const controller = new AbortController();
            abortControllerRef.current = controller;
            const data = await restaurantService.getMenu({
                restaurantId,
                tableId,
                signal: controller.signal
            });
            setDishes(sanitizeDishes(data));
        } catch (reloadErr) {
            console.error('Error al actualizar disponibilidad tras el pedido:', reloadErr);
            setFeedback({
                type: 'warning',
                text: `¡Pedido enviado a cocina para la Mesa ${tableId}! (No se pudo refrescar el stock en pantalla).`
            });
        } finally {
            submittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1f2228] flex items-center justify-center p-10 text-gray-400" role="status">
                Cargando la carta...
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#1f2228] flex flex-col items-center justify-center p-10 text-center" role="alert">
                <p className="text-red-400 font-semibold mb-4">{error}</p>
                <button
                    type="button"
                    onClick={handleRetry}
                    className="bg-[#f97316] hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold transition-colors"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    const totalCartAmount = Object.values(cart).reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 bg-[#1f2228] min-h-screen font-sans pb-32">
            <h1 className="text-3xl font-black text-gray-200 mb-2 text-center">Menú Sonqo</h1>

            {isTableValid ? (
                <p className="text-center text-[#f97316] font-bold mb-6">Mesa {tableId}</p>
            ) : (
                <div
                    role="alert"
                    className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 text-sm text-center font-semibold"
                >
                    Número de mesa inválido o ausente. Por favor, escanea nuevamente el código QR de tu mesa para realizar un pedido.
                </div>
            )}

            {feedback && (
                <div
                    role={feedback.type === 'error' ? 'alert' : 'status'}
                    aria-live="polite"
                    className={`mb-6 p-4 rounded-xl border text-sm font-semibold text-center ${
                        feedback.type === 'error'
                            ? 'bg-red-500/10 border-red-500/40 text-red-400'
                            : feedback.type === 'warning'
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                                : 'bg-emerald-500/10 border-emerald-500/40 text-[#10b981]'
                    }`}
                >
                    {feedback.text}
                </div>
            )}

            {dishes.length === 0 ? (
                <div className="text-center p-10 text-gray-400 bg-[#242731] rounded-xl border border-gray-700/50" role="status">
                    No hay platos disponibles en este momento.
                </div>
            ) : (
                <div className="space-y-4">
                    {dishes.map((dish) => {
                        const cartItem = cart[dish.id];
                        const currentQty = cartItem?.quantity || 0;
                        const maxAllowed = Math.min(dish.maxAvailable ?? 0, MAX_QUANTITY_PER_DISH);
                        const isSoldOut = maxAllowed <= 0;
                        const noteInputId = `notes-dish-${dish.id}`;

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
                                            type="button"
                                            aria-label={`Disminuir cantidad de ${dish.name}`}
                                            onClick={() => updateQuantity(dish, -1)}
                                            disabled={currentQty === 0 || isSubmitting || !isTableValid}
                                            className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
                                        >
                                            -
                                        </button>
                                        <span className="w-6 text-center font-bold text-gray-200" aria-live="polite">
                                            {currentQty}
                                        </span>
                                        <button
                                            type="button"
                                            aria-label={`Aumentar cantidad de ${dish.name}`}
                                            onClick={() => updateQuantity(dish, 1)}
                                            disabled={currentQty >= maxAllowed || isSoldOut || isSubmitting || !isTableValid}
                                            className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                {currentQty > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                                        <label htmlFor={noteInputId} className="sr-only">
                                            Notas del pedido para {dish.name}
                                        </label>
                                        <input
                                            id={noteInputId}
                                            type="text"
                                            aria-label={`Notas del pedido para ${dish.name}`}
                                            placeholder="Ej: Sin ají, bien cocido..."
                                            value={cartItem.notes || ''}
                                            disabled={isSubmitting}
                                            maxLength={200}
                                            onChange={(e) => updateNotes(dish.id, e.target.value)}
                                            className="w-full bg-[#13151a] text-gray-200 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#f97316] disabled:opacity-50"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {Object.keys(cart).length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-[#242731] border-t border-gray-700/50 p-4 shadow-lg z-50">
                    <div className="max-w-2xl mx-auto flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-400">Total a pagar</p>
                            <p className="text-xl font-bold text-gray-100">
                                S/ {totalCartAmount.toFixed(2)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleConfirmOrder}
                            disabled={isSubmitting || !isTableValid}
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