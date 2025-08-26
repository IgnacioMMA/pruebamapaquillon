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
    const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
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
        switch (tab) {
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
    // Agregar esta función dentro del componente MonitorPanel, antes del return
    const UserDetailsModal = ({ user, onClose }) => {
        if (!user) return null;

        const vehiculoAsignado = vehiculos.find(v => v.operadorAsignado === user.id);

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
                    maxWidth: isMobile ? '100%' : '600px',
                    width: '100%',
                    maxHeight: isMobile ? '85vh' : '90vh',
                    overflow: 'auto',
                    padding: isMobile ? '20px' : '30px',
                    animation: isMobile ? 'slideUp 0.3s ease-out' : 'fadeIn 0.2s ease-out'
                }}>
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
                        marginBottom: '20px'
                    }}>
                        <h2 style={{
                            margin: 0,
                            color: '#1f2937',
                            fontSize: isMobile ? '20px' : '24px'
                        }}>
                            👤 Detalles del Usuario
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
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        {/* Información básica */}
                        <div style={{
                            padding: '15px',
                            background: '#f9fafb',
                            borderRadius: '8px'
                        }}>
                            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#374151' }}>
                                Información Personal
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div><strong>Nombre:</strong> {user.name || 'Sin nombre'}</div>
                                <div><strong>Email:</strong> {user.email}</div>
                                <div><strong>Teléfono:</strong> {user.phone || 'No registrado'}</div>
                                <div><strong>RUT:</strong> {user.rut || 'No registrado'}</div>
                                <div><strong>Localidad:</strong> {user.localidad || 'No especificada'}</div>
                            </div>
                        </div>

                        {/* Información laboral */}
                        <div style={{
                            padding: '15px',
                            background: '#f9fafb',
                            borderRadius: '8px'
                        }}>
                            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#374151' }}>
                                Información Laboral
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div>
                                    <strong>Rol:</strong>{' '}
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        background: user.role === 'superadmin' ? '#ede9fe' :
                                            user.role === 'admin' ? '#dbeafe' :
                                                user.role === 'monitor' ? '#f3f4f6' :
                                                    user.role === 'trabajador' ? '#dcfce7' : '#fef3c7',
                                        color: user.role === 'superadmin' ? '#6b21a8' :
                                            user.role === 'admin' ? '#1e40af' :
                                                user.role === 'monitor' ? '#374151' :
                                                    user.role === 'trabajador' ? '#15803d' : '#92400e'
                                    }}>
                                        {user.role}
                                    </span>
                                </div>
                                <div>
                                    <strong>Estado:</strong>{' '}
                                    <span style={{ color: user.active !== false ? '#15803d' : '#991b1b' }}>
                                        {user.active !== false ? '✅ Activo' : '❌ Inactivo'}
                                    </span>
                                </div>
                                {vehiculoAsignado && (
                                    <div><strong>Vehículo Asignado:</strong> {vehiculoAsignado.nombre}</div>
                                )}
                            </div>
                        </div>

                        {/* Licencias */}
                        {(user.licenciaConducir || user.licenciasConducir?.length > 0) && (
                            <div style={{
                                padding: '15px',
                                background: '#f9fafb',
                                borderRadius: '8px'
                            }}>
                                <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#374151' }}>
                                    Licencias de Conducir
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div>
                                        <strong>Clases:</strong>{' '}
                                        {user.licenciasConducir ?
                                            user.licenciasConducir.join(', ') :
                                            `Clase ${user.licenciaConducir}`}
                                    </div>
                                    {user.fechaVencimientoLicencia && (
                                        <div>
                                            <strong>Vencimiento:</strong>{' '}
                                            {new Date(user.fechaVencimientoLicencia).toLocaleDateString('es-CL')}
                                        </div>
                                    )}
                                    {user.licenciaBloqueada && (
                                        <div style={{ color: '#ef4444', fontWeight: 'bold' }}>
                                            ⚠️ LICENCIA BLOQUEADA
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };
    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            background: '#f3f4f6'
        }}>
            {/* Sidebar Permanente - Desktop y Móvil */}
            {/* Sidebar Permanente - Desktop y Móvil */}
            <div style={{
                width: isSidebarOpen ? '280px' : '60px',  // Cambio aquí
                background: 'white',
                borderRight: '1px solid #e5e7eb',
                boxShadow: '2px 0 10px rgba(0,0,0,0.05)',
                transition: 'width 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                height: '100vh',
                left: 0,
                top: 0,
                zIndex: 100,
                overflow: 'hidden'
            }}>
                {/* Header del Sidebar */}
                <div style={{
                    padding: !isSidebarOpen ? '20px 10px' : '20px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: isSidebarOpen ? 'space-between' : 'center',
                    alignItems: 'center'
                }}>
                    {isSidebarOpen && (
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#1f2937' }}>
                            📊 Panel Monitor
                        </h3>
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        style={{
                            padding: '8px',
                            background: 'transparent',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            color: '#6b7280'
                        }}
                    >
                        {isSidebarOpen ? '◀' : '▶'}
                    </button>
                </div>

                {/* Opciones del menú */}
                <div style={{ flex: 1, padding: '10px', overflow: 'auto' }}>
                    {['dashboard', 'vehiculos', 'usuarios', 'alertas'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            title={!isSidebarOpen && isMobile ?
                                (tab === 'dashboard' ? 'Dashboard' :
                                    tab === 'vehiculos' ? 'Vehículos' :
                                        tab === 'usuarios' ? 'Usuarios' : 'Alertas') : ''}
                            style={{
                                width: '100%',
                                padding: isMobile && !isSidebarOpen ? '12px' : '15px',
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
                                justifyContent: isMobile && !isSidebarOpen ? 'center' : 'flex-start',
                                gap: '10px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ fontSize: '18px' }}>
                                {tab === 'dashboard' && '📊'}
                                {tab === 'vehiculos' && '🚛'}
                                {tab === 'usuarios' && '👥'}
                                {tab === 'alertas' && '🔔'}
                            </span>
                            {(!isMobile || isSidebarOpen) && (
                                <span>
                                    {tab === 'dashboard' && 'Dashboard'}
                                    {tab === 'vehiculos' && 'Vehículos'}
                                    {tab === 'usuarios' && 'Usuarios'}
                                    {tab === 'alertas' && 'Alertas'}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer del Sidebar */}
                <div style={{
                    padding: isMobile && !isSidebarOpen ? '10px' : '20px',
                    borderTop: '1px solid #e5e7eb'
                }}>
                    {(!isMobile || isSidebarOpen) && (
                        <>
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

                            <div style={{
                                padding: '10px',
                                background: '#f9fafb',
                                borderRadius: '8px',
                                marginBottom: '15px'
                            }}>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>Usuario</div>
                                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                                    {currentUser.name || 'Monitor'}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {currentUser.email}
                                </div>
                            </div>
                        </>
                    )}

                    <button
                        onClick={onLogout}
                        title={isMobile && !isSidebarOpen ? 'Cerrar Sesión' : ''}
                        style={{
                            width: '100%',
                            padding: isMobile && !isSidebarOpen ? '10px' : '12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>🚪</span>
                        {(!isMobile || isSidebarOpen) && 'Cerrar Sesión'}
                    </button>
                </div>
            </div>

            {/* Contenido Principal */}
            <div style={{
                flex: 1,
                marginLeft: isSidebarOpen ? '280px' : '60px',  // Cambio aquí
                transition: 'margin-left 0.3s ease'
            }}>
                {/* Header del contenido */}
                <div style={{
                    background: 'white',
                    borderBottom: '1px solid #e5e7eb',
                    padding: isMobile ? '15px' : '20px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 50
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '20px'
                    }}>
                        <div style={{ flex: 1 }}>
                            <h1 style={{
                                margin: 0,
                                fontSize: isMobile ? '20px' : '28px',
                                fontWeight: '600',
                                color: '#1f2937'
                            }}>
                                {activeTab === 'dashboard' && '📊 Dashboard'}
                                {activeTab === 'vehiculos' && '🚛 Gestión de Vehículos'}
                                {activeTab === 'usuarios' && '👥 Gestión de Usuarios'}
                                {activeTab === 'alertas' && '🔔 Centro de Alertas'}
                            </h1>
                            <p style={{
                                margin: '5px 0 0 0',
                                color: '#6b7280',
                                fontSize: '14px'
                            }}>
                                Sistema de Gestión Municipal - Vista de Solo Lectura
                            </p>
                        </div>

                        {/* Indicador de actualización */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px'
                        }}>
                            <div style={{
                                padding: '8px 12px',
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
                                <span>
                                    {isMobile ?
                                        `🕐 ${refreshTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` :
                                        `Actualizado: ${refreshTime.toLocaleTimeString('es-CL')}`
                                    }
                                </span>
                            </div>

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
                                {autoRefresh ? '⏸️' : '▶️'}
                            </button>
                        </div>
                    </div>
                </div>

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
                                                borderLeft: `4px solid ${solicitud.estado === 'pendiente' ? '#f59e0b' :
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

                    {/* Sección de Usuarios */}
                    {activeTab === 'usuarios' && (
                        <div>
                            {/* Resumen de usuarios por rol */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' :
                                    isTablet ? 'repeat(3, 1fr)' :
                                        'repeat(5, 1fr)',
                                gap: isMobile ? '10px' : '15px',
                                marginBottom: '20px'
                            }}>
                                {[
                                    { role: 'trabajador', icon: '👷', color: '#22c55e', bg: '#dcfce7' },
                                    { role: 'admin', icon: '👨‍💼', color: '#3b82f6', bg: '#dbeafe' },
                                    { role: 'monitor', icon: '📊', color: '#6b7280', bg: '#f3f4f6' },
                                    { role: 'superadmin', icon: '🔐', color: '#7c3aed', bg: '#ede9fe' },
                                    { role: 'junta_vecinos', icon: '🏘️', color: '#f59e0b', bg: '#fef3c7' }
                                ].map(({ role, icon, color, bg }) => {
                                    const count = usuarios.filter(u => u.role === role).length;

                                    return (
                                        <div key={role} style={{
                                            background: 'white',
                                            padding: isMobile ? '12px' : '15px',
                                            borderRadius: '8px',
                                            borderLeft: `4px solid ${color}`,
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            {loadingPartial.usuarios && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    height: '2px',
                                                    background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
                                                    animation: 'slideLoading 1.5s infinite'
                                                }}></div>
                                            )}

                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}>
                                                <span style={{ fontSize: isMobile ? '18px' : '20px' }}>{icon}</span>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    background: bg,
                                                    color: color,
                                                    borderRadius: '4px',
                                                    fontSize: isMobile ? '16px' : '18px',
                                                    fontWeight: '600'
                                                }}>
                                                    {count}
                                                </span>
                                            </div>
                                            <div style={{
                                                marginTop: '8px',
                                                fontSize: isMobile ? '11px' : '13px',
                                                color: '#6b7280',
                                                textTransform: 'capitalize'
                                            }}>
                                                {role === 'superadmin' ? 'Super Admin' :
                                                    role === 'junta_vecinos' ? 'Junta Vecinos' :
                                                        role === 'monitor' ? 'Monitores' :
                                                            role === 'trabajador' ? 'Trabajadores' :
                                                                role === 'admin' ? 'Administradores' : role}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Barra de búsqueda */}
                            <div style={{
                                background: 'white',
                                padding: isMobile ? '15px' : '20px',
                                borderRadius: '12px',
                                marginBottom: '20px',
                                display: 'flex',
                                gap: '15px'
                            }}>
                                <input
                                    type="text"
                                    placeholder="🔍 Buscar usuario por nombre o email..."
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

                                <div style={{
                                    padding: isMobile ? '12px' : '10px 15px',
                                    background: '#f3f4f6',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    color: '#6b7280'
                                }}>
                                    {usuarios.length} usuarios
                                </div>
                            </div>

                            {/* Lista de usuarios - Versión móvil (cards) */}
                            {isMobile ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {usuarios
                                        .filter(user =>
                                            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            user.email?.toLowerCase().includes(searchTerm.toLowerCase())
                                        )
                                        .map((usuario) => {
                                            const vehiculoAsignado = vehiculos.find(v => v.operadorAsignado === usuario.id);

                                            return (
                                                <div key={usuario.id} style={{
                                                    background: 'white',
                                                    padding: '15px',
                                                    borderRadius: '12px',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                                    position: 'relative'
                                                }}>
                                                    {loadingPartial.usuarios && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            right: 0,
                                                            height: '2px',
                                                            background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
                                                            animation: 'slideLoading 1.5s infinite',
                                                            borderRadius: '12px 12px 0 0'
                                                        }}></div>
                                                    )}

                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'start',
                                                        marginBottom: '10px'
                                                    }}>
                                                        <div style={{ flex: 1 }}>
                                                            <h4 style={{
                                                                margin: '0 0 5px 0',
                                                                fontSize: '16px',
                                                                color: '#1f2937'
                                                            }}>
                                                                {usuario.name || 'Sin nombre'}
                                                            </h4>
                                                            <p style={{
                                                                margin: 0,
                                                                fontSize: '12px',
                                                                color: '#6b7280'
                                                            }}>
                                                                {usuario.email}
                                                            </p>
                                                        </div>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            fontWeight: '500',
                                                            background: usuario.role === 'superadmin' ? '#ede9fe' :
                                                                usuario.role === 'admin' ? '#dbeafe' :
                                                                    usuario.role === 'monitor' ? '#f3f4f6' :
                                                                        usuario.role === 'trabajador' ? '#dcfce7' : '#fef3c7',
                                                            color: usuario.role === 'superadmin' ? '#6b21a8' :
                                                                usuario.role === 'admin' ? '#1e40af' :
                                                                    usuario.role === 'monitor' ? '#374151' :
                                                                        usuario.role === 'trabajador' ? '#15803d' : '#92400e'
                                                        }}>
                                                            {usuario.role === 'superadmin' ? 'Super' :
                                                                usuario.role === 'admin' ? 'Admin' :
                                                                    usuario.role === 'monitor' ? 'Monitor' :
                                                                        usuario.role === 'trabajador' ? 'Trabajador' : 'Junta V.'}
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
                                                            <strong>Teléfono:</strong> {usuario.phone || 'N/A'}
                                                        </div>
                                                        <div>
                                                            <strong>Estado:</strong>{' '}
                                                            <span style={{
                                                                color: usuario.active !== false ? '#15803d' : '#991b1b'
                                                            }}>
                                                                {usuario.active !== false ? 'Activo' : 'Inactivo'}
                                                            </span>
                                                        </div>
                                                        {usuario.localidad && (
                                                            <div style={{ gridColumn: 'span 2' }}>
                                                                <strong>Localidad:</strong> {usuario.localidad}
                                                            </div>
                                                        )}
                                                        {vehiculoAsignado && (
                                                            <div style={{ gridColumn: 'span 2' }}>
                                                                <strong>Vehículo:</strong> {vehiculoAsignado.nombre}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => setSelectedUser(usuario)}
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
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                    position: 'relative'
                                }}>
                                    {loadingPartial.usuarios && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            height: '3px',
                                            background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
                                            animation: 'slideLoading 1.5s infinite',
                                            zIndex: 1
                                        }}></div>
                                    )}

                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                                        Usuario
                                                    </th>
                                                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                                        Rol
                                                    </th>
                                                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                                        Contacto
                                                    </th>
                                                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                                        Licencias
                                                    </th>
                                                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                                        Estado
                                                    </th>
                                                    <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                                        Acciones
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usuarios
                                                    .filter(user =>
                                                        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
                                                    )
                                                    .map((usuario) => {
                                                        // Calcular estado de licencia
                                                        let estadoLicencia = null;
                                                        if (usuario.fechaVencimientoLicencia) {
                                                            const fechaVencimiento = new Date(usuario.fechaVencimientoLicencia);
                                                            const hoy = new Date();
                                                            const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

                                                            if (diasRestantes < 0) {
                                                                estadoLicencia = { tipo: 'vencida', texto: 'VENCIDA', color: '#ef4444' };
                                                            } else if (diasRestantes <= 14) {
                                                                estadoLicencia = { tipo: 'porVencer', texto: `${diasRestantes} días`, color: '#f59e0b' };
                                                            } else {
                                                                estadoLicencia = { tipo: 'vigente', texto: 'Vigente', color: '#22c55e' };
                                                            }
                                                        }

                                                        return (
                                                            <tr key={usuario.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                                <td style={{ padding: '16px 20px' }}>
                                                                    <div>
                                                                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                                                                            {usuario.name || 'Sin nombre'}
                                                                        </div>
                                                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                                            {usuario.email}
                                                                        </div>
                                                                        {usuario.rut && (
                                                                            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                                                                                RUT: {usuario.rut}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '16px 20px' }}>
                                                                    <span style={{
                                                                        padding: '4px 8px',
                                                                        borderRadius: '4px',
                                                                        fontSize: '12px',
                                                                        fontWeight: '500',
                                                                        background: usuario.role === 'superadmin' ? '#ede9fe' :
                                                                            usuario.role === 'admin' ? '#dbeafe' :
                                                                                usuario.role === 'monitor' ? '#f3f4f6' :
                                                                                    usuario.role === 'trabajador' ? '#dcfce7' : '#fef3c7',
                                                                        color: usuario.role === 'superadmin' ? '#6b21a8' :
                                                                            usuario.role === 'admin' ? '#1e40af' :
                                                                                usuario.role === 'monitor' ? '#374151' :
                                                                                    usuario.role === 'trabajador' ? '#15803d' : '#92400e'
                                                                    }}>
                                                                        {usuario.role === 'superadmin' ? '🔐 Super Admin' :
                                                                            usuario.role === 'admin' ? '👨‍💼 Administrador' :
                                                                                usuario.role === 'monitor' ? '📊 Monitor' :
                                                                                    usuario.role === 'trabajador' ? '👷 Trabajador' : '🏘️ Junta Vecinos'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '16px 20px' }}>
                                                                    <div style={{ fontSize: '13px', color: '#374151' }}>
                                                                        {usuario.phone || 'Sin teléfono'}
                                                                    </div>
                                                                    {usuario.localidad && (
                                                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                                            📍 {usuario.localidad}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '16px 20px' }}>
                                                                    {(usuario.licenciaConducir || usuario.licenciasConducir?.length > 0) ? (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span style={{ fontSize: '12px', fontWeight: '500' }}>
                                                                                {usuario.licenciasConducir ?
                                                                                    usuario.licenciasConducir.join(', ') :
                                                                                    `Clase ${usuario.licenciaConducir}`}
                                                                            </span>

                                                                            {usuario.licenciaBloqueada && (
                                                                                <span style={{
                                                                                    padding: '2px 6px',
                                                                                    borderRadius: '4px',
                                                                                    fontSize: '11px',
                                                                                    fontWeight: '600',
                                                                                    background: '#ef4444',
                                                                                    color: 'white'
                                                                                }}>
                                                                                    BLOQUEADA
                                                                                </span>
                                                                            )}

                                                                            {estadoLicencia && !usuario.licenciaBloqueada && (
                                                                                <span style={{
                                                                                    padding: '2px 6px',
                                                                                    borderRadius: '4px',
                                                                                    fontSize: '11px',
                                                                                    fontWeight: '600',
                                                                                    background: estadoLicencia.color + '20',
                                                                                    color: estadoLicencia.color,
                                                                                    border: `1px solid ${estadoLicencia.color}`
                                                                                }}>
                                                                                    {estadoLicencia.texto}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                                                                            Sin licencia
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '16px 20px' }}>
                                                                    <span style={{
                                                                        padding: '4px 8px',
                                                                        borderRadius: '4px',
                                                                        fontSize: '12px',
                                                                        background: usuario.active !== false ? '#dcfce7' : '#fee2e2',
                                                                        color: usuario.active !== false ? '#15803d' : '#991b1b'
                                                                    }}>
                                                                        {usuario.active !== false ? '✅ Activo' : '❌ Inactivo'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                                                    <button
                                                                        onClick={() => setSelectedUser(usuario)}
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

                                    {usuarios.filter(user =>
                                        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).length === 0 && (
                                            <div style={{
                                                padding: '40px',
                                                textAlign: 'center',
                                                color: '#6b7280'
                                            }}>
                                                No se encontraron usuarios
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sección de Alertas */}
                    {activeTab === 'alertas' && (
                        <div>
                            {/* Resumen de alertas */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' :
                                    isTablet ? 'repeat(2, 1fr)' :
                                        'repeat(3, 1fr)',
                                gap: isMobile ? '10px' : '15px',
                                marginBottom: '20px'
                            }}>
                                <div style={{
                                    background: 'white',
                                    padding: isMobile ? '15px' : '20px',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                    borderLeft: '4px solid #f59e0b'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: '10px'
                                    }}>
                                        <span style={{ fontSize: isMobile ? '20px' : '24px' }}>🔧</span>
                                        <span style={{
                                            fontSize: isMobile ? '20px' : '24px',
                                            fontWeight: 'bold',
                                            color: '#f59e0b'
                                        }}>
                                            {getVehiculosNecesitanMantenimiento().length}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: isMobile ? '13px' : '14px', color: '#374151' }}>
                                        Mantenimientos Próximos
                                    </div>
                                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: '5px' }}>
                                        En los próximos 7 días
                                    </div>
                                </div>

                                <div style={{
                                    background: 'white',
                                    padding: isMobile ? '15px' : '20px',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                    borderLeft: '4px solid #ef4444'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: '10px'
                                    }}>
                                        <span style={{ fontSize: isMobile ? '20px' : '24px' }}>📄</span>
                                        <span style={{
                                            fontSize: isMobile ? '20px' : '24px',
                                            fontWeight: 'bold',
                                            color: '#ef4444'
                                        }}>
                                            {getDocumentosProximosVencer().length}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: isMobile ? '13px' : '14px', color: '#374151' }}>
                                        Documentos por Vencer
                                    </div>
                                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: '5px' }}>
                                        En los próximos 30 días
                                    </div>
                                </div>

                                <div style={{
                                    background: 'white',
                                    padding: isMobile ? '15px' : '20px',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                    borderLeft: '4px solid #3b82f6'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: '10px'
                                    }}>
                                        <span style={{ fontSize: isMobile ? '20px' : '24px' }}>📋</span>
                                        <span style={{
                                            fontSize: isMobile ? '20px' : '24px',
                                            fontWeight: 'bold',
                                            color: '#3b82f6'
                                        }}>
                                            {getSolicitudesStats().pendientes}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: isMobile ? '13px' : '14px', color: '#374151' }}>
                                        Solicitudes Pendientes
                                    </div>
                                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: '5px' }}>
                                        Esperando respuesta
                                    </div>
                                </div>
                            </div>

                            {/* Vehículos que necesitan mantenimiento */}
                            <div style={{
                                background: 'white',
                                padding: isMobile ? '15px' : '20px',
                                borderRadius: '12px',
                                marginBottom: '20px',
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
                                    color: '#1f2937',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    🔧 Mantenimientos Próximos
                                    <span style={{
                                        padding: '2px 8px',
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}>
                                        {getVehiculosNecesitanMantenimiento().length}
                                    </span>
                                </h3>

                                {getVehiculosNecesitanMantenimiento().length > 0 ? (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: isMobile ? '8px' : '10px'
                                    }}>
                                        {getVehiculosNecesitanMantenimiento().map(vehiculo => {
                                            const diasRestantes = Math.ceil(
                                                (new Date(vehiculo.proximoMantenimiento) - new Date()) / (1000 * 60 * 60 * 24)
                                            );

                                            return (
                                                <div key={vehiculo.id} style={{
                                                    padding: isMobile ? '12px' : '15px',
                                                    background: '#fef3c7',
                                                    borderRadius: '8px',
                                                    borderLeft: '4px solid #f59e0b'
                                                }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: isMobile ? 'start' : 'center',
                                                        flexDirection: isMobile ? 'column' : 'row',
                                                        gap: isMobile ? '10px' : '0'
                                                    }}>
                                                        <div>
                                                            <div style={{
                                                                fontSize: isMobile ? '14px' : '14px',
                                                                fontWeight: '500',
                                                                color: '#92400e'
                                                            }}>
                                                                {vehiculo.nombre} - {vehiculo.patente}
                                                            </div>
                                                            <div style={{
                                                                fontSize: isMobile ? '12px' : '12px',
                                                                color: '#78350f',
                                                                marginTop: '5px'
                                                            }}>
                                                                Próximo mantenimiento: {new Date(vehiculo.proximoMantenimiento).toLocaleDateString('es-CL')}
                                                            </div>
                                                            {vehiculo.kilometrajeProximoMantenimiento > 0 && (
                                                                <div style={{
                                                                    fontSize: isMobile ? '11px' : '11px',
                                                                    color: '#78350f',
                                                                    marginTop: '2px'
                                                                }}>
                                                                    O al alcanzar: {vehiculo.kilometrajeProximoMantenimiento?.toLocaleString()} km
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{
                                                            padding: '8px 12px',
                                                            background: '#f59e0b',
                                                            color: 'white',
                                                            borderRadius: '6px',
                                                            fontSize: isMobile ? '13px' : '14px',
                                                            fontWeight: '600',
                                                            alignSelf: isMobile ? 'flex-end' : 'auto'
                                                        }}>
                                                            {diasRestantes === 0 ? 'HOY' :
                                                                diasRestantes === 1 ? 'MAÑANA' :
                                                                    `${diasRestantes} días`}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p style={{
                                        color: '#6b7280',
                                        textAlign: 'center',
                                        padding: '20px',
                                        fontSize: isMobile ? '13px' : '14px'
                                    }}>
                                        No hay vehículos con mantenimiento próximo
                                    </p>
                                )}
                            </div>

                            {/* Documentos próximos a vencer */}
                            <div style={{
                                background: 'white',
                                padding: isMobile ? '15px' : '20px',
                                borderRadius: '12px',
                                marginBottom: '20px',
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
                                    color: '#1f2937',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    📄 Documentos Próximos a Vencer
                                    <span style={{
                                        padding: '2px 8px',
                                        background: '#fee2e2',
                                        color: '#991b1b',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}>
                                        {getDocumentosProximosVencer().length}
                                    </span>
                                </h3>

                                {getDocumentosProximosVencer().length > 0 ? (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: isMobile ? '8px' : '10px'
                                    }}>
                                        {getDocumentosProximosVencer().map((alerta, index) => (
                                            <div key={index} style={{
                                                padding: isMobile ? '12px' : '15px',
                                                background: alerta.dias <= 7 ? '#fee2e2' : '#fef3c7',
                                                borderRadius: '8px',
                                                borderLeft: `4px solid ${alerta.dias <= 7 ? '#ef4444' : '#f59e0b'}`
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: isMobile ? 'start' : 'center',
                                                    flexDirection: isMobile ? 'column' : 'row',
                                                    gap: isMobile ? '10px' : '0'
                                                }}>
                                                    <div>
                                                        <div style={{
                                                            fontSize: isMobile ? '14px' : '14px',
                                                            fontWeight: '500',
                                                            color: alerta.dias <= 7 ? '#991b1b' : '#92400e'
                                                        }}>
                                                            {alerta.vehiculo} - {alerta.documento}
                                                        </div>
                                                        <div style={{
                                                            fontSize: isMobile ? '12px' : '12px',
                                                            color: alerta.dias <= 7 ? '#7f1d1d' : '#78350f',
                                                            marginTop: '5px'
                                                        }}>
                                                            Vence: {new Date(alerta.vencimiento).toLocaleDateString('es-CL')}
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        padding: '8px 12px',
                                                        background: alerta.dias <= 7 ? '#ef4444' : '#f59e0b',
                                                        color: 'white',
                                                        borderRadius: '6px',
                                                        fontSize: isMobile ? '13px' : '14px',
                                                        fontWeight: '600',
                                                        alignSelf: isMobile ? 'flex-end' : 'auto'
                                                    }}>
                                                        {alerta.dias === 0 ? 'VENCE HOY' :
                                                            alerta.dias === 1 ? 'VENCE MAÑANA' :
                                                                `${alerta.dias} días`}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{
                                        color: '#6b7280',
                                        textAlign: 'center',
                                        padding: '20px',
                                        fontSize: isMobile ? '13px' : '14px'
                                    }}>
                                        No hay documentos próximos a vencer
                                    </p>
                                )}
                            </div>

                            {/* Solicitudes pendientes */}
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
                                    color: '#1f2937',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    📋 Solicitudes Pendientes
                                    <span style={{
                                        padding: '2px 8px',
                                        background: '#dbeafe',
                                        color: '#1e40af',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}>
                                        {getSolicitudesStats().pendientes}
                                    </span>
                                </h3>

                                {getSolicitudesStats().pendientes > 0 ? (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: isMobile ? '8px' : '10px'
                                    }}>
                                        {solicitudes.filter(s => s.estado === 'pendiente').slice(0, 10).map(solicitud => (
                                            <div key={solicitud.id} style={{
                                                padding: isMobile ? '12px' : '15px',
                                                background: '#f9fafb',
                                                borderRadius: '8px',
                                                borderLeft: '4px solid #3b82f6'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'start',
                                                    marginBottom: '8px'
                                                }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{
                                                            fontSize: isMobile ? '14px' : '14px',
                                                            fontWeight: '500',
                                                            color: '#1f2937',
                                                            marginBottom: '5px'
                                                        }}>
                                                            {solicitud.asunto}
                                                        </div>
                                                        <div style={{
                                                            fontSize: isMobile ? '12px' : '12px',
                                                            color: '#6b7280'
                                                        }}>
                                                            Solicitante: {solicitud.nombreSolicitante}
                                                        </div>
                                                        <div style={{
                                                            fontSize: isMobile ? '11px' : '11px',
                                                            color: '#9ca3af',
                                                            marginTop: '2px'
                                                        }}>
                                                            {new Date(solicitud.fechaSolicitud).toLocaleDateString('es-CL')} •
                                                            {solicitud.localidad && ` ${solicitud.localidad}`}
                                                        </div>
                                                    </div>

                                                    <div style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '5px',
                                                        alignItems: 'flex-end'
                                                    }}>
                                                        {solicitud.prioridad === 'alta' && (
                                                            <span style={{
                                                                padding: '2px 6px',
                                                                background: '#fee2e2',
                                                                color: '#991b1b',
                                                                borderRadius: '4px',
                                                                fontSize: '11px',
                                                                fontWeight: '600'
                                                            }}>
                                                                ⚠️ ALTA
                                                            </span>
                                                        )}
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            background: '#fef3c7',
                                                            color: '#92400e',
                                                            borderRadius: '4px',
                                                            fontSize: '11px'
                                                        }}>
                                                            Pendiente
                                                        </span>
                                                    </div>
                                                </div>

                                                {solicitud.descripcion && (
                                                    <div style={{
                                                        fontSize: isMobile ? '11px' : '12px',
                                                        color: '#6b7280',
                                                        marginTop: '8px',
                                                        padding: '8px',
                                                        background: 'white',
                                                        borderRadius: '4px',
                                                        lineHeight: '1.4'
                                                    }}>
                                                        {solicitud.descripcion.substring(0, 150)}
                                                        {solicitud.descripcion.length > 150 && '...'}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{
                                        color: '#6b7280',
                                        textAlign: 'center',
                                        padding: '20px',
                                        fontSize: isMobile ? '13px' : '14px'
                                    }}>
                                        No hay solicitudes pendientes
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal de detalles de usuario mejorado */}
                {selectedUser && (
                    <UserDetailsModal
                        user={selectedUser}
                        onClose={() => setSelectedUser(null)}
                    />
                )}

                {/* Modal responsivo de usuario */}
                {selectedUser && (
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
                            maxWidth: isMobile ? '100%' : '600px',
                            width: '100%',
                            maxHeight: isMobile ? '85vh' : '90vh',
                            overflow: 'auto',
                            padding: isMobile ? '20px' : '30px',
                            animation: isMobile ? 'slideUp 0.3s ease-out' : 'fadeIn 0.2s ease-out'
                        }}>
                            {/* Contenido del modal de usuario... */}
                        </div>
                    </div>
                )}

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
        </div>

    );
};

export default MonitorPanel;