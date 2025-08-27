// Componente integrado en MaintenanceForm para agregar servicios desde el catálogo
import React, { useState, useEffect } from 'react';
import { database } from '../config/firebase';
import { ref as databaseRef, onValue, off, push, update } from 'firebase/database';
import { Search, Plus, Trash2, Package, DollarSign } from 'lucide-react';

// Componente para agregar servicios del catálogo al formulario de mantenimiento
const ServiceCatalogSelector = ({ 
    onAddService, 
    selectedServices, 
    onRemoveService, 
    isMobile 
}) => {
    const [catalogoServicios, setCatalogoServicios] = useState([]);
    const [busquedaCodigo, setBusquedaCodigo] = useState('');
    const [cantidad, setCantidad] = useState(1);
    const [showCatalog, setShowCatalog] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Cargar catálogo de servicios
    useEffect(() => {
        const serviciosRef = databaseRef(database, 'catalogo_servicios');
        const unsubscribe = onValue(serviciosRef, (snapshot) => {
            const data = snapshot.val();
                    console.log('Servicios del catálogo:', data); // <-- Agregar esta línea

            if (data) {
                const serviciosArray = Object.entries(data).map(([id, servicio]) => ({
                    id,
                    ...servicio
                }));
                setCatalogoServicios(serviciosArray);
            }
        });

        return () => off(serviciosRef);
    }, []);

    // Calcular totales del servicio
    const calcularTotalesServicio = (servicio, cantidadServicio = 1) => {
        const repuestosNeto = servicio.repuestos?.reduce((total, rep) => 
            total + (rep.cantidad * rep.costoUnitario * cantidadServicio), 0) || 0;
        const iva = Math.round(repuestosNeto * 0.19);
        const repuestosConIva = repuestosNeto + iva;
        const manoObra = (servicio.manoObra || 0) * cantidadServicio;
        const total = repuestosConIva + manoObra;

        return { repuestosNeto, iva, repuestosConIva, manoObra, total };
    };

    // Agregar servicio por código
    const agregarServicioPorCodigo = () => {
        const servicio = catalogoServicios.find(s => 
            s.codigo.toLowerCase() === busquedaCodigo.toLowerCase()
        );

        if (!servicio) {
            setMessage({
                type: 'error',
                text: '❌ No se encontró un servicio con ese código'
            });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            return;
        }

        const totales = calcularTotalesServicio(servicio, cantidad);
        const servicioConDetalles = {
            ...servicio,
            cantidadServicio: cantidad,
            totales,
            idTemp: Date.now()
        };

        onAddService(servicioConDetalles);
        
        setBusquedaCodigo('');
        setCantidad(1);
        setMessage({
            type: 'success',
            text: `✅ Servicio ${servicio.codigo} agregado al mantenimiento`
        });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    };

    // Calcular total de todos los servicios seleccionados
    const calcularTotalServicios = () => {
        return selectedServices.reduce((total, servicio) => {
            return total + (servicio.totales?.total || 0);
        }, 0);
    };

    return (
        <div style={{
            marginBottom: '25px',
            paddingBottom: '20px',
            borderBottom: '1px solid #e5e7eb'
        }}>
            <h4 style={{
                margin: '0 0 15px 0',
                fontSize: '16px',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <span>📦 Servicios del Catálogo</span>
                <button
                    type="button"
                    onClick={() => setShowCatalog(!showCatalog)}
                    style={{
                        padding: '6px 12px',
                        background: '#8b5cf6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    {showCatalog ? 'Ocultar Catálogo' : 'Ver Catálogo Completo'}
                </button>
            </h4>

            {/* Mensajes */}
            {message.text && (
                <div style={{
                    padding: '10px',
                    borderRadius: '6px',
                    marginBottom: '15px',
                    background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                    border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
                    color: message.type === 'success' ? '#166534' : '#991b1b',
                    fontSize: '13px'
                }}>
                    {message.text}
                </div>
            )}

            {/* Agregar servicio por código */}
            <div style={{
                padding: '15px',
                background: '#f0f9ff',
                borderRadius: '8px',
                marginBottom: '20px'
            }}>
                <div style={{ marginBottom: '10px', fontSize: '14px', color: '#0c4a6e' }}>
                    <strong>Agregar Servicio Rápido por Código</strong>
                </div>
                
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap'
                }}>
                    <input
                        type="text"
                        placeholder="Código del servicio (ej: MANT-001)"
                        value={busquedaCodigo}
                        onChange={(e) => setBusquedaCodigo(e.target.value.toUpperCase())}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                agregarServicioPorCodigo();
                            }
                        }}
                        style={{
                            flex: 1,
                            minWidth: '200px',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                        }}
                    />
                    
                    <input
                        type="number"
                        placeholder="Cantidad"
                        value={cantidad}
                        onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                        min="1"
                        style={{
                            width: '100px',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                        }}
                    />
                    
                    <button
                        type="button"
                        onClick={agregarServicioPorCodigo}
                        style={{
                            padding: '8px 20px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <Plus size={16} />
                        Agregar
                    </button>
                </div>

                {/* Códigos disponibles */}
                <div style={{
                    marginTop: '10px',
                    fontSize: '12px',
                    color: '#64748b'
                }}>
                    <strong>Códigos disponibles:</strong> {catalogoServicios.map(s => s.codigo).join(', ')}
                </div>
            </div>

            {/* Mostrar catálogo completo */}
            {showCatalog && (
                <div style={{
                    marginBottom: '20px',
                    padding: '15px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    maxHeight: '400px',
                    overflowY: 'auto'
                }}>
                    <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                        Catálogo de Servicios Disponibles
                    </div>
                    
                    <div style={{
                        display: 'grid',
                        gap: '10px'
                    }}>
                        {catalogoServicios.map(servicio => {
                            const totales = calcularTotalesServicio(servicio, 1);
                            const yaAgregado = selectedServices.some(s => s.codigo === servicio.codigo);
                            
                            return (
                                <div key={servicio.id} style={{
                                    padding: '12px',
                                    background: yaAgregado ? '#dcfce7' : 'white',
                                    border: '1px solid',
                                    borderColor: yaAgregado ? '#86efac' : '#e5e7eb',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                background: '#dbeafe',
                                                color: '#1e40af',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '600'
                                            }}>
                                                {servicio.codigo}
                                            </span>
                                            <span style={{
                                                fontSize: '13px',
                                                fontWeight: '500',
                                                color: '#1f2937'
                                            }}>
                                                {servicio.descripcion}
                                            </span>
                                        </div>
                                        <div style={{
                                            fontSize: '12px',
                                            color: '#6b7280'
                                        }}>
                                            {servicio.tipoServicio} • Total: ${totales.total.toLocaleString()}
                                        </div>
                                    </div>
                                    
                                    {!yaAgregado ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const servicioConDetalles = {
                                                    ...servicio,
                                                    cantidadServicio: 1,
                                                    totales,
                                                    idTemp: Date.now()
                                                };
                                                onAddService(servicioConDetalles);
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                background: '#22c55e',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Agregar
                                        </button>
                                    ) : (
                                        <span style={{
                                            padding: '6px 12px',
                                            background: '#dcfce7',
                                            color: '#15803d',
                                            borderRadius: '4px',
                                            fontSize: '12px'
                                        }}>
                                            ✓ Agregado
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Servicios seleccionados */}
            {selectedServices.length > 0 && (
                <>
                    <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                        Servicios Agregados al Mantenimiento ({selectedServices.length})
                    </div>
                    
                    <div style={{
                        display: 'grid',
                        gap: '10px',
                        marginBottom: '15px'
                    }}>
                        {selectedServices.map(servicio => (
                            <div key={servicio.idTemp} style={{
                                padding: '12px',
                                background: '#f9fafb',
                                borderRadius: '6px',
                                border: '1px solid #e5e7eb'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'start'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginBottom: '6px'
                                        }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                background: '#dbeafe',
                                                color: '#1e40af',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '600'
                                            }}>
                                                {servicio.codigo}
                                            </span>
                                            <span style={{
                                                padding: '2px 6px',
                                                background: '#dcfce7',
                                                color: '#15803d',
                                                borderRadius: '4px',
                                                fontSize: '11px'
                                            }}>
                                                Cantidad: {servicio.cantidadServicio}
                                            </span>
                                            <span style={{
                                                fontSize: '13px',
                                                fontWeight: '500',
                                                color: '#1f2937'
                                            }}>
                                                {servicio.descripcion}
                                            </span>
                                        </div>
                                        
                                        {/* Detalles del servicio */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                            gap: '8px',
                                            fontSize: '12px',
                                            color: '#6b7280'
                                        }}>
                                            <div>
                                                <span style={{ color: '#9ca3af' }}>Mano de obra:</span>
                                                <div style={{ fontWeight: '500' }}>${servicio.totales.manoObra.toLocaleString()}</div>
                                            </div>
                                            {servicio.totales.repuestosNeto > 0 && (
                                                <>
                                                    <div>
                                                        <span style={{ color: '#9ca3af' }}>Repuestos:</span>
                                                        <div style={{ fontWeight: '500' }}>${servicio.totales.repuestosNeto.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: '#9ca3af' }}>IVA:</span>
                                                        <div style={{ fontWeight: '500' }}>${servicio.totales.iva.toLocaleString()}</div>
                                                    </div>
                                                </>
                                            )}
                                            <div>
                                                <span style={{ color: '#9ca3af' }}>Total:</span>
                                                <div style={{ fontWeight: '600', color: '#059669' }}>
                                                    ${servicio.totales.total.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Lista de repuestos si existen */}
                                        {servicio.repuestos && servicio.repuestos.length > 0 && (
                                            <div style={{
                                                marginTop: '8px',
                                                padding: '8px',
                                                background: 'white',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                color: '#6b7280'
                                            }}>
                                                <strong>Repuestos incluidos:</strong>
                                                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                                    {servicio.repuestos.map((rep, idx) => (
                                                        <li key={idx}>
                                                            {rep.cantidad * servicio.cantidadServicio}x {rep.nombre} - 
                                                            ${(rep.costoUnitario * rep.cantidad * servicio.cantidadServicio).toLocaleString()}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <button
                                        type="button"
                                        onClick={() => onRemoveService(servicio.idTemp)}
                                        style={{
                                            padding: '6px',
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            marginLeft: '10px'
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total de servicios */}
                    <div style={{
                        padding: '15px',
                        background: '#f0fdf4',
                        borderRadius: '8px',
                        border: '1px solid #86efac'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#059669'
                        }}>
                            <span>💰 Total de Servicios del Catálogo:</span>
                            <span>${calcularTotalServicios().toLocaleString()}</span>
                        </div>
                    </div>
                </>
            )}

            {selectedServices.length === 0 && (
                <div style={{
                    padding: '20px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '13px'
                }}>
                    <Package size={32} style={{ color: '#9ca3af', marginBottom: '8px' }} />
                    <div>No hay servicios del catálogo agregados</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        Use el código del servicio para agregarlo rápidamente
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceCatalogSelector;