import React, { useState, useEffect } from 'react';
import { Trash2, Edit, Save, X, Plus, Search, Package, DollarSign, Hash, FileText, AlertCircle, CheckCircle } from 'lucide-react';

// Importar servicios de Firebase (ajusta según tu configuración)
import { database } from '../config/firebase';
import {
  ref as databaseRef,
  push,
  update,
  remove,
  onValue,
  off,
  set
} from 'firebase/database';


const CatalogoServiciosFirebase = ({ currentUser, isMobile }) => {
  // Estados principales
  const [activeTab, setActiveTab] = useState('catalogo');
  const [serviciosCatalogo, setServiciosCatalogo] = useState([]);
  const [presupuestoActual, setPresupuestoActual] = useState({
    cliente: '',
    vehiculo: '',
    fecha: new Date().toISOString().split('T')[0],
    servicios: [],
    observaciones: '',
    descuento: 0,
    total: 0
  });
  
  // Estados para búsqueda y filtros
  const [busqueda, setBusqueda] = useState('');
  const [busquedaCodigo, setBusquedaCodigo] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Estados para formularios
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoServicio, setEditandoServicio] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  
  // Estado para nuevo/editar servicio
  const [formularioServicio, setFormularioServicio] = useState({
    codigo: '',
    tipoServicio: '',
    descripcion: '',
    manoObra: 0,
    repuestos: []
  });
  
  // Estado para nuevo repuesto
  const [nuevoRepuesto, setNuevoRepuesto] = useState({
    nombre: '',
    cantidad: 1,
    costoUnitario: 0
  });

  // Tipos de servicio predefinidos
  const tiposServicio = [
    'Mantenimiento preventivo',
    'Mantenimiento correctivo',
    'Reparación mecánica',
    'Reparación eléctrica',
    'Cambio de neumáticos',
    'Alineación y balanceo',
    'Revisión técnica',
    'Diagnóstico',
    'Servicio de frenos',
    'Sistema de suspensión',
    'Sistema de escape',
    'Aire acondicionado',
    'Otro'
  ];

  // Cargar servicios desde Firebase
  useEffect(() => {
    const serviciosRef = databaseRef(database, 'catalogo_servicios');
    const unsubscribe = onValue(serviciosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const serviciosArray = Object.entries(data).map(([id, servicio]) => ({
          id,
          ...servicio
        }));
        setServiciosCatalogo(serviciosArray);
      } else {
        setServiciosCatalogo([]);
      }
    });

    return () => off(serviciosRef);
  }, []);

  // Guardar servicio en Firebase
  const guardarServicio = async () => {
    if (!formularioServicio.codigo || !formularioServicio.tipoServicio || !formularioServicio.descripcion) {
      setMessage({
        type: 'error',
        text: '❌ Por favor complete todos los campos obligatorios'
      });
      return;
    }

    // Verificar si el código ya existe
    const codigoExiste = serviciosCatalogo.some(s => 
      s.codigo.toUpperCase() === formularioServicio.codigo.toUpperCase() && 
      s.id !== editandoServicio?.id
    );

    if (codigoExiste) {
      setMessage({
        type: 'error',
        text: '❌ Ya existe un servicio con ese código'
      });
      return;
    }

    setLoading(true);

    try {
      const servicioData = {
        ...formularioServicio,
        codigo: formularioServicio.codigo.toUpperCase(),
        fechaCreacion: editandoServicio ? editandoServicio.fechaCreacion : new Date().toISOString(),
        ultimaActualizacion: new Date().toISOString(),
        creadoPor: editandoServicio ? editandoServicio.creadoPor : currentUser?.uid || 'sistema',
        actualizadoPor: currentUser?.uid || 'sistema'
      };

      if (editandoServicio) {
        // Actualizar servicio existente
        const servicioRef = databaseRef(database, `catalogo_servicios/${editandoServicio.id}`);
        await update(servicioRef, servicioData);
        
        setMessage({
          type: 'success',
          text: `✅ Servicio ${formularioServicio.codigo} actualizado exitosamente`
        });
      } else {
        // Crear nuevo servicio
        const serviciosRef = databaseRef(database, 'catalogo_servicios');
        await push(serviciosRef, servicioData);
        
        setMessage({
          type: 'success',
          text: `✅ Servicio ${formularioServicio.codigo} creado exitosamente`
        });
      }

      limpiarFormulario();
      setMostrarFormulario(false);
    } catch (error) {
      console.error('Error al guardar servicio:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al guardar el servicio'
      });
    } finally {
      setLoading(false);
    }
  };

  // Eliminar servicio
  const eliminarServicio = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este servicio del catálogo?')) return;

    setLoading(true);
    try {
      const servicioRef = databaseRef(database, `catalogo_servicios/${id}`);
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
    } finally {
      setLoading(false);
    }
  };

  // Agregar repuesto al formulario
  const agregarRepuesto = () => {
    if (!nuevoRepuesto.nombre || nuevoRepuesto.costoUnitario <= 0) {
      setMessage({
        type: 'error',
        text: '❌ Complete los datos del repuesto'
      });
      return;
    }

    setFormularioServicio(prev => ({
      ...prev,
      repuestos: [...prev.repuestos, { ...nuevoRepuesto }]
    }));

    setNuevoRepuesto({ nombre: '', cantidad: 1, costoUnitario: 0 });
    setMessage({ type: '', text: '' });
  };

  // Eliminar repuesto del formulario
  const eliminarRepuesto = (index) => {
    setFormularioServicio(prev => ({
      ...prev,
      repuestos: prev.repuestos.filter((_, i) => i !== index)
    }));
  };

  // Agregar servicio al presupuesto por código
  const agregarServicioPorCodigo = () => {
    const servicio = serviciosCatalogo.find(s => 
      s.codigo.toLowerCase() === busquedaCodigo.toLowerCase()
    );

    if (!servicio) {
      setMessage({
        type: 'error',
        text: '❌ No se encontró un servicio con ese código'
      });
      return;
    }

    const servicioConCantidad = {
      ...servicio,
      cantidadServicio: cantidad,
      idTemp: Date.now()
    };

    setPresupuestoActual(prev => ({
      ...prev,
      servicios: [...prev.servicios, servicioConCantidad]
    }));

    setBusquedaCodigo('');
    setCantidad(1);
    setMessage({
      type: 'success',
      text: `✅ Servicio ${servicio.codigo} agregado al presupuesto`
    });
  };

  // Eliminar servicio del presupuesto
  const eliminarServicioPresupuesto = (idTemp) => {
    setPresupuestoActual(prev => ({
      ...prev,
      servicios: prev.servicios.filter(s => s.idTemp !== idTemp)
    }));
  };

  // Calcular totales del servicio
  const calcularTotalesServicio = (servicio, cantidadServicio = 1) => {
    const repuestosNeto = servicio.repuestos.reduce((total, rep) => 
      total + (rep.cantidad * rep.costoUnitario * cantidadServicio), 0
    );
    const iva = Math.round(repuestosNeto * 0.19);
    const repuestosConIva = repuestosNeto + iva;
    const manoObra = servicio.manoObra * cantidadServicio;
    const total = repuestosConIva + manoObra;

    return { repuestosNeto, iva, repuestosConIva, manoObra, total };
  };

  // Calcular total del presupuesto
  const calcularTotalPresupuesto = () => {
    const subtotal = presupuestoActual.servicios.reduce((total, servicio) => {
      const totales = calcularTotalesServicio(servicio, servicio.cantidadServicio);
      return total + totales.total;
    }, 0);

    const descuentoMonto = (subtotal * presupuestoActual.descuento) / 100;
    return subtotal - descuentoMonto;
  };

  // Guardar presupuesto en Firebase
  const guardarPresupuesto = async () => {
    if (!presupuestoActual.cliente || presupuestoActual.servicios.length === 0) {
      setMessage({
        type: 'error',
        text: '❌ Debe agregar cliente y al menos un servicio'
      });
      return;
    }

    setLoading(true);
    try {
      const presupuestoData = {
        ...presupuestoActual,
        total: calcularTotalPresupuesto(),
        fechaCreacion: new Date().toISOString(),
        creadoPor: currentUser?.uid || 'sistema',
        estado: 'pendiente'
      };

      const presupuestosRef = databaseRef(database, 'presupuestos');
      const newPresupuestoRef = await push(presupuestosRef, presupuestoData);

      setMessage({
        type: 'success',
        text: `✅ Presupuesto guardado con ID: ${newPresupuestoRef.key}`
      });

      // Limpiar presupuesto actual
      setPresupuestoActual({
        cliente: '',
        vehiculo: '',
        fecha: new Date().toISOString().split('T')[0],
        servicios: [],
        observaciones: '',
        descuento: 0,
        total: 0
      });
    } catch (error) {
      console.error('Error al guardar presupuesto:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al guardar el presupuesto'
      });
    } finally {
      setLoading(false);
    }
  };

  // Limpiar formulario
  const limpiarFormulario = () => {
    setFormularioServicio({
      codigo: '',
      tipoServicio: '',
      descripcion: '',
      manoObra: 0,
      repuestos: []
    });
    setEditandoServicio(null);
  };

  // Filtrar servicios
  const serviciosFiltrados = serviciosCatalogo.filter(servicio => {
    const matchBusqueda = servicio.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
                         servicio.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
                         servicio.tipoServicio.toLowerCase().includes(busqueda.toLowerCase());
    
    const matchTipo = filtroTipo === 'todos' || servicio.tipoServicio === filtroTipo;
    
    return matchBusqueda && matchTipo;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '24px', 
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            color: '#1f2937',
            marginBottom: '8px',
            margin: 0
          }}>
            ⛽ Centro de Suministros - Catálogo de Servicios
          </h1>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Gestione su catálogo de servicios predefinidos y cree presupuestos rápidamente
          </p>
        </div>

        {/* Mensajes */}
        {message.text && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            background: message.type === 'success' ? '#dcfce7' : 
                       message.type === 'error' ? '#fee2e2' : '#dbeafe',
            border: `1px solid ${message.type === 'success' ? '#86efac' : 
                                message.type === 'error' ? '#fecaca' : '#93c5fd'}`,
            color: message.type === 'success' ? '#166534' : 
                   message.type === 'error' ? '#991b1b' : '#1e40af'
          }}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '8px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('catalogo')}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                borderRadius: '8px',
                background: activeTab === 'catalogo' ? '#3b82f6' : 'transparent',
                color: activeTab === 'catalogo' ? 'white' : '#6b7280',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📚 Catálogo de Servicios ({serviciosCatalogo.length})
            </button>
            <button
              onClick={() => setActiveTab('presupuesto')}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                borderRadius: '8px',
                background: activeTab === 'presupuesto' ? '#3b82f6' : 'transparent',
                color: activeTab === 'presupuesto' ? 'white' : '#6b7280',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative'
              }}
            >
              📄 Crear Presupuesto
              {presupuestoActual.servicios.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '8px',
                  right: '12px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {presupuestoActual.servicios.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Contenido según tab activo */}
        {activeTab === 'catalogo' ? (
          <>
            {/* Barra de herramientas */}
            <div style={{ 
              background: 'white', 
              borderRadius: '12px', 
              padding: '20px',
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Buscar por código, tipo o descripción..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    minWidth: '180px'
                  }}
                >
                  <option value="todos">Todos los tipos</option>
                  {tiposServicio.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setMostrarFormulario(true);
                    limpiarFormulario();
                  }}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    background: loading ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Plus size={18} />
                  Nuevo Servicio
                </button>
              </div>

              <div style={{ 
                marginTop: '12px', 
                fontSize: '14px', 
                color: '#6b7280' 
              }}>
                {serviciosFiltrados.length} servicios encontrados
              </div>
            </div>

            {/* Lista de servicios */}
            {serviciosFiltrados.length === 0 ? (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '60px 20px',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <Package size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
                <h3 style={{ color: '#4b5563', marginBottom: '8px' }}>
                  No hay servicios en el catálogo
                </h3>
                <p style={{ color: '#9ca3af' }}>
                  Comience creando su primer servicio predefinido
                </p>
              </div>
            ) : (
              <div style={{ 
                display: 'grid', 
                gap: '16px',
                gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))'
              }}>
                {serviciosFiltrados.map(servicio => {
                  const totales = calcularTotalesServicio(servicio);
                  
                  return (
                    <div key={servicio.id} style={{
                      background: 'white',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      transition: 'all 0.2s',
                      border: '2px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = '#3b82f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}>
                      {/* Header del servicio */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '16px'
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              padding: '4px 8px',
                              background: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              {servicio.codigo}
                            </span>
                            <span style={{
                              padding: '4px 8px',
                              background: '#f3f4f6',
                              color: '#4b5563',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }}>
                              {servicio.tipoServicio}
                            </span>
                          </div>
                          <h3 style={{ 
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#1f2937',
                            marginTop: '8px',
                            marginBottom: '0'
                          }}>
                            {servicio.descripcion}
                          </h3>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setEditandoServicio(servicio);
                              setFormularioServicio(servicio);
                              setMostrarFormulario(true);
                            }}
                            disabled={loading}
                            style={{
                              padding: '8px',
                              background: loading ? '#9ca3af' : '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: loading ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => eliminarServicio(servicio.id)}
                            disabled={loading}
                            style={{
                              padding: '8px',
                              background: loading ? '#9ca3af' : '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: loading ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Detalles del servicio */}
                      <div style={{
                        padding: '12px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}>
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Mano de obra:</strong> ${servicio.manoObra.toLocaleString()}
                        </div>
                        
                        {servicio.repuestos.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <strong>Repuestos:</strong>
                            <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                              {servicio.repuestos.map((rep, idx) => (
                                <li key={idx} style={{ fontSize: '13px', color: '#6b7280' }}>
                                  {rep.cantidad}x {rep.nombre} - ${rep.costoUnitario.toLocaleString()} c/u
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div style={{
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px solid #e5e7eb'
                        }}>
                          <div style={{ 
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: '600',
                            color: '#059669'
                          }}>
                            <span>Total del servicio:</span>
                            <span>${totales.total.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal de formulario */}
            {mostrarFormulario && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px'
              }}>
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  width: '100%',
                  maxWidth: '600px',
                  maxHeight: '90vh',
                  overflow: 'auto'
                }}>
                  {/* Header del modal */}
                  <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                      {editandoServicio ? 'Editar Servicio' : 'Nuevo Servicio'}
                    </h2>
                    <button
                      onClick={() => {
                        setMostrarFormulario(false);
                        limpiarFormulario();
                      }}
                      style={{
                        padding: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6b7280'
                      }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Contenido del formulario */}
                  <div style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ 
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Código del servicio *
                      </label>
                      <input
                        type="text"
                        value={formularioServicio.codigo}
                        onChange={(e) => setFormularioServicio({
                          ...formularioServicio,
                          codigo: e.target.value.toUpperCase()
                        })}
                        placeholder="Ej: MANT-001"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ 
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Tipo de servicio *
                      </label>
                      <select
                        value={formularioServicio.tipoServicio}
                        onChange={(e) => setFormularioServicio({
                          ...formularioServicio,
                          tipoServicio: e.target.value
                        })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      >
                        <option value="">Seleccione un tipo</option>
                        {tiposServicio.map(tipo => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ 
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Descripción del servicio *
                      </label>
                      <textarea
                        value={formularioServicio.descripcion}
                        onChange={(e) => setFormularioServicio({
                          ...formularioServicio,
                          descripcion: e.target.value
                        })}
                        placeholder="Describa el servicio..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ 
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Mano de obra ($) *
                      </label>
                      <input
                        type="number"
                        value={formularioServicio.manoObra}
                        onChange={(e) => setFormularioServicio({
                          ...formularioServicio,
                          manoObra: parseInt(e.target.value) || 0
                        })}
                        min="0"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    {/* Sección de repuestos */}
                    <div style={{ 
                      marginBottom: '16px',
                      padding: '16px',
                      background: '#f9fafb',
                      borderRadius: '8px'
                    }}>
                      <h3 style={{ 
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '12px',
                        marginTop: 0
                      }}>
                        Repuestos
                      </h3>

                      {/* Lista de repuestos */}
                      {formularioServicio.repuestos.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          {formularioServicio.repuestos.map((rep, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px',
                              background: 'white',
                              borderRadius: '6px',
                              marginBottom: '8px'
                            }}>
                              <div style={{ fontSize: '14px' }}>
                                {rep.cantidad}x {rep.nombre} - ${rep.costoUnitario.toLocaleString()}
                              </div>
                              <button
                                type="button"
                                onClick={() => eliminarRepuesto(idx)}
                                style={{
                                  padding: '4px',
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Formulario para agregar repuesto */}
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Nombre del repuesto"
                          value={nuevoRepuesto.nombre}
                          onChange={(e) => setNuevoRepuesto({
                            ...nuevoRepuesto,
                            nombre: e.target.value
                          })}
                          style={{
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        />
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '8px' }}>
                          <input
                            type="number"
                            placeholder="Cantidad"
                            value={nuevoRepuesto.cantidad}
                            onChange={(e) => setNuevoRepuesto({
                              ...nuevoRepuesto,
                              cantidad: parseInt(e.target.value) || 1
                            })}
                            min="1"
                            style={{
                              padding: '8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px'
                            }}
                          />
                          
                          <input
                            type="number"
                            placeholder="Costo unitario"
                            value={nuevoRepuesto.costoUnitario}
                            onChange={(e) => setNuevoRepuesto({
                              ...nuevoRepuesto,
                              costoUnitario: parseInt(e.target.value) || 0
                            })}
                            min="0"
                            style={{
                              padding: '8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px'
                            }}
                          />
                          
                          <button
                            type="button"
                            onClick={agregarRepuesto}
                            style={{
                              padding: '8px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={guardarServicio}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: '12px',
                          background: loading ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {loading ? 'Guardando...' : (editandoServicio ? 'Actualizar Servicio' : 'Crear Servicio')}
                      </button>
                      
                      <button
                        onClick={() => {
                          setMostrarFormulario(false);
                          limpiarFormulario();
                        }}
                        disabled={loading}
                        style={{
                          padding: '12px 24px',
                          background: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          // TAB DE PRESUPUESTO
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '24px'
            }}>
              Crear Nuevo Presupuesto
            </h2>

            {/* Información del presupuesto */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Cliente *
                </label>
                <input
                  type="text"
                  value={presupuestoActual.cliente}
                  onChange={(e) => setPresupuestoActual({
                    ...presupuestoActual,
                    cliente: e.target.value
                  })}
                  placeholder="Nombre del cliente"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Vehículo
                </label>
                <input
                  type="text"
                  value={presupuestoActual.vehiculo}
                  onChange={(e) => setPresupuestoActual({
                    ...presupuestoActual,
                    vehiculo: e.target.value
                  })}
                  placeholder="Marca, modelo, patente"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            {/* Agregar servicios por código */}
            <div style={{
              padding: '16px',
              background: '#f0f9ff',
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#0c4a6e',
                marginBottom: '12px',
                marginTop: 0
              }}>
                Agregar Servicio por Código
              </h3>
              
              <div style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <input
                  type="text"
                  placeholder="Código del servicio"
                  value={busquedaCodigo}
                  onChange={(e) => setBusquedaCodigo(e.target.value.toUpperCase())}
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
                  onClick={agregarServicioPorCodigo}
                  style={{
                    padding: '8px 20px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Agregar
                </button>
              </div>

              {/* Lista de códigos disponibles */}
              <div style={{
                marginTop: '12px',
                fontSize: '12px',
                color: '#64748b'
              }}>
                Códigos disponibles: {serviciosCatalogo.map(s => s.codigo).join(', ')}
              </div>
            </div>

            {/* Lista de servicios agregados */}
            {presupuestoActual.servicios.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  Servicios del Presupuesto
                </h3>

                {presupuestoActual.servicios.map((servicio, index) => {
                  const totales = calcularTotalesServicio(servicio, servicio.cantidadServicio);
                  
                  return (
                    <div key={servicio.idTemp} style={{
                      padding: '16px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '12px'
                      }}>
                        <div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px'
                          }}>
                            <span style={{
                              padding: '2px 6px',
                              background: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              {servicio.codigo}
                            </span>
                            <span style={{
                              padding: '2px 6px',
                              background: '#dcfce7',
                              color: '#15803d',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              Cantidad: {servicio.cantidadServicio}
                            </span>
                          </div>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1f2937',
                            margin: 0
                          }}>
                            {servicio.descripcion}
                          </h4>
                        </div>
                        
                        <button
                          onClick={() => eliminarServicioPresupuesto(servicio.idTemp)}
                          style={{
                            padding: '6px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: '8px',
                        fontSize: '13px'
                      }}>
                        <div>
                          <span style={{ color: '#6b7280' }}>Mano de obra:</span>
                          <div style={{ fontWeight: '600' }}>${totales.manoObra.toLocaleString()}</div>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Repuestos:</span>
                          <div style={{ fontWeight: '600' }}>${totales.repuestosNeto.toLocaleString()}</div>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>IVA:</span>
                          <div style={{ fontWeight: '600' }}>${totales.iva.toLocaleString()}</div>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Total:</span>
                          <div style={{ fontWeight: '600', color: '#059669' }}>
                            ${totales.total.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Observaciones y descuento */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Observaciones
                </label>
                <textarea
                  value={presupuestoActual.observaciones}
                  onChange={(e) => setPresupuestoActual({
                    ...presupuestoActual,
                    observaciones: e.target.value
                  })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Descuento (%)
                </label>
                <input
                  type="number"
                  value={presupuestoActual.descuento}
                  onChange={(e) => setPresupuestoActual({
                    ...presupuestoActual,
                    descuento: parseFloat(e.target.value) || 0
                  })}
                  min="0"
                  max="100"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            {/* Total del presupuesto */}
            {presupuestoActual.servicios.length > 0 && (
              <div style={{
                padding: '16px',
                background: '#f0fdf4',
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#059669'
                }}>
                  <span>Total del Presupuesto:</span>
                  <span>${calcularTotalPresupuesto().toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={guardarPresupuesto}
                disabled={loading || presupuestoActual.servicios.length === 0}
                style={{
                  padding: '12px 24px',
                  background: loading || presupuestoActual.servicios.length === 0 ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading || presupuestoActual.servicios.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Guardando...' : 'Guardar Presupuesto'}
              </button>

              <button
                onClick={() => {
                  if (window.confirm('¿Está seguro de limpiar el presupuesto actual?')) {
                    setPresupuestoActual({
                      cliente: '',
                      vehiculo: '',
                      fecha: new Date().toISOString().split('T')[0],
                      servicios: [],
                      observaciones: '',
                      descuento: 0,
                      total: 0
                    });
                  }
                }}
                style={{
                  padding: '12px 24px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Limpiar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogoServiciosFirebase;