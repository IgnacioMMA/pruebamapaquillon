// src/components/DashboardTrabajador.js - VERSIÓN MEJORADA CON TODOS LOS DATOS DEL VEHÍCULO
import React, { useState, useEffect } from 'react';
import { database, firestore } from '../config/firebase';
import { ref, onValue } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';

const DashboardTrabajador = ({ currentUser, onLogout, onNavigateToGPS }) => {
  const [vehiculoAsignado, setVehiculoAsignado] = useState(null);
  const [zonasAsignadas, setZonasAsignadas] = useState([]);
  const [estadisticas, setEstadisticas] = useState({
    tareasCompletadas: 0,
    tareasEnProgreso: 0,
    tareasPendientes: 0,
    horasTrabajadas: 0,
    kilometrosRecorridos: 0
  });
  const [historialRecorridos, setHistorialRecorridos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [trabajadorInfo, setTrabajadorInfo] = useState(null);
  const [expandedVehicleInfo, setExpandedVehicleInfo] = useState(false);
  const [historialMantenimiento, setHistorialMantenimiento] = useState([]);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cargar información del trabajador
  useEffect(() => {
    if (currentUser && currentUser.uid) {
      loadWorkerData();
      loadVehicleData();
      loadZonasData();
      loadHistorialData();
    }
  }, [currentUser]);

  // Cargar datos del trabajador
  const loadWorkerData = async () => {
    try {
      // Cargar desde Firestore
      const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setTrabajadorInfo(userData);
      }

      // Cargar desde Realtime Database
      const trabajadorRef = ref(database, `trabajadores/${currentUser.uid}`);
      onValue(trabajadorRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setTrabajadorInfo(prevState => ({
            ...prevState,
            ...data
          }));
        }
      });
    } catch (error) {
      console.error('Error al cargar datos del trabajador:', error);
    }
  };

  // Cargar vehículo asignado con TODOS los detalles
  const loadVehicleData = () => {
    const vehiculosRef = ref(database, 'vehiculos');
    const unsubscribe = onValue(vehiculosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Buscar vehículo asignado al trabajador actual
        const vehiculoAsignado = Object.entries(data).find(
          ([id, vehiculo]) => vehiculo.operadorAsignado === currentUser.uid
        );
        
        if (vehiculoAsignado) {
          const vehiculoCompleto = {
            id: vehiculoAsignado[0],
            ...vehiculoAsignado[1]
          };
          
          setVehiculoAsignado(vehiculoCompleto);
          
          // Cargar historial de mantenimiento si existe
          if (vehiculoCompleto.historialMantenimiento) {
            setHistorialMantenimiento(vehiculoCompleto.historialMantenimiento);
          }
        } else {
          setVehiculoAsignado(null);
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  };

  // Cargar zonas asignadas
  const loadZonasData = () => {
    const zonasRef = ref(database, 'zonas_asignadas');
    const unsubscribe = onValue(zonasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const zonasDelTrabajador = Object.entries(data)
          .filter(([id, zona]) => zona.trabajadorAsignado === currentUser.uid)
          .map(([id, zona]) => ({
            id,
            ...zona
          }))
          .sort((a, b) => {
            if (a.estado === 'en_progreso') return -1;
            if (b.estado === 'en_progreso') return 1;
            if (a.estado === 'pendiente' && b.estado === 'completado') return -1;
            if (a.estado === 'completado' && b.estado === 'pendiente') return 1;
            return 0;
          });
        
        setZonasAsignadas(zonasDelTrabajador);
        
        // Actualizar estadísticas
        setEstadisticas(prev => ({
          ...prev,
          tareasCompletadas: zonasDelTrabajador.filter(z => z.estado === 'completado').length,
          tareasEnProgreso: zonasDelTrabajador.filter(z => z.estado === 'en_progreso').length,
          tareasPendientes: zonasDelTrabajador.filter(z => z.estado === 'pendiente' || !z.estado).length
        }));
      }
    });

    return unsubscribe;
  };

  // Cargar historial de recorridos
  const loadHistorialData = () => {
    const recorridosRef = ref(database, 'recorridos');
    const unsubscribe = onValue(recorridosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const recorridosDelTrabajador = Object.entries(data)
          .filter(([id, recorrido]) => recorrido.trabajadorId === currentUser.uid)
          .map(([id, recorrido]) => ({
            id,
            ...recorrido
          }))
          .sort((a, b) => new Date(b.horaInicio) - new Date(a.horaInicio))
          .slice(0, 10);
        
        setHistorialRecorridos(recorridosDelTrabajador);
        
        // Calcular horas trabajadas del mes
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);
        
        const recorridosDelMes = recorridosDelTrabajador.filter(r => 
          new Date(r.horaInicio) >= inicioMes && r.horaFin
        );
        
        const horasTotales = recorridosDelMes.reduce((total, r) => {
          if (r.horaFin && r.horaInicio) {
            const duracion = new Date(r.horaFin) - new Date(r.horaInicio);
            return total + (duracion / 3600000);
          }
          return total;
        }, 0);
        
        setEstadisticas(prev => ({
          ...prev,
          horasTrabajadas: Math.round(horasTotales * 10) / 10
        }));
      }
    });

    return unsubscribe;
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calcular días hasta próximo mantenimiento
  const getDaysUntilMaintenance = (fechaMantenimiento) => {
    if (!fechaMantenimiento) return null;
    const hoy = new Date();
    const mantenimiento = new Date(fechaMantenimiento);
    const diferencia = mantenimiento - hoy;
    const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    return dias;
  };

  // Calcular duración
  const calculateDuration = (start, end) => {
    if (!start || !end) return 'N/A';
    const diff = new Date(end) - new Date(start);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  // Obtener color según el estado
  const getStatusColor = (estado) => {
    switch (estado) {
      case 'completado': return '#22c55e';
      case 'en_progreso': return '#3b82f6';
      case 'pendiente': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  // Obtener badge de prioridad
  const getPriorityBadge = (prioridad) => {
    const colors = {
      urgente: { bg: '#fee2e2', color: '#dc2626', icon: '🔴' },
      alta: { bg: '#fed7aa', color: '#ea580c', icon: '🟠' },
      normal: { bg: '#fef3c7', color: '#d97706', icon: '🟡' },
      baja: { bg: '#dcfce7', color: '#16a34a', icon: '🟢' }
    };
    
    const style = colors[prioridad] || colors.normal;
    
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '600',
        background: style.bg,
        color: style.color
      }}>
        {style.icon} {prioridad?.toUpperCase() || 'NORMAL'}
      </span>
    );
  };

  const styles = {
    container: {
      width: '100%',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    },
    header: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: isMobile ? '16px' : '24px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    },
    headerContent: {
      maxWidth: '1400px',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
      gap: '16px'
    },
    headerTitle: {
      margin: 0,
      fontSize: isMobile ? '20px' : '28px',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    headerActions: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center'
    },
    mainContent: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: isMobile ? '16px' : '32px'
    },
    welcomeCard: {
      background: 'white',
      borderRadius: '16px',
      padding: isMobile ? '20px' : '32px',
      marginBottom: '24px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      border: '1px solid rgba(0,0,0,0.05)'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '20px',
      marginBottom: '32px'
    },
    statCard: {
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1px solid rgba(0,0,0,0.04)',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden'
    },
    statCardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '12px'
    },
    statIcon: {
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px'
    },
    statValue: {
      fontSize: '32px',
      fontWeight: '700',
      color: '#1f2937',
      marginBottom: '4px'
    },
    statLabel: {
      fontSize: '14px',
      color: '#6b7280',
      fontWeight: '500'
    },
    vehicleCard: {
      background: 'white',
      borderRadius: '16px',
      marginBottom: '24px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden'
    },
    vehicleHeader: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: 'white',
      padding: '24px',
      position: 'relative'
    },
    vehicleContent: {
      padding: '24px'
    },
    vehicleGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
      gap: '20px',
      marginBottom: '20px'
    },
    vehicleInfoItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      background: '#f9fafb',
      borderRadius: '8px',
      transition: 'all 0.2s ease'
    },
    vehicleInfoLabel: {
      fontSize: '13px',
      color: '#6b7280',
      fontWeight: '500',
      minWidth: '120px'
    },
    vehicleInfoValue: {
      fontSize: '15px',
      color: '#1f2937',
      fontWeight: '600',
      flex: 1
    },
    expandButton: {
      width: '100%',
      padding: '12px',
      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      color: '#4b5563',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'all 0.3s ease'
    },
    sectionTabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '24px',
      borderBottom: '2px solid #e5e7eb',
      flexWrap: 'wrap'
    },
    tab: {
      padding: '12px 24px',
      background: 'transparent',
      border: 'none',
      borderBottom: '3px solid transparent',
      color: '#6b7280',
      fontSize: '15px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      position: 'relative'
    },
    tabActive: {
      color: '#667eea',
      borderBottomColor: '#667eea',
      fontWeight: '600'
    },
    card: {
      background: 'white',
      borderRadius: '12px',
      padding: isMobile ? '16px' : '24px',
      marginBottom: '20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1px solid rgba(0,0,0,0.04)'
    },
    emptyState: {
      textAlign: 'center',
      padding: '48px 24px',
      color: '#6b7280'
    },
    button: {
      padding: '12px 24px',
      borderRadius: '8px',
      border: 'none',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px'
    },
    primaryButton: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    },
    secondaryButton: {
      background: 'white',
      color: '#667eea',
      border: '2px solid #667eea'
    },
    dangerButton: {
      background: '#ef4444',
      color: 'white'
    },
    warningBadge: {
      padding: '8px 16px',
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      color: '#92400e',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    },
    successBadge: {
      padding: '8px 16px',
      background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      color: '#166534',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    },
    dangerBadge: {
      padding: '8px 16px',
      background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      color: '#dc2626',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    }
  };

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.headerTitle}>
              👷 Dashboard del Trabajador
            </h1>
            <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
              {new Date().toLocaleDateString('es-CL', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          
          <div style={styles.headerActions}>
            <button
              onClick={onNavigateToGPS}
              style={{
                ...styles.button,
                ...styles.primaryButton,
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)'
              }}
            >
              📍 Ir a GPS
            </button>
            <button
              onClick={onLogout}
              style={{
                ...styles.button,
                ...styles.dangerButton
              }}
            >
              🚪 Salir
            </button>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div style={styles.mainContent}>
        {/* Tarjeta de Bienvenida */}
        <div style={styles.welcomeCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#1f2937' }}>
                ¡Bienvenido, {trabajadorInfo?.name || currentUser.name || 'Trabajador'}! 👋
              </h2>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '16px' }}>
                {trabajadorInfo?.estado === 'trabajando' ? 
                  '🟢 Actualmente trabajando' : 
                  trabajadorInfo?.estado === 'en_camino' ?
                  '🟡 En camino a zona de trabajo' :
                  '⚪ Disponible'}
              </p>
            </div>
            {trabajadorInfo?.zonaDestino && (
              <div style={{
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#92400e'
              }}>
                📍 Zona actual: {trabajadorInfo.zonaDestino}
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN MEJORADA DEL VEHÍCULO ASIGNADO */}
        {vehiculoAsignado ? (
          <div style={styles.vehicleCard}>
            <div style={styles.vehicleHeader}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>
                    {vehiculoAsignado.tipo === 'maquinaria' ? '🏗️' : '🚛'} Vehículo Asignado
                  </h3>
                  <h2 style={{ margin: '0', fontSize: '32px', fontWeight: '700' }}>
                    {vehiculoAsignado.nombre}
                  </h2>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {/* Estado del vehículo */}
                  <div style={{
                    padding: '10px 16px',
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    {vehiculoAsignado.estado === 'disponible' ? '✅ Disponible' :
                     vehiculoAsignado.estado === 'en_uso' ? '🔧 En Uso' :
                     vehiculoAsignado.estado === 'mantenimiento' ? '🔧 En Mantenimiento' : 
                     '❌ Fuera de Servicio'}
                  </div>
                  
                  {/* Indicador de mantenimiento próximo */}
                  {vehiculoAsignado.proximoMantenimiento && (() => {
                    const dias = getDaysUntilMaintenance(vehiculoAsignado.proximoMantenimiento);
                    if (dias !== null && dias <= 30) {
                      return (
                        <div style={{
                          padding: '10px 16px',
                          background: dias <= 7 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          borderRadius: '12px',
                          fontWeight: '600'
                        }}>
                          ⚠️ Mantenimiento en {dias} días
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>

            <div style={styles.vehicleContent}>
              {/* Información Principal del Vehículo */}
              <div style={styles.vehicleGrid}>
                <div style={styles.vehicleInfoItem}>
                  <span style={{ fontSize: '24px' }}>📋</span>
                  <div style={{ flex: 1 }}>
                    <div style={styles.vehicleInfoLabel}>Patente</div>
                    <div style={styles.vehicleInfoValue}>{vehiculoAsignado.patente || 'N/A'}</div>
                  </div>
                </div>

                <div style={styles.vehicleInfoItem}>
                  <span style={{ fontSize: '24px' }}>🏭</span>
                  <div style={{ flex: 1 }}>
                    <div style={styles.vehicleInfoLabel}>Marca/Modelo</div>
                    <div style={styles.vehicleInfoValue}>
                      {vehiculoAsignado.marca} {vehiculoAsignado.modelo}
                    </div>
                  </div>
                </div>

                <div style={styles.vehicleInfoItem}>
                  <span style={{ fontSize: '24px' }}>📏</span>
                  <div style={{ flex: 1 }}>
                    <div style={styles.vehicleInfoLabel}>Kilometraje Actual</div>
                    <div style={styles.vehicleInfoValue}>
                      {vehiculoAsignado.kilometraje?.toLocaleString() || 0} km
                    </div>
                  </div>
                </div>

                <div style={styles.vehicleInfoItem}>
                  <span style={{ fontSize: '24px' }}>⛽</span>
                  <div style={{ flex: 1 }}>
                    <div style={styles.vehicleInfoLabel}>Tipo de Combustible</div>
                    <div style={styles.vehicleInfoValue}>
                      {vehiculoAsignado.tipoCombustible || 'N/A'}
                    </div>
                  </div>
                </div>

                <div style={styles.vehicleInfoItem}>
                  <span style={{ fontSize: '24px' }}>📅</span>
                  <div style={{ flex: 1 }}>
                    <div style={styles.vehicleInfoLabel}>Año</div>
                    <div style={styles.vehicleInfoValue}>
                      {vehiculoAsignado.año || 'N/A'}
                    </div>
                  </div>
                </div>

                <div style={styles.vehicleInfoItem}>
                  <span style={{ fontSize: '24px' }}>🎨</span>
                  <div style={{ flex: 1 }}>
                    <div style={styles.vehicleInfoLabel}>Color</div>
                    <div style={styles.vehicleInfoValue}>
                      {vehiculoAsignado.color || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón para expandir información */}
              <button
                onClick={() => setExpandedVehicleInfo(!expandedVehicleInfo)}
                style={styles.expandButton}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)';
                }}
              >
                {expandedVehicleInfo ? '➖ Ver menos información' : '➕ Ver más información'}
              </button>

              {/* Información Expandida del Vehículo */}
              {expandedVehicleInfo && (
                <div style={{ marginTop: '20px' }}>
                  {/* Información de Mantenimiento */}
                  <div style={{
                    padding: '20px',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    marginBottom: '16px'
                  }}>
                    <h4 style={{ margin: '0 0 16px 0', color: '#1f2937', fontSize: '18px' }}>
                      🔧 Información de Mantenimiento
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Último Mantenimiento
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.ultimoMantenimiento ? 
                            formatDate(vehiculoAsignado.ultimoMantenimiento) : 
                            'Sin registro'}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Próximo Mantenimiento
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.proximoMantenimiento ? 
                            formatDate(vehiculoAsignado.proximoMantenimiento) : 
                            'No programado'}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Km en último mantenimiento
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.kilometrajeUltimoMantenimiento?.toLocaleString() || 'N/A'} km
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Próximo mantenimiento en
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.kilometrajeProximoMantenimiento?.toLocaleString() || 'N/A'} km
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información Técnica Adicional */}
                  <div style={{
                    padding: '20px',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    marginBottom: '16px'
                  }}>
                    <h4 style={{ margin: '0 0 16px 0', color: '#1f2937', fontSize: '18px' }}>
                      📊 Información Técnica
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Número de Motor
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.numeroMotor || 'N/A'}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Número de Chasis
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.numeroChasis || 'N/A'}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Capacidad de Carga
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.capacidadCarga || 'N/A'}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Tipo de Transmisión
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.transmision || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Documentación */}
                  <div style={{
                    padding: '20px',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    marginBottom: '16px'
                  }}>
                    <h4 style={{ margin: '0 0 16px 0', color: '#1f2937', fontSize: '18px' }}>
                      📄 Documentación
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Vencimiento Permiso Circulación
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.vencimientoPermisoCirculacion ? 
                            formatDate(vehiculoAsignado.vencimientoPermisoCirculacion) : 
                            'N/A'}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Vencimiento Revisión Técnica
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.vencimientoRevisionTecnica ? 
                            formatDate(vehiculoAsignado.vencimientoRevisionTecnica) : 
                            'N/A'}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Vencimiento Seguro
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.vencimientoSeguro ? 
                            formatDate(vehiculoAsignado.vencimientoSeguro) : 
                            'N/A'}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Compañía de Seguro
                        </div>
                        <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '600' }}>
                          {vehiculoAsignado.companiaSeguro || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observaciones */}
                  {vehiculoAsignado.observaciones && (
                    <div style={{
                      padding: '20px',
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                      borderRadius: '12px',
                      border: '1px solid #fbbf24'
                    }}>
                      <h4 style={{ margin: '0 0 12px 0', color: '#92400e', fontSize: '16px' }}>
                        📝 Observaciones Importantes
                      </h4>
                      <p style={{ margin: 0, color: '#78350f', fontSize: '14px', lineHeight: '1.6' }}>
                        {vehiculoAsignado.observaciones}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            ...styles.card,
            background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            border: '2px solid #ef4444',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#dc2626' }}>
              No tienes vehículo asignado
            </h3>
            <p style={{ margin: 0, color: '#991b1b', fontSize: '14px' }}>
              Contacta con tu supervisor para la asignación de un vehículo
            </p>
          </div>
        )}

        {/* Estadísticas */}
        <div style={styles.statsGrid}>
          <div 
            style={styles.statCard}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
            }}
          >
            <div style={styles.statCardHeader}>
              <div style={{
                ...styles.statIcon,
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
              }}>
                ✅
              </div>
            </div>
            <div style={styles.statValue}>{estadisticas.tareasCompletadas}</div>
            <div style={styles.statLabel}>Tareas Completadas</div>
          </div>

          <div 
            style={styles.statCard}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
            }}
          >
            <div style={styles.statCardHeader}>
              <div style={{
                ...styles.statIcon,
                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
              }}>
                🔧
              </div>
            </div>
            <div style={styles.statValue}>{estadisticas.tareasEnProgreso}</div>
            <div style={styles.statLabel}>En Progreso</div>
          </div>

          <div 
            style={styles.statCard}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
            }}
          >
            <div style={styles.statCardHeader}>
              <div style={{
                ...styles.statIcon,
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
              }}>
                ⏳
              </div>
            </div>
            <div style={styles.statValue}>{estadisticas.tareasPendientes}</div>
            <div style={styles.statLabel}>Pendientes</div>
          </div>

          <div 
            style={styles.statCard}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
            }}
          >
            <div style={styles.statCardHeader}>
              <div style={{
                ...styles.statIcon,
                background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)'
              }}>
                ⏰
              </div>
            </div>
            <div style={styles.statValue}>{estadisticas.horasTrabajadas}</div>
            <div style={styles.statLabel}>Horas este mes</div>
          </div>
        </div>

        {/* Tabs de navegación */}
        <div style={styles.sectionTabs}>
          <button
            onClick={() => setActiveSection('overview')}
            style={{
              ...styles.tab,
              ...(activeSection === 'overview' ? styles.tabActive : {})
            }}
          >
            📊 Resumen
          </button>
          <button
            onClick={() => setActiveSection('zones')}
            style={{
              ...styles.tab,
              ...(activeSection === 'zones' ? styles.tabActive : {})
            }}
          >
            🏗️ Zonas Asignadas ({zonasAsignadas.length})
          </button>
          <button
            onClick={() => setActiveSection('history')}
            style={{
              ...styles.tab,
              ...(activeSection === 'history' ? styles.tabActive : {})
            }}
          >
            📜 Historial
          </button>
        </div>

        {/* Contenido según tab activo */}
        {activeSection === 'overview' && (
          <div style={styles.card}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1f2937' }}>
              📊 Resumen de Actividad
            </h3>
            
            {historialRecorridos.length > 0 ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{
                  padding: '16px',
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  borderRadius: '12px',
                  border: '1px solid #0ea5e9'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#0369a1', fontSize: '16px' }}>
                    🎯 Último trabajo realizado
                  </h4>
                  <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                    <div>
                      <strong>Zona:</strong> {historialRecorridos[0].zonaNombre || 'N/A'}
                    </div>
                    <div>
                      <strong>Fecha:</strong> {formatDate(historialRecorridos[0].horaInicio)}
                    </div>
                    <div>
                      <strong>Duración:</strong> {calculateDuration(historialRecorridos[0].horaInicio, historialRecorridos[0].horaFin)}
                    </div>
                    <div>
                      <strong>Estado:</strong> 
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: historialRecorridos[0].estado === 'completado' ? '#dcfce7' : '#fef3c7',
                        color: historialRecorridos[0].estado === 'completado' ? '#166534' : '#92400e'
                      }}>
                        {historialRecorridos[0].estado === 'completado' ? '✅ Completado' : '⏳ En proceso'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={styles.emptyState}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                <p>No hay actividad registrada todavía</p>
              </div>
            )}
          </div>
        )}

        {activeSection === 'zones' && (
          <div>
            {zonasAsignadas.length > 0 ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                {zonasAsignadas.map(zona => (
                  <div key={zona.id} style={{
                    ...styles.card,
                    borderLeft: `4px solid ${getStatusColor(zona.estado)}`
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '16px',
                      marginBottom: '16px'
                    }}>
                      <div>
                        <h4 style={{ 
                          margin: '0 0 8px 0', 
                          fontSize: '18px', 
                          color: '#1f2937',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          🏗️ {zona.nombre}
                        </h4>
                        <p style={{ margin: '0 0 4px 0', color: '#6b7280', fontSize: '14px' }}>
                          📍 {zona.direccion || 'Sin dirección especificada'}
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {getPriorityBadge(zona.prioridad)}
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: zona.estado === 'completado' ? '#dcfce7' : 
                                     zona.estado === 'en_progreso' ? '#dbeafe' : '#fef3c7',
                          color: zona.estado === 'completado' ? '#166534' : 
                                 zona.estado === 'en_progreso' ? '#1e40af' : '#92400e'
                        }}>
                          {zona.estado === 'completado' ? '✅ Completado' :
                           zona.estado === 'en_progreso' ? '🔧 En Progreso' : '⏳ Pendiente'}
                        </span>
                      </div>
                    </div>
                    
                    {zona.estado !== 'completado' && (
                      <button
                        onClick={() => onNavigateToGPS()}
                        style={{
                          ...styles.button,
                          ...styles.primaryButton,
                          marginTop: '16px',
                          width: '100%'
                        }}
                      >
                        📍 Ir a esta zona
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                ...styles.card,
                ...styles.emptyState
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏗️</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1f2937' }}>
                  No tienes zonas asignadas
                </h3>
              </div>
            )}
          </div>
        )}

        {activeSection === 'history' && (
          <div>
            {historialRecorridos.length > 0 ? (
              <div style={styles.card}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1f2937' }}>
                  📜 Historial de Recorridos
                </h3>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Zona</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Fecha</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Duración</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialRecorridos.map((recorrido) => (
                        <tr key={recorrido.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px' }}>
                            🏗️ {recorrido.zonaNombre || 'N/A'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {formatDate(recorrido.horaInicio)}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {calculateDuration(recorrido.horaInicio, recorrido.horaFin)}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              background: recorrido.estado === 'completado' ? '#dcfce7' : '#fef3c7',
                              color: recorrido.estado === 'completado' ? '#166534' : '#92400e'
                            }}>
                              {recorrido.estado === 'completado' ? '✅ Completado' : '⏳ En proceso'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{
                ...styles.card,
                ...styles.emptyState
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📜</div>
                <h3>No hay historial disponible</h3>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DashboardTrabajador;