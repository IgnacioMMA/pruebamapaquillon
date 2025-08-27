// ServiceCatalogManager.js - Componente para crear, editar y eliminar servicios del catálogo
import React, { useState, useEffect } from 'react';
import { database } from '../config/firebase';
import { ref as databaseRef, push, update, remove, onValue, off } from 'firebase/database';
import { Package, Plus, Trash2, Edit2, DollarSign, Search } from 'lucide-react';

const ServiceCatalogManager = ({ 
    show, 
    onClose, 
    isMobile,
    currentUser 
}) => {
    const [servicios, setServicios] = useState([]);
    const [filteredServicios, setFilteredServicios] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    // Estado del formulario
    const [formData, setFormData] = useState({
        codigo: '',
        descripcion: '',
        tipoServicio: 'mantenimiento',
        manoObra: 0,
        repuestos: []
    });
    
    const [newRepuesto, setNewRepuesto] = useState({
        nombre: '',
        cantidad: 1,
        costoUnitario: 0
    });

    // Cargar servicios del catálogo
    useEffect(() => {
        if (show) {
            const serviciosRef = databaseRef(database, 'catalogo_servicios');
            const unsubscribe = onValue(serviciosRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const serviciosArray = Object.entries(data).map(([id, servicio]) => ({
                        id,
                        ...servicio
                    }));
                    setServicios(serviciosArray);
                    setFilteredServicios(serviciosArray);
                } else {
                    setServicios([]);
                    setFilteredServicios([]);
                }
            });
            
            return () => off(serviciosRef);
        }
    }, [show]);

    // Filtrar servicios
    useEffect(() => {
        if (searchTerm) {
            const filtered = servicios.filter(servicio =>
                servicio.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                servicio.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                servicio.tipoServicio.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredServicios(filtered);
        } else {
            setFilteredServicios(servicios);
        }
    }, [searchTerm, servicios]);

    // Agregar repuesto al formulario
    const handleAddRepuesto = () => {
        if (!newRepuesto.nombre || newRepuesto.costoUnitario <= 0) {
            setMessage({
                type: 'error',
                text: '❌ Complete todos los campos del repuesto'
            });
            return;
        }

        setFormData(prev => ({
            ...prev,
            repuestos: [...prev.repuestos, { ...newRepuesto }]
        }));

        setNewRepuesto({
            nombre: '',
            cantidad: 1,
            costoUnitario: 0
        });
    };

    // Eliminar repuesto del formulario
    const handleRemoveRepuesto = (index) => {
        setFormData(prev => ({
            ...prev,
            repuestos: prev.repuestos.filter((_, i) => i !== index)
        }));
    };

    // Calcular total del servicio
    const calcularTotalServicio = () => {
        const totalRepuestos = formData.repuestos.reduce((total, rep) => 
            total + (rep.cantidad * rep.costoUnitario), 0);
        const iva = Math.round(totalRepuestos * 0.19);
        const totalConIva = totalRepuestos + iva;
        const total = totalConIva + (formData.manoObra || 0);
        
        return {
            repuestosNeto: totalRepuestos,
            iva,
            totalConIva,
            total
        };
    };

    // Guardar servicio
    const handleSaveServicio = async (e) => {
        e.preventDefault();
        
        if (!formData.codigo || !formData.descripcion) {
            setMessage({
                type: 'error',
                text: '❌ El código y descripción son obligatorios'
            });
            return;
        }

        try {
            const servicioData = {
                codigo: formData.codigo.toUpperCase(),
                descripcion: formData.descripcion,
                tipoServicio: formData.tipoServicio,
                manoObra: parseFloat(formData.manoObra) || 0,
                repuestos: formData.repuestos,
                createdBy: currentUser.uid,
                createdAt: editingId ? undefined : new Date().toISOString(),
                updatedAt: editingId ? new Date().toISOString() : undefined
            };

            if (editingId) {
                // Actualizar servicio existente
                const servicioRef = databaseRef(database, `catalogo_servicios/${editingId}`);
                await update(servicioRef, servicioData);
                setMessage({
                    type: 'success',
                    text: '✅ Servicio actualizado exitosamente'
                });
            } else {
                // Crear nuevo servicio
                const serviciosRef = databaseRef(database, 'catalogo_servicios');
                await push(serviciosRef, servicioData);
                setMessage({
                    type: 'success',
                    text: '✅ Servicio creado exitosamente'
                });
            }

            resetForm();
        } catch (error) {
            console.error('Error al guardar servicio:', error);
            setMessage({
                type: 'error',
                text: '❌ Error al guardar el servicio'
            });
        }
    };

    // Editar servicio
    const handleEditServicio = (servicio) => {
        setFormData({
            codigo: servicio.codigo,
            descripcion: servicio.descripcion,
            tipoServicio: servicio.tipoServicio || 'mantenimiento',
            manoObra: servicio.manoObra || 0,
            repuestos: servicio.repuestos || []
        });
        setEditingId(servicio.id);
        setShowForm(true);
    };

    // Eliminar servicio
    const handleDeleteServicio = async (servicioId) => {
        if (!window.confirm('¿Está seguro de eliminar este servicio del catálogo?')) {
            return;
        }

        try {
            const servicioRef = databaseRef(database, `catalogo_servicios/${servicioId}`);
            await remove(servicioRef);
            setMessage({
                type: 'success',
                text: '✅ Servicio eliminado exitosamente'
            });
        } catch (error) {
            console.error('Error al eliminar servicio:', error);
            setMessage({
                type: 'error',
                text: '❌ Error al eliminar el servicio'
            });
        }
    };

    // Resetear formulario
    const resetForm = () => {
        setFormData({
            codigo: '',
            descripcion: '',
            tipoServicio: 'mantenimiento',
            manoObra: 0,
            repuestos: []
        });
        setNewRepuesto({
            nombre: '',
            cantidad: 1,
            costoUnitario: 0
        });
        setEditingId(null);
        setShowForm(false);
    };

    if (!show) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '12px',
                maxWidth: '1000px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '20px',
                        color: '#1f2937',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Package size={20} />
                        Gestión del Catálogo de Servicios
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 12px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        ✕ Cerrar
                    </button>
                </div>

                {/* Mensajes */}
                {message.text && (
                    <div style={{
                        margin: '20px 20px 0',
                        padding: '12px',
                        borderRadius: '6px',
                        background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                        border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
                        color: message.type === 'success' ? '#166534' : '#991b1b',
                        fontSize: '14px'
                    }}>
                        {message.text}
                    </div>
                )}

                {/* Contenido */}
                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '20px'
                }}>
                    {/* Barra de búsqueda y botón nuevo */}
                    {!showForm && (
                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            marginBottom: '20px'
                        }}>
                            <div style={{
                                flex: 1,
                                position: 'relative'
                            }}>
                                <Search size={18} style={{
                                    position: 'absolute',
                                    left: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#6b7280'
                                }} />
                                <input
                                    type="text"
                                    placeholder="Buscar por código o descripción..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 10px 10px 36px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>
                            <button
                                onClick={() => setShowForm(true)}
                                style={{
                                    padding: '10px 20px',
                                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Plus size={16} />
                                Nuevo Servicio
                            </button>
                        </div>
                    )}

                    {/* Formulario de servicio */}
                    {showForm ? (
                        <form onSubmit={handleSaveServicio}>
                            <div style={{
                                background: '#f9fafb',
                                borderRadius: '8px',
                                padding: '20px'
                            }}>
                                <h3 style={{
                                    margin: '0 0 20px 0',
                                    fontSize: '16px',
                                    color: '#374151'
                                }}>
                                    {editingId ? 'Editar Servicio' : 'Nuevo Servicio'}
                                </h3>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : '150px 1fr 200px',
                                    gap: '15px',
                                    marginBottom: '20px'
                                }}>
                                    <div>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: '6px',
                                            fontSize: '13px',
                                            color: '#374151',
                                            fontWeight: '500'
                                        }}>
                                            Código *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.codigo}
                                            onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                            placeholder="MANT-001"
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: '6px',
                                            fontSize: '13px',
                                            color: '#374151',
                                            fontWeight: '500'
                                        }}>
                                            Descripción *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.descripcion}
                                            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                            placeholder="Mantenimiento preventivo básico"
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: '6px',
                                            fontSize: '13px',
                                            color: '#374151',
                                            fontWeight: '500'
                                        }}>
                                            Tipo de Servicio
                                        </label>
                                        <select
                                            value={formData.tipoServicio}
                                            onChange={(e) => setFormData({ ...formData, tipoServicio: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        >
                                            <option value="mantenimiento">Mantenimiento</option>
                                            <option value="reparacion">Reparación</option>
                                            <option value="inspeccion">Inspección</option>
                                            <option value="diagnostico">Diagnóstico</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '6px',
                                        fontSize: '13px',
                                        color: '#374151',
                                        fontWeight: '500'
                                    }}>
                                        Mano de Obra (CLP)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.manoObra}
                                        onChange={(e) => setFormData({ ...formData, manoObra: parseFloat(e.target.value) || 0 })}
                                        placeholder="0"
                                        style={{
                                            width: isMobile ? '100%' : '200px',
                                            padding: '8px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '4px',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>

                                {/* Sección de repuestos */}
                                <div style={{
                                    marginBottom: '20px',
                                    padding: '15px',
                                    background: 'white',
                                    borderRadius: '6px',
                                    border: '1px solid #e5e7eb'
                                }}>
                                    <h4 style={{
                                        margin: '0 0 15px 0',
                                        fontSize: '14px',
                                        color: '#374151',
                                        fontWeight: '600'
                                    }}>
                                        Repuestos Incluidos
                                    </h4>

                                    <div style={{
                                        display: 'flex',
                                        gap: '10px',
                                        marginBottom: '15px',
                                        flexWrap: isMobile ? 'wrap' : 'nowrap'
                                    }}>
                                        <input
                                            type="text"
                                            placeholder="Nombre del repuesto"
                                            value={newRepuesto.nombre}
                                            onChange={(e) => setNewRepuesto({ ...newRepuesto, nombre: e.target.value })}
                                            style={{
                                                flex: 1,
                                                minWidth: '200px',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '13px'
                                            }}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Cantidad"
                                            value={newRepuesto.cantidad}
                                            onChange={(e) => setNewRepuesto({ ...newRepuesto, cantidad: parseInt(e.target.value) || 1 })}
                                            min="1"
                                            style={{
                                                width: '100px',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '13px'
                                            }}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Costo unitario"
                                            value={newRepuesto.costoUnitario}
                                            onChange={(e) => setNewRepuesto({ ...newRepuesto, costoUnitario: parseFloat(e.target.value) || 0 })}
                                            style={{
                                                width: '150px',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '13px'
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddRepuesto}
                                            style={{
                                                padding: '8px 16px',
                                                background: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '13px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Agregar
                                        </button>
                                    </div>

                                    {formData.repuestos.length > 0 && (
                                        <div style={{
                                            display: 'grid',
                                            gap: '8px'
                                        }}>
                                            {formData.repuestos.map((repuesto, index) => (
                                                <div key={index} style={{
                                                    padding: '8px',
                                                    background: '#f9fafb',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    fontSize: '13px'
                                                }}>
                                                    <span>
                                                        {repuesto.cantidad}x {repuesto.nombre} - 
                                                        ${(repuesto.cantidad * repuesto.costoUnitario).toLocaleString()}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRepuesto(index)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            background: '#ef4444',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Resumen del total */}
                                {(formData.manoObra > 0 || formData.repuestos.length > 0) && (
                                    <div style={{
                                        padding: '15px',
                                        background: '#f0fdf4',
                                        borderRadius: '6px',
                                        marginBottom: '20px'
                                    }}>
                                        <h4 style={{
                                            margin: '0 0 10px 0',
                                            fontSize: '14px',
                                            color: '#15803d',
                                            fontWeight: '600'
                                        }}>
                                            Resumen del Servicio
                                        </h4>
                                        <div style={{
                                            fontSize: '13px',
                                            color: '#374151',
                                            lineHeight: '1.6'
                                        }}>
                                            {(() => {
                                                const totales = calcularTotalServicio();
                                                return (
                                                    <>
                                                        <div>Mano de obra: ${formData.manoObra.toLocaleString()}</div>
                                                        {totales.repuestosNeto > 0 && (
                                                            <>
                                                                <div>Repuestos neto: ${totales.repuestosNeto.toLocaleString()}</div>
                                                                <div>IVA (19%): ${totales.iva.toLocaleString()}</div>
                                                            </>
                                                        )}
                                                        <div style={{
                                                            marginTop: '8px',
                                                            paddingTop: '8px',
                                                            borderTop: '1px solid #86efac',
                                                            fontWeight: '600',
                                                            fontSize: '15px'
                                                        }}>
                                                            Total del servicio: ${totales.total.toLocaleString()}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Botones de acción */}
                                <div style={{
                                    display: 'flex',
                                    gap: '10px',
                                    justifyContent: 'flex-end'
                                }}>
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        style={{
                                            padding: '10px 20px',
                                            background: '#6b7280',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        style={{
                                            padding: '10px 20px',
                                            background: '#22c55e',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        💾 {editingId ? 'Actualizar' : 'Guardar'} Servicio
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        // Lista de servicios
                        <div>
                            {filteredServicios.length === 0 ? (
                                <div style={{
                                    padding: '40px',
                                    textAlign: 'center',
                                    color: '#6b7280'
                                }}>
                                    <Package size={48} style={{ color: '#9ca3af', marginBottom: '10px' }} />
                                    <p style={{ fontSize: '16px' }}>
                                        {searchTerm ? 'No se encontraron servicios' : 'No hay servicios en el catálogo'}
                                    </p>
                                    <p style={{ fontSize: '14px' }}>
                                        {searchTerm ? 'Prueba con otros términos de búsqueda' : 'Crea tu primer servicio usando el botón de arriba'}
                                    </p>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gap: '12px'
                                }}>
                                    {filteredServicios.map(servicio => {
                                        const totales = (() => {
                                            const repuestosNeto = servicio.repuestos?.reduce((total, rep) => 
                                                total + (rep.cantidad * rep.costoUnitario), 0) || 0;
                                            const iva = Math.round(repuestosNeto * 0.19);
                                            const totalConIva = repuestosNeto + iva;
                                            return totalConIva + (servicio.manoObra || 0);
                                        })();

                                        return (
                                            <div key={servicio.id} style={{
                                                padding: '15px',
                                                background: 'white',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        marginBottom: '8px'
                                                    }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            background: '#dbeafe',
                                                            color: '#1e40af',
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                            fontWeight: '600'
                                                        }}>
                                                            {servicio.codigo}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '15px',
                                                            fontWeight: '500',
                                                            color: '#1f2937'
                                                        }}>
                                                            {servicio.descripcion}
                                                        </span>
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            background: '#f3f4f6',
                                                            color: '#6b7280',
                                                            borderRadius: '4px',
                                                            fontSize: '11px'
                                                        }}>
                                                            {servicio.tipoServicio}
                                                        </span>
                                                    </div>
                                                    
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '20px',
                                                        fontSize: '13px',
                                                        color: '#6b7280'
                                                    }}>
                                                        <span>
                                                            <DollarSign size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                                            Total: ${totales.toLocaleString()}
                                                        </span>
                                                        {servicio.repuestos && servicio.repuestos.length > 0 && (
                                                            <span>
                                                                📦 {servicio.repuestos.length} repuesto(s)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        onClick={() => handleEditServicio(servicio)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            background: '#3b82f6',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <Edit2 size={14} />
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteServicio(servicio.id)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            background: '#ef4444',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ServiceCatalogManager;