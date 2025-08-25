// src/components/MonitorPanel.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { database, firestore } from '../config/firebase';
import { 
  ref as databaseRef, 
  onValue, 
  off 
} from 'firebase/database';
import { collection, getDocs } from 'firebase/firestore';

const MonitorPanel = ({ currentUser, onLogout }) => {
  // Estados principales
  const [vehiculos, setVehiculos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [tiposVehiculo, setTiposVehiculo] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPartial, setLoadingPartial] = useState({
    vehiculos: false,
    usuarios: false,
    solicitudes: false,
    zonas: false
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth <= 1024);
  const [refreshTime, setRefreshTime] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Referencias para cancelar suscripciones
  const unsubscribesRef = useRef({});

  // Detectar tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth <= 1024);
      // Cerrar sidebar en móvil cuando se cambia de tamaño
      if (window.innerWidth > 768) {
        setIsSidebarOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-refresh con AJAX
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      setRefreshTime(new Date());
      // Actualizar solo los datos necesarios según la pestaña activa
      refreshDataByTab(activeTab);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, activeTab]);

  // Cargar datos iniciales
  useEffect(() => {
    loadAllData();
    return () => {
      // Limpiar todas las suscripciones
      Object.values(unsubscribesRef.current).forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });
    };
  }, []);

  // Función para refrescar datos según la pestaña activa (AJAX)
  const refreshDataByTab = async (tab) => {
    switch(tab) {
      case 'dashboard':
        // En dashboard actualizamos todo pero sin loading global
        await Promise.all([
          loadVehiculosAJAX(),
          loadUsuariosAJAX(),
          loadSolicitudesAJAX()
        ]);
        break;
      case 'vehiculos':
        await loadVehiculosAJAX();
        break;
      case 'usuarios':
        await loadUsuariosAJAX();
        break;
      case 'alertas':
        await Promise.all([
          loadVehiculosAJAX(),
          loadSolicitudesAJAX()
        ]);
        break;
      default:
        break;
    }
  };

  // Cargar todos los datos inicialmente
  const loadAllData = async () => {
    setLoading(true);
    
    try {
      // Iniciar todas las suscripciones en paralelo
      const promises = [
        loadVehiculos(),
        loadTiposVehiculo(),
        loadSolicitudes(),
        loadZonas(),
        loadUsuarios()
      ];
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Funciones de carga con AJAX (sin loading global)
  const loadVehiculosAJAX = async () => {
    setLoadingPartial(prev => ({ ...prev, vehiculos: true }));
    
    const vehiculosRef = databaseRef(database, 'vehiculos');
    return new Promise((resolve) => {
      onValue(vehiculosRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const vehiculosArray = Object.entries(data).map(([id, vehiculo]) => ({
            id,
            ...vehiculo
          }));
          setVehiculos(vehiculosArray);
        }
        setLoadingPartial(prev => ({ ...prev, vehiculos: false }));
        resolve();
      }, { onlyOnce: true });
    });
  };

  const loadUsuariosAJAX = async () => {
    setLoadingPartial(prev => ({ ...prev, usuarios: true }));
    
    try {
      const usersSnapshot = await getDocs(collection(firestore, 'users'));
      const usersList = [];
      usersSnapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      setUsuarios(usersList);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      setLoadingPartial(prev => ({ ...prev, usuarios: false }));
    }
  };

  const loadSolicitudesAJAX = async () => {
    setLoadingPartial(prev => ({ ...prev, solicitudes: true }));
    
    const solicitudesRef = databaseRef(database, 'solicitudes_maquinaria');
    return new Promise((resolve) => {
      onValue(solicitudesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const solicitudesArray = Object.entries(data)
            .map(([id, sol]) => ({ id, ...sol }))
            .sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));
          setSolicitudes(solicitudesArray);
        }
        setLoadingPartial(prev => ({ ...prev, solicitudes: false }));
        resolve();
      }, { onlyOnce: true });
    });
  };

  // Funciones de carga con suscripción en tiempo real
  const loadVehiculos = useCallback(() => {
    const vehiculosRef = databaseRef(database, 'vehiculos');
    const unsubscribe = onValue(vehiculosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const vehiculosArray = Object.entries(data).map(([id, vehiculo]) => ({
          id,
          ...vehiculo
        }));
        setVehiculos(vehiculosArray);
      } else {
        setVehiculos([]);
      }
    });
    
    unsubscribesRef.current.vehiculos = () => off(vehiculosRef);
    return unsubscribe;
  }, []);

  const loadTiposVehiculo = useCallback(() => {
    const tiposRef = databaseRef(database, 'tipos_vehiculo');
    const unsubscribe = onValue(tiposRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tiposArray = Object.entries(data).map(([id, tipo]) => ({
          id,
          ...tipo
        }));
        setTiposVehiculo(tiposArray);
      }
    });
    
    unsubscribesRef.current.tipos = () => off(tiposRef);
    return unsubscribe;
  }, []);

  const loadSolicitudes = useCallback(() => {
    const solicitudesRef = databaseRef(database, 'solicitudes_maquinaria');
    const unsubscribe = onValue(solicitudesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const solicitudesArray = Object.entries(data)
          .map(([id, sol]) => ({ id, ...sol }))
          .sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));
        setSolicitudes(solicitudesArray);
      }
    });
    
    unsubscribesRef.current.solicitudes = () => off(solicitudesRef);
    return unsubscribe;
  }, []);

  const loadZonas = useCallback(() => {
    const zonasRef = databaseRef(database, 'zones');
    const unsubscribe = onValue(zonasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const zonasArray = Object.entries(data).map(([id, zona]) => ({
          id,
          ...zona
        }));
        setZonas(zonasArray);
      }
    });
    
    unsubscribesRef.current.zonas = () => off(zonasRef);
    return unsubscribe;
  }, []);

  const loadUsuarios = async () => {
    try {
      const usersSnapshot = await getDocs(collection(firestore, 'users'));
      const usersList = [];
      usersSnapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      setUsuarios(usersList);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  // Funciones de estadísticas
  const getVehicleStats = () => {
    return {
      total: vehiculos.length,
      disponibles: vehiculos.filter(v => v.estado === 'disponible').length,
      enUso: vehiculos.filter(v => v.estado === 'en_uso').length,
      mantenimiento: vehiculos.filter(v => v.estado === 'mantenimiento').length,
      fueraServicio: vehiculos.filter(v => v.estado === 'fuera_servicio').length
    };
  };

  const getUserStats = () => {
    return {
      total: usuarios.length,
      superadmins: usuarios.filter(u => u.role === 'superadmin').length,
      admins: usuarios.filter(u => u.role === 'admin').length,
      trabajadores: usuarios.filter(u => u.role === 'trabajador').length,
      monitores: usuarios.filter(u => u.role === 'monitor').length,
      juntaVecinos: usuarios.filter(u => u.role === 'junta_vecinos').length,
      activos: usuarios.filter(u => u.active !== false).length
    };
  };

  const getSolicitudesStats = () => {
    return {
      total: solicitudes.length,
      pendientes: solicitudes.filter(s => s.estado === 'pendiente').length,
      aprobadas: solicitudes.filter(s => s.estado === 'aprobada').length,
      rechazadas: solicitudes.filter(s => s.estado === 'rechazada').length,
      completadas: solicitudes.filter(s => s.estado === 'completada').length
    };
  };

  // Filtrar vehículos
  const filteredVehiculos = vehiculos.filter(vehiculo => {
    const matchesSearch = vehiculo.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          vehiculo.patente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          vehiculo.marca?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'todos' || vehiculo.estado === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  // Verificar vehículos que necesitan mantenimiento
  const getVehiculosNecesitanMantenimiento = () => {
    const hoy = new Date();
    return vehiculos.filter(v => {
      if (v.proximoMantenimiento) {
        const fechaMantenimiento = new Date(v.proximoMantenimiento);
        const diasRestantes = Math.ceil((fechaMantenimiento - hoy) / (1000 * 60 * 60 * 24));
        return diasRestantes <= 7 && diasRestantes >= 0;
      }
      return false;
    });
  };

  // Verificar documentos próximos a vencer
  const getDocumentosProximosVencer = () => {
    const hoy = new Date();
    const alertas = [];
    
    vehiculos.forEach(vehiculo => {
      // Revisar revisión técnica
      if (vehiculo.fechaRevisionTecnica) {
        const fecha = new Date(vehiculo.fechaRevisionTecnica);
        const diasRestantes = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
        if (diasRestantes <= 30 && diasRestantes >= 0) {
          alertas.push({
            vehiculo: vehiculo.nombre,
            documento: 'Revisión Técnica',
            vencimiento: vehiculo.fechaRevisionTecnica,
            dias: diasRestantes
          });
        }
      }
      
      // Revisar permiso de circulación
      if (vehiculo.fechaPermisoCirculacion) {
        const fecha = new Date(vehiculo.fechaPermisoCirculacion);
        const diasRestantes = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
        if (diasRestantes <= 30 && diasRestantes >= 0) {
          alertas.push({
            vehiculo: vehiculo.nombre,
            documento: 'Permiso de Circulación',
            vencimiento: vehiculo.fechaPermisoCirculacion,
            dias: diasRestantes
          });
        }
      }
      
      // Revisar seguro
      if (vehiculo.fechaSeguro) {
        const fecha = new Date(vehiculo.fechaSeguro);
        const diasRestantes = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
        if (diasRestantes <= 30 && diasRestantes >= 0) {
          alertas.push({
            vehiculo: vehiculo.nombre,
            documento: 'Seguro',
            vencimiento: vehiculo.fechaSeguro,
            dias: diasRestantes
          });
        }
      }
    });
    
    return alertas.sort((a, b) => a.dias - b.dias);
  };

  // Componente de Card Responsivo
  const StatCard = ({ icon, label, value, detail, color, bgColor, loading = false }) => (
    <div style={{
      background: 'white',
      padding: isMobile ? '15px' : '20px',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
          animation: 'slideLoading 1.5s infinite'
        }}></div>
      )}
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: isMobile ? '10px' : '15px'
      }}>
        <span style={{ fontSize: isMobile ? '20px' : '24px' }}>{icon}</span>
        <span style={{
          fontSize: '12px',
          padding: '4px 8px',
          background: bgColor,
          color: color,
          borderRadius: '4px'
        }}>
          {label}
        </span>
      </div>
      
      <div style={{ 
        fontSize: isMobile ? '24px' : '32px', 
        fontWeight: 'bold', 
        color: '#1f2937' 
      }}>
        {value}
      </div>
      
      {detail && (
        <div style={{ 
          fontSize: isMobile ? '12px' : '14px', 
          color: '#6b7280', 
          marginTop: '5px' 
        }}>
          {detail}
        </div>
      )}
    </div>
  );

  // Modal Responsivo de Vehículo
  const VehicleDetailsModal = ({ vehicle, onClose }) => {
    if (!vehicle) return null;

    const tipo = tiposVehiculo.find(t => t.id === vehicle.tipo);
    const operador = usuarios.find(u => u.id === vehicle.operadorAsignado);

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: isMobile ? 'flex-end' : 'center',
        zIndex: 1000,
        padding: isMobile ? '0' : '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: isMobile ? '20px 20px 0 0' : '12px',
          maxWidth: isMobile ? '100%' : '800px',
          width: '100%',
          maxHeight: isMobile ? '85vh' : '90vh',
          overflow: 'auto',
          padding: isMobile ? '20px' : '30px',
          animation: isMobile ? 'slideUp 0.3s ease-out' : 'fadeIn 0.2s ease-out'
        }}>
          {/* Header con gesto de arrastre en móvil */}
          {isMobile && (
            <div style={{
              width: '40px',
              height: '4px',
              background: '#d1d5db',
              borderRadius: '2px',
              margin: '0 auto 15px'
            }}></div>
          )}
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            position: 'sticky',
            top: isMobile ? '-20px' : '0',
            background: 'white',
            paddingBottom: '10px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h2 style={{ 
              margin: 0, 
              color: '#1f2937', 
              fontSize: isMobile ? '20px' : '24px' 
            }}>
              🚛 Detalles del Vehículo
            </h2>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ✖
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : 'repeat(2, 1fr)',
            gap: isMobile ? '15px' : '20px'
          }}>
            {/* Información General */}
            <div style={{
              padding: isMobile ? '15px' : '20px',
              background: '#f9fafb',
              borderRadius: '8px'
            }}>
              <h3 style={{ 
                margin: '0 0 15px 0', 
                color: '#374151', 
                fontSize: isMobile ? '14px' : '16px' 
              }}>
                📋 Información General
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: isMobile ? '13px' : '14px' }}>
                  <strong>Nombre:</strong> {vehicle.nombre}
                </div>
                <div style={{ fontSize: isMobile ? '13px' : '14px' }}>
                  <strong>Tipo:</strong> {tipo ? `${tipo.icon} ${tipo.nombre}` : vehicle.tipo}
                </div>
                <div style={{ fontSize: isMobile ? '13px' : '14px' }}>
                  <strong>Marca/Modelo:</strong> {vehicle.marca} {vehicle.modelo}
                </div>
                <div style={{ fontSize: isMobile ? '13px' : '14px' }}>
                  <strong>Año:</strong> {vehicle.año}
                </div>
                <div style={{ fontSize: isMobile ? '13px' : '14px' }}>
                  <strong>Patente:</strong> {vehicle.patente}
                </div>
                <div style={{ fontSize: isMobile ? '13px' : '14px' }}>
                  <strong>Estado:</strong>{' '}
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: vehicle.estado === 'disponible' ? '#dcfce7' :
                               vehicle.estado === 'en_uso' ? '#dbeafe' :
                               vehicle.estado === 'mantenimiento' ? '#fef3c7' : '#fee2e2',
                    color: vehicle.estado === 'disponible' ? '#15803d' :
                           vehicle.estado === 'en_uso' ? '#1e40af' :
                           vehicle.estado === 'mantenimiento' ? '#92400e' : '#991b1b'
                  }}>
                    {vehicle.estado === 'disponible' ? '✅ Disponible' :
                     vehicle.estado === 'en_uso' ? '🔧 En Uso' :
                     vehicle.estado === 'mantenimiento' ? '🔧 Mantenimiento' : '❌ Fuera de Servicio'}
                  </span>
                </div>
                {operador && (
                  <div style={{ fontSize: isMobile ? '13px' : '14px' }}>
                    <strong>Operador Asignado:</strong> {operador.name}
                  </div>
                )}
              </div>
            </div>

            {/* Resto de las secciones... */}
            {/* Las demás secciones siguen el mismo patrón responsivo */}
          </div>
        </div>
      </div>
    );
  };

  // Sidebar para móvil
  const MobileSidebar = () => (
    <>
      {/* Overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 998,
            animation: 'fadeIn 0.3s ease-out'
          }}
        />
      )}
      
      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: isSidebarOpen ? 0 : '-280px',
        width: '280px',
        height: '100vh',
        background: 'white',
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        zIndex: 999,
        transition: 'left 0.3s ease-out',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header del Sidebar */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1f2937' }}>
            📊 Menú
          </h3>
          <button
            onClick={() => setIsSidebarOpen(false)}
            style={{
              padding: '5px',
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ✕
          </button>
        </div>
        
        {/* Opciones del menú */}
        <div style={{ flex: 1, padding: '10px' }}>
          {['dashboard', 'vehiculos', 'usuarios', 'alertas'].map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setIsSidebarOpen(false);
              }}
              style={{
                width: '100%',
                padding: '15px',
                background: activeTab === tab ? '#eff6ff' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: activeTab === tab ? '#3b82f6' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                textAlign: 'left',
                cursor: 'pointer',
                marginBottom: '5px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              {tab === 'dashboard' && '📊'}
              {tab === 'vehiculos' && '🚛'}
              {tab === 'usuarios' && '👥'}
              {tab === 'alertas' && '🔔'}
              <span>
                {tab === 'dashboard' && 'Dashboard'}
                {tab === 'vehiculos' && 'Vehículos'}
                {tab === 'usuarios' && 'Usuarios'}
                {tab === 'alertas' && 'Alertas'}
              </span>
            </button>
          ))}
        </div>
        
        {/* Footer del Sidebar */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{
            padding: '10px',
            background: '#f3f4f6',
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>
              Auto-refresh
            </div>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '5px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              <option value={10000}>10 segundos</option>
              <option value={30000}>30 segundos</option>
              <option value={60000}>1 minuto</option>
              <option value={300000}>5 minutos</option>
            </select>
          </div>
          
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '12px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>
    </>
  );

  // Loading Screen
  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f3f4f6'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ marginTop: '20px', color: '#6b7280' }}>Cargando datos...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideLoading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Sidebar Móvil */}
      {isMobile && <MobileSidebar />}
      
      {/* Header Responsivo */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: isMobile ? '15px' : '20px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: isMobile ? '10px' : '20px'
        }}>
          {/* Menú hamburguesa para móvil */}
          {isMobile && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              style={{
                padding: '8px',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '20px'
              }}
            >
              ☰
            </button>
          )}
          
          <div style={{ flex: 1 }}>
            <h1 style={{
              margin: 0,
              fontSize: isMobile ? '20px' : '28px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              📊 {isMobile ? 'Monitor' : 'Panel de Monitoreo'}
            </h1>
            {!isMobile && (
              <p style={{
                margin: '5px 0 0 0',
                color: '#6b7280',
                fontSize: '14px'
              }}>
                Sistema de Gestión Municipal - Vista de Solo Lectura
              </p>
            )}
          </div>

          {/* Controles de actualización */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '10px' : '15px'
          }}>
            {/* Indicador de actualización */}
            <div style={{
              padding: isMobile ? '6px 10px' : '8px 12px',
              background: autoRefresh ? '#dcfce7' : '#f3f4f6',
              borderRadius: '8px',
              fontSize: '12px',
              color: autoRefresh ? '#15803d' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              {autoRefresh && (
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#22c55e',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite'
                }}></div>
              )}
              {isMobile ? (
                <span>🕐 {refreshTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
              ) : (
                <span>Actualizado: {refreshTime.toLocaleTimeString('es-CL')}</span>
              )}
            </div>

            {/* Toggle auto-refresh (solo desktop) */}
            {!isMobile && (
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{
                  padding: '8px 12px',
                  background: autoRefresh ? '#3b82f6' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {autoRefresh ? '⏸️ Pausar' : '▶️ Reanudar'}
              </button>
            )}

            {/* Info del usuario (solo desktop) */}
            {!isMobile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                background: '#f9fafb',
                borderRadius: '8px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: '#e5e7eb',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  👤
                </div>
                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#1f2937'
                  }}>
                    {currentUser.name || 'Monitor'}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    {currentUser.email}
                  </div>
                </div>
              </div>
            )}

            {/* Botón logout (solo desktop) */}
            {!isMobile && (
              <button
                onClick={onLogout}
                style={{
                  padding: '10px 20px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                🚪 Cerrar Sesión
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs de navegación (solo desktop) */}
      {!isMobile && (
        <div style={{
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 20px',
          position: 'sticky',
          top: '73px',
          zIndex: 99
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            gap: '20px',
            overflowX: 'auto'
          }}>
            {['dashboard', 'vehiculos', 'usuarios', 'alertas'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '15px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '3px solid #3b82f6' : '3px solid transparent',
                  color: activeTab === tab ? '#3b82f6' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {tab === 'dashboard' && '📊 Dashboard'}
                {tab === 'vehiculos' && '🚛 Vehículos'}
                {tab === 'usuarios' && '👥 Usuarios'}
                {tab === 'alertas' && '🔔 Alertas'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs para móvil (chips horizontales) */}
      {isMobile && (
        <div style={{
          background: 'white',
          padding: '10px',
          borderBottom: '1px solid #e5e7eb',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          <div style={{
            display: 'flex',
            gap: '10px',
            minWidth: 'max-content'
          }}>
            {['dashboard', 'vehiculos', 'usuarios', 'alertas'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 16px',
                  background: activeTab === tab ? '#3b82f6' : '#f3f4f6',
                  color: activeTab === tab ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {tab === 'dashboard' && '📊 Dashboard'}
                {tab === 'vehiculos' && '🚛 Vehículos'}
                {tab === 'usuarios' && '👥 Usuarios'}
                {tab === 'alertas' && '🔔 Alertas'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: isMobile ? '15px' : '20px'
      }}>
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Estadísticas principales con indicador de carga AJAX */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 
                                   isTablet ? 'repeat(2, 1fr)' : 
                                   'repeat(4, 1fr)',
              gap: isMobile ? '10px' : '20px',
              marginBottom: '30px'
            }}>
              {/* Estadísticas de Vehículos */}
              <StatCard
                icon="🚛"
                label="Vehículos"
                value={getVehicleStats().total}
                detail="Total de Vehículos"
                color="#1e40af"
                bgColor="#dbeafe"
                loading={loadingPartial.vehiculos}
              />

              {/* Estadísticas de Usuarios */}
              <StatCard
                icon="👥"
                label="Usuarios"
                value={getUserStats().total}
                detail="Total de Usuarios"
                color="#15803d"
                bgColor="#dcfce7"
                loading={loadingPartial.usuarios}
              />

              {/* Estadísticas de Solicitudes */}
              <StatCard
                icon="📋"
                label="Solicitudes"
                value={getSolicitudesStats().total}
                detail={`${getSolicitudesStats().pendientes} Pendientes`}
                color="#92400e"
                bgColor="#fef3c7"
                loading={loadingPartial.solicitudes}
              />

              {/* Zonas Activas */}
              <StatCard
                icon="🗺️"
                label="Zonas"
                value={zonas.filter(z => z.estado === 'activa').length}
                detail="Zonas Activas"
                color="#6b21a8"
                bgColor="#ede9fe"
                loading={loadingPartial.zonas}
              />
            </div>

            {/* Gráficos y tendencias responsivos */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: isMobile ? '15px' : '20px'
            }}>
              {/* Distribución de vehículos */}
              <div style={{
                background: 'white',
                padding: isMobile ? '15px' : '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                position: 'relative'
              }}>
                {loadingPartial.vehiculos && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
                    animation: 'slideLoading 1.5s infinite',
                    borderRadius: '12px 12px 0 0'
                  }}></div>
                )}
                
                <h3 style={{ 
                  margin: '0 0 20px 0', 
                  fontSize: isMobile ? '16px' : '18px', 
                  color: '#1f2937' 
                }}>
                  Distribución de Vehículos
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['disponibles', 'enUso', 'mantenimiento', 'fueraServicio'].map(estado => {
                    const stats = getVehicleStats();
                    const porcentaje = stats.total > 0 ? (stats[estado] / stats.total * 100).toFixed(1) : 0;
                    
                    return (
                      <div key={estado}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '5px',
                          fontSize: isMobile ? '12px' : '14px'
                        }}>
                          <span style={{ color: '#374151' }}>
                            {estado === 'disponibles' && '✅ Disponibles'}
                            {estado === 'enUso' && '🔧 En Uso'}
                            {estado === 'mantenimiento' && '🔧 Mantenimiento'}
                            {estado === 'fueraServicio' && '❌ Fuera de Servicio'}
                          </span>
                          <span style={{ fontWeight: '600' }}>
                            {stats[estado]} ({porcentaje}%)
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '20px',
                          background: '#f3f4f6',
                          borderRadius: '10px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${porcentaje}%`,
                            height: '100%',
                            background: estado === 'disponibles' ? '#22c55e' :
                                       estado === 'enUso' ? '#3b82f6' :
                                       estado === 'mantenimiento' ? '#f59e0b' : '#ef4444',
                            transition: 'width 0.5s ease'
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actividad reciente */}
              <div style={{
                background: 'white',
                padding: isMobile ? '15px' : '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                position: 'relative'
              }}>
                {loadingPartial.solicitudes && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
                    animation: 'slideLoading 1.5s infinite',
                    borderRadius: '12px 12px 0 0'
                  }}></div>
                )}
                
                <h3 style={{ 
                  margin: '0 0 20px 0', 
                  fontSize: isMobile ? '16px' : '18px', 
                  color: '#1f2937' 
                }}>
                  Actividad Reciente
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {solicitudes.slice(0, 5).map(solicitud => (
                    <div key={solicitud.id} style={{
                      padding: isMobile ? '10px' : '12px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${
                        solicitud.estado === 'pendiente' ? '#f59e0b' :
                        solicitud.estado === 'aprobada' ? '#22c55e' :
                        solicitud.estado === 'rechazada' ? '#ef4444' : '#6b7280'
                      }`
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '5px',
                        gap: '10px'
                      }}>
                        <span style={{
                          fontSize: isMobile ? '13px' : '14px',
                          fontWeight: '500',
                          color: '#1f2937',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {solicitud.asunto}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: solicitud.estado === 'pendiente' ? '#fef3c7' :
                                     solicitud.estado === 'aprobada' ? '#dcfce7' :
                                     solicitud.estado === 'rechazada' ? '#fee2e2' : '#f3f4f6',
                          color: solicitud.estado === 'pendiente' ? '#92400e' :
                                 solicitud.estado === 'aprobada' ? '#15803d' :
                                 solicitud.estado === 'rechazada' ? '#991b1b' : '#6b7280',
                          flexShrink: 0
                        }}>
                          {solicitud.estado}
                        </span>
                      </div>
                      <div style={{ 
                        fontSize: isMobile ? '11px' : '12px', 
                        color: '#6b7280' 
                      }}>
                        {new Date(solicitud.fechaSolicitud).toLocaleDateString('es-CL')} - {solicitud.nombreSolicitante}
                      </div>
                    </div>
                  ))}
                  
                  {solicitudes.length === 0 && (
                    <p style={{ 
                      textAlign: 'center', 
                      color: '#6b7280', 
                      fontSize: isMobile ? '13px' : '14px' 
                    }}>
                      No hay actividad reciente
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sección de Vehículos con tabla responsiva */}
        {activeTab === 'vehiculos' && (
          <div>
            {/* Barra de búsqueda y filtros responsiva */}
            <div style={{
              background: 'white',
              padding: isMobile ? '15px' : '20px',
              borderRadius: '12px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '15px'
            }}>
              <input
                type="text"
                placeholder="🔍 Buscar vehículo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px' : '10px 15px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  padding: isMobile ? '12px' : '10px 15px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="todos">Todos los estados</option>
                <option value="disponible">✅ Disponible</option>
                <option value="en_uso">🔧 En Uso</option>
                <option value="mantenimiento">🔧 Mantenimiento</option>
                <option value="fuera_servicio">❌ Fuera de Servicio</option>
              </select>

              <div style={{
                padding: isMobile ? '12px' : '10px 15px',
                background: '#f3f4f6',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#6b7280',
                textAlign: 'center'
              }}>
                {filteredVehiculos.length} de {vehiculos.length} vehículos
              </div>
            </div>

            {/* Lista de vehículos para móvil (cards) */}
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredVehiculos.map((vehiculo) => {
                  const tipo = tiposVehiculo.find(t => t.id === vehiculo.tipo);
                  
                  return (
                    <div key={vehiculo.id} style={{
                      background: 'white',
                      padding: '15px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '10px'
                      }}>
                        <div>
                          <h4 style={{
                            margin: '0 0 5px 0',
                            fontSize: '16px',
                            color: '#1f2937'
                          }}>
                            {vehiculo.nombre}
                          </h4>
                          <p style={{
                            margin: 0,
                            fontSize: '13px',
                            color: '#6b7280'
                          }}>
                            {vehiculo.marca} {vehiculo.modelo}
                          </p>
                        </div>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          background: vehiculo.estado === 'disponible' ? '#dcfce7' :
                                     vehiculo.estado === 'en_uso' ? '#dbeafe' :
                                     vehiculo.estado === 'mantenimiento' ? '#fef3c7' : '#fee2e2',
                          color: vehiculo.estado === 'disponible' ? '#15803d' :
                                 vehiculo.estado === 'en_uso' ? '#1e40af' :
                                 vehiculo.estado === 'mantenimiento' ? '#92400e' : '#991b1b'
                        }}>
                          {vehiculo.estado === 'disponible' ? 'Disponible' :
                           vehiculo.estado === 'en_uso' ? 'En Uso' :
                           vehiculo.estado === 'mantenimiento' ? 'Mantención' : 'Fuera'}
                        </span>
                      </div>
                      
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px',
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: '10px'
                      }}>
                        <div>
                          <strong>Patente:</strong> {vehiculo.patente}
                        </div>
                        <div>
                          <strong>Km:</strong> {vehiculo.kilometraje?.toLocaleString()}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setSelectedVehicle(vehiculo)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Ver Detalles
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Tabla para desktop */
              <div style={{
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          Vehículo
                        </th>
                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          Tipo
                        </th>
                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          Patente
                        </th>
                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          Estado
                        </th>
                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          Kilometraje
                        </th>
                        <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVehiculos.map((vehiculo) => {
                        const tipo = tiposVehiculo.find(t => t.id === vehiculo.tipo);
                        
                        return (
                          <tr key={vehiculo.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '16px 20px' }}>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                                  {vehiculo.nombre}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                  {vehiculo.marca} {vehiculo.modelo} {vehiculo.año && `(${vehiculo.año})`}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                background: '#e0f2fe',
                                color: '#075985'
                              }}>
                                {tipo ? `${tipo.icon} ${tipo.nombre}` : vehiculo.tipo}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', fontSize: '14px', color: '#374151' }}>
                              {vehiculo.patente}
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '500',
                                background: vehiculo.estado === 'disponible' ? '#dcfce7' :
                                           vehiculo.estado === 'en_uso' ? '#dbeafe' :
                                           vehiculo.estado === 'mantenimiento' ? '#fef3c7' : '#fee2e2',
                                color: vehiculo.estado === 'disponible' ? '#15803d' :
                                       vehiculo.estado === 'en_uso' ? '#1e40af' :
                                       vehiculo.estado === 'mantenimiento' ? '#92400e' : '#991b1b'
                              }}>
                                {vehiculo.estado === 'disponible' ? '✅ Disponible' :
                                 vehiculo.estado === 'en_uso' ? '🔧 En Uso' :
                                 vehiculo.estado === 'mantenimiento' ? '🔧 Mantenimiento' : '❌ Fuera de Servicio'}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280' }}>
                              {vehiculo.kilometraje?.toLocaleString()} km
                            </td>
                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                              <button
                                onClick={() => setSelectedVehicle(vehiculo)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                👁️ Ver Detalles
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredVehiculos.length === 0 && (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#6b7280'
                  }}>
                    No se encontraron vehículos con los filtros aplicados
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Las demás secciones seguirían el mismo patrón responsivo... */}
      </div>

      {/* Modales */}
      {selectedVehicle && (
        <VehicleDetailsModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
        />
      )}

      {/* Estilos para animaciones */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default MonitorPanel;