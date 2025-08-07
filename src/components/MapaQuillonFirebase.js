// src/components/MapaQuillonFirebase.js
import React, { useEffect, useRef, useState } from 'react';
import { vehiculosService, zonasService, trabajadoresService, reportesService } from '../services/firebaseservices';

const MapaQuillonFirebase = ({ currentUser, onLogout }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [vehiculos, setVehiculos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  // const [selectedItem, setSelectedItem] = useState(null); // Para uso futuro
  const [filtroActivo, setFiltroActivo] = useState('todos');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [realtimeStats, setRealtimeStats] = useState({
    vehiculos: { total: 0, activos: 0, enMantenimiento: 0 },
    zonas: { total: 0, activas: 0, completadas: 0 },
    trabajadores: { total: 0, enRuta: 0, trabajando: 0 }
  });
  
  const markersRef = useRef({});
  const infoWindowRef = useRef(null);
  const unsubscribesRef = useRef([]);
  
  const API_KEY = 'AIzaSyA7DrdL36n5cx-RNzuXGAQggFeGCheHDbY';

  // Cargar Google Maps
  useEffect(() => {
    const loadGoogleMaps = () => {
      return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
          return;
        }

        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
          existingScript.addEventListener('load', () => {
            if (window.google && window.google.maps) {
              resolve(window.google.maps);
            } else {
              reject(new Error('Google Maps no disponible'));
            }
          });
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geometry&v=weekly`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          if (window.google && window.google.maps) {
            resolve(window.google.maps);
          }
        };

        script.onerror = () => reject(new Error('Error al cargar Google Maps'));
        document.head.appendChild(script);
      });
    };

    const initMap = async () => {
      try {
        const maps = await loadGoogleMaps();
        
        if (!mapRef.current) return;

        const mapInstance = new maps.Map(mapRef.current, {
          center: { lat: -36.7333, lng: -72.4667 },
          zoom: 13,
          mapTypeId: 'roadmap',
          styles: [
            {
              featureType: 'poi.business',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        setMap(mapInstance);
        infoWindowRef.current = new maps.InfoWindow();
        setMapLoaded(true);
      } catch (err) {
        console.error('Error al cargar mapa:', err);
      }
    };

    initMap();
  }, []);

  // Suscribirse a datos de Firebase en tiempo real
  useEffect(() => {
    // Suscribirse a vehículos
    const unsubVehiculos = vehiculosService.subscribeToVehiculos((vehiculosData) => {
      setVehiculos(vehiculosData);
    });
    unsubscribesRef.current.push(unsubVehiculos);

    // Suscribirse a zonas
    const unsubZonas = zonasService.subscribeToZonas((zonasData) => {
      setZonas(zonasData);
    });
    unsubscribesRef.current.push(unsubZonas);

    // Suscribirse a trabajadores
    const unsubTrabajadores = trabajadoresService.subscribeToTrabajadores((trabajadoresData) => {
      setTrabajadores(trabajadoresData);
      console.log('Trabajadores actualizados:', trabajadoresData);
    });
    unsubscribesRef.current.push(unsubTrabajadores);

    // Suscribirse a estadísticas en tiempo real
    reportesService.getRealtimeStats((stats) => {
      setRealtimeStats(stats);
    });

    // Auto-refresh cada 2 segundos para actualizar indicadores visuales
    const refreshInterval = setInterval(() => {
      // Forzar re-render para actualizar tiempos relativos
      setTrabajadores(prev => [...prev]);
    }, 2000);

    // Limpiar suscripciones al desmontar
    return () => {
      unsubscribesRef.current.forEach(unsub => unsub && unsub());
      clearInterval(refreshInterval);
    };
  }, []);

  // Crear/actualizar marcadores
  useEffect(() => {
    if (!map || !window.google) return;

    // Función para crear icono según tipo y estado
    const getIcon = (tipo, estado) => {
      const iconConfigs = {
        vehiculo: {
          activo: { color: '#22c55e', symbol: '🚛' },
          trabajando: { color: '#3b82f6', symbol: '🔧' },
          en_ruta: { color: '#f59e0b', symbol: '🚗' },
          mantenimiento: { color: '#ef4444', symbol: '🔧' },
          inactivo: { color: '#6b7280', symbol: '⏸️' }
        },
        zona: {
          activa: { color: '#3b82f6', symbol: '🏗️' },
          pausada: { color: '#f59e0b', symbol: '⏸️' },
          completada: { color: '#22c55e', symbol: '✅' }
        },
        trabajador: {
          en_camino: { color: '#8b5cf6', symbol: '👷' },
          trabajando: { color: '#10b981', symbol: '👷' },
          disponible: { color: '#06b6d4', symbol: '👷' }
        }
      };

      const config = iconConfigs[tipo]?.[estado] || { color: '#6b7280', symbol: '📍' };
      
      if (tipo === 'trabajador') {
        return {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: config.color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        };
      }

      return {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
        fillColor: config.color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: tipo === 'vehiculo' ? 1.8 : 2,
        anchor: new window.google.maps.Point(12, 24)
      };
    };

    // Limpiar marcadores antiguos
    Object.values(markersRef.current).forEach(marker => marker.setMap(null));
    markersRef.current = {};

    // Crear marcadores de vehículos
    if (filtroActivo === 'todos' || filtroActivo === 'vehiculos') {
      vehiculos.forEach(vehiculo => {
        if (vehiculo.lat && vehiculo.lng) {
          const marker = new window.google.maps.Marker({
            position: { lat: vehiculo.lat, lng: vehiculo.lng },
            map: map,
            title: vehiculo.nombre,
            icon: getIcon('vehiculo', vehiculo.estado),
            animation: vehiculo.estado === 'activo' ? window.google.maps.Animation.BOUNCE : null
          });

          marker.addListener('click', () => {
            const content = createVehiculoInfoWindow(vehiculo);
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open(map, marker);
            // setSelectedItem(vehiculo); // Para uso futuro
          });

          markersRef.current[`vehiculo_${vehiculo.id}`] = marker;
        }
      });
    }

    // Crear marcadores de zonas
    if (filtroActivo === 'todos' || filtroActivo === 'zonas') {
      zonas.forEach(zona => {
        if (zona.lat && zona.lng) {
          const marker = new window.google.maps.Marker({
            position: { lat: zona.lat, lng: zona.lng },
            map: map,
            title: zona.nombre,
            icon: getIcon('zona', zona.estado)
          });

          marker.addListener('click', () => {
            const content = createZonaInfoWindow(zona);
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open(map, marker);
            // setSelectedItem(zona); // Para uso futuro
          });

          markersRef.current[`zona_${zona.id}`] = marker;
        }
      });
    }

    // Crear marcadores de trabajadores
    if (filtroActivo === 'todos' || filtroActivo === 'trabajadores') {
      trabajadores.forEach(trabajador => {
        if (trabajador.ubicacion && trabajador.ubicacion.lat && trabajador.ubicacion.lng) {
          const marker = new window.google.maps.Marker({
            position: { lat: trabajador.ubicacion.lat, lng: trabajador.ubicacion.lng },
            map: map,
            title: trabajador.nombre,
            icon: getIcon('trabajador', trabajador.estado || 'disponible')
          });

          marker.addListener('click', () => {
            const content = createTrabajadorInfoWindow(trabajador);
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open(map, marker);
            // setSelectedItem(trabajador); // Para uso futuro
          });

          markersRef.current[`trabajador_${trabajador.id}`] = marker;
        }
      });
    }

  }, [map, vehiculos, zonas, trabajadores, filtroActivo]);

  // Funciones para crear contenido de InfoWindow
  const createVehiculoInfoWindow = (vehiculo) => {
    return `
      <div style="padding: 10px; font-family: Arial, sans-serif; max-width: 280px;">
        <h3 style="margin: 0 0 10px 0; color: #1f2937;">
          ${vehiculo.nombre}
        </h3>
        <div style="background: ${vehiculo.estado === 'activo' ? '#dcfce7' : vehiculo.estado === 'trabajando' ? '#dbeafe' : '#fef3c7'}; 
                    padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 10px;">
          <strong>Estado:</strong> ${vehiculo.estado}
        </div>
        <div style="font-size: 14px; line-height: 1.6;">
          ${vehiculo.conductor ? `<div><strong>👤 Conductor:</strong> ${vehiculo.conductor}</div>` : ''}
          ${vehiculo.telefono ? `<div><strong>📱 Teléfono:</strong> ${vehiculo.telefono}</div>` : ''}
          ${vehiculo.combustible ? `
            <div><strong>⛽ Combustible:</strong> 
              <span style="color: ${vehiculo.combustible > 50 ? '#22c55e' : vehiculo.combustible > 25 ? '#f59e0b' : '#ef4444'}">
                ${vehiculo.combustible}%
              </span>
            </div>
          ` : ''}
          ${vehiculo.velocidad ? `<div><strong>📍 Velocidad:</strong> ${vehiculo.velocidad} km/h</div>` : ''}
          ${vehiculo.zona ? `<div><strong>🏗️ Zona:</strong> ${vehiculo.zona}</div>` : ''}
          ${vehiculo.destino ? `<div><strong>🎯 Destino:</strong> ${vehiculo.destino}</div>` : ''}
          <div style="margin-top: 8px; color: #6b7280; font-size: 12px;">
            Última actualización: ${vehiculo.ultimaActualizacion ? new Date(vehiculo.ultimaActualizacion).toLocaleTimeString() : 'N/A'}
          </div>
        </div>
      </div>
    `;
  };

  const createZonaInfoWindow = (zona) => {
    return `
      <div style="padding: 10px; font-family: Arial, sans-serif; max-width: 280px;">
        <h3 style="margin: 0 0 10px 0; color: #1f2937;">
          ${zona.nombre}
        </h3>
        <div style="background: ${zona.estado === 'activa' ? '#dbeafe' : zona.estado === 'pausada' ? '#fef3c7' : '#dcfce7'}; 
                    padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 10px;">
          <strong>Estado:</strong> ${zona.estado}
        </div>
        <div style="font-size: 14px; line-height: 1.6;">
          ${zona.supervisor ? `<div><strong>👷 Supervisor:</strong> ${zona.supervisor}</div>` : ''}
          ${zona.telefono ? `<div><strong>📱 Teléfono:</strong> ${zona.telefono}</div>` : ''}
          ${zona.progreso !== undefined ? `
            <div><strong>📊 Progreso:</strong>
              <div style="background: #e5e7eb; border-radius: 4px; height: 20px; margin: 4px 0;">
                <div style="background: ${zona.progreso === 100 ? '#22c55e' : '#3b82f6'}; 
                            width: ${zona.progreso}%; height: 100%; border-radius: 4px; 
                            display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                  ${zona.progreso.toFixed(0)}%
                </div>
              </div>
            </div>
          ` : ''}
          ${zona.trabajadores ? `<div><strong>👥 Trabajadores:</strong> ${zona.trabajadores}</div>` : ''}
          ${zona.horaInicio ? `<div><strong>⏰ Horario:</strong> ${zona.horaInicio} - ${zona.horaEstimadaFin || zona.horaFin || 'Por definir'}</div>` : ''}
          ${zona.motivoPausa ? `<div style="color: #f59e0b; margin-top: 8px;">⚠️ ${zona.motivoPausa}</div>` : ''}
        </div>
      </div>
    `;
  };

  const createTrabajadorInfoWindow = (trabajador) => {
    const ahora = new Date();
    const ultimaActualizacion = trabajador.ubicacion?.timestamp ? new Date(trabajador.ubicacion.timestamp) : null;
    const diferenciaTiempo = ultimaActualizacion ? Math.floor((ahora - ultimaActualizacion) / 1000) : null;
    
    let estadoConexion = '⚫ Sin conexión';
    let colorEstado = '#6b7280';
    
    if (diferenciaTiempo !== null) {
      if (diferenciaTiempo < 30) {
        estadoConexion = '🟢 En línea';
        colorEstado = '#10b981';
      } else if (diferenciaTiempo < 60) {
        estadoConexion = '🟡 Conexión reciente';
        colorEstado = '#f59e0b';
      } else if (diferenciaTiempo < 300) {
        estadoConexion = '🟠 Última conexión hace ' + Math.floor(diferenciaTiempo / 60) + ' min';
        colorEstado = '#fb923c';
      } else {
        estadoConexion = '🔴 Sin conexión reciente';
        colorEstado = '#ef4444';
      }
    }
    
    return `
      <div style="padding: 10px; font-family: Arial, sans-serif; max-width: 300px;">
        <h3 style="margin: 0 0 10px 0; color: #1f2937; display: flex; align-items: center; gap: 8px;">
          👷 ${trabajador.nombre || trabajador.email || 'Trabajador'}
          <span style="
            font-size: 10px;
            padding: 2px 6px;
            background: ${colorEstado}22;
            color: ${colorEstado};
            border-radius: 12px;
            font-weight: normal;
          ">
            ${estadoConexion}
          </span>
        </h3>
        
        <div style="
          background: ${trabajador.estado === 'en_camino' ? '#ede9fe' : 
                       trabajador.estado === 'trabajando' ? '#dcfce7' : 
                       trabajador.estado === 'disponible' ? '#e0f2fe' : '#f3f4f6'}; 
          padding: 6px 10px; 
          border-radius: 6px; 
          display: inline-block; 
          margin-bottom: 12px;
          font-size: 13px;
        ">
          <strong>Estado:</strong> ${
            trabajador.estado === 'en_camino' ? '🚗 En camino' :
            trabajador.estado === 'trabajando' ? '🔧 Trabajando' :
            trabajador.estado === 'disponible' ? '✅ Disponible' :
            '⏸️ ' + (trabajador.estado || 'Sin estado')
          }
        </div>
        
        <div style="font-size: 14px; line-height: 1.8;">
          ${trabajador.email ? `
            <div style="margin-bottom: 6px;">
              <strong>📧 Email:</strong> 
              <span style="color: #6b7280; font-size: 13px;">${trabajador.email}</span>
            </div>
          ` : ''}
          
          ${trabajador.telefono ? `
            <div style="margin-bottom: 6px;">
              <strong>📱 Teléfono:</strong> 
              <span style="color: #6b7280; font-size: 13px;">${trabajador.telefono}</span>
            </div>
          ` : ''}
          
          ${trabajador.zonaDestino ? `
            <div style="margin-bottom: 6px;">
              <strong>🎯 Destino:</strong> 
              <span style="color: #3b82f6; font-size: 13px;">${trabajador.zonaDestino}</span>
            </div>
          ` : ''}
          
          ${trabajador.recorridoActual ? `
            <div style="margin-bottom: 6px;">
              <strong>📍 En recorrido:</strong> 
              <span style="color: #10b981; font-size: 13px;">Activo</span>
            </div>
          ` : ''}
          
          ${trabajador.ubicacion ? `
            <div style="
              margin-top: 12px; 
              padding-top: 10px; 
              border-top: 1px solid #e5e7eb;
            ">
              <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">
                <strong>📍 Ubicación GPS:</strong>
              </div>
              <div style="
                font-family: monospace; 
                font-size: 11px; 
                color: #9ca3af;
                background: #f9fafb;
                padding: 6px;
                border-radius: 4px;
              ">
                Lat: ${trabajador.ubicacion.lat.toFixed(6)}<br/>
                Lng: ${trabajador.ubicacion.lng.toFixed(6)}
              </div>
              <div style="color: #9ca3af; font-size: 11px; margin-top: 6px;">
                ⏱️ Última actualización: ${
                  ultimaActualizacion ? 
                  ultimaActualizacion.toLocaleTimeString('es-CL', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  }) : 
                  'N/A'
                }
              </div>
            </div>
          ` : `
            <div style="
              margin-top: 12px; 
              padding: 10px; 
              background: #fef2f2;
              border-radius: 6px;
              color: #991b1b;
              font-size: 12px;
              text-align: center;
            ">
              📍 GPS no activado
            </div>
          `}
        </div>
      </div>
    `;
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '12px 20px',
        zIndex: 1000,
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
              🗺️ Centro de Control - MapaQuillón
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', opacity: 0.95 }}>
              Monitoreo en tiempo real de flota y zonas de trabajo
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px' }}>
              👤 {currentUser.name || currentUser.email}
            </span>
            <button
              onClick={onLogout}
              style={{
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Cerrar Sesión
            </button>
            <span style={{ 
              background: 'rgba(255,255,255,0.2)', 
              padding: '4px 8px', 
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Panel de filtros */}
      <div style={{
        position: 'absolute',
        top: '70px',
        left: '20px',
        background: 'white',
        borderRadius: '8px',
        padding: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        display: 'flex',
        gap: '8px'
      }}>
        <button
          onClick={() => setFiltroActivo('todos')}
          style={{
            padding: '8px 12px',
            background: filtroActivo === 'todos' ? '#667eea' : '#f3f4f6',
            color: filtroActivo === 'todos' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          📍 Todos
        </button>
        <button
          onClick={() => setFiltroActivo('vehiculos')}
          style={{
            padding: '8px 12px',
            background: filtroActivo === 'vehiculos' ? '#22c55e' : '#f3f4f6',
            color: filtroActivo === 'vehiculos' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          🚛 Vehículos ({realtimeStats.vehiculos.total})
        </button>
        <button
          onClick={() => setFiltroActivo('zonas')}
          style={{
            padding: '8px 12px',
            background: filtroActivo === 'zonas' ? '#3b82f6' : '#f3f4f6',
            color: filtroActivo === 'zonas' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          🏗️ Zonas ({realtimeStats.zonas.total})
        </button>
        <button
          onClick={() => setFiltroActivo('trabajadores')}
          style={{
            padding: '8px 12px',
            background: filtroActivo === 'trabajadores' ? '#8b5cf6' : '#f3f4f6',
            color: filtroActivo === 'trabajadores' ? 'white' : '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          👷 Trabajadores ({realtimeStats.trabajadores.total})
        </button>
      </div>

      {/* Panel de estadísticas */}
      {showStats && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          background: 'white',
          borderRadius: '12px',
          padding: '15px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxWidth: '380px',
          maxHeight: '40vh',
          overflow: 'auto'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#1f2937' }}>
              📊 Estado General (Tiempo Real)
            </h3>
            <button
              onClick={() => setShowStats(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
            <div>
              <div style={{ color: '#6b7280', marginBottom: '4px' }}>🚛 Vehículos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>• Total: <strong>{realtimeStats.vehiculos.total}</strong></span>
                <span>• Activos: <strong style={{ color: '#22c55e' }}>{realtimeStats.vehiculos.activos}</strong></span>
                <span>• Mantenimiento: <strong style={{ color: '#ef4444' }}>{realtimeStats.vehiculos.enMantenimiento}</strong></span>
              </div>
            </div>
            
            <div>
              <div style={{ color: '#6b7280', marginBottom: '4px' }}>🏗️ Zonas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>• Total: <strong>{realtimeStats.zonas.total}</strong></span>
                <span>• Activas: <strong style={{ color: '#3b82f6' }}>{realtimeStats.zonas.activas}</strong></span>
                <span>• Completadas: <strong style={{ color: '#22c55e' }}>{realtimeStats.zonas.completadas}</strong></span>
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ color: '#6b7280', marginBottom: '4px' }}>👷 Trabajadores</div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <span>• Total: <strong>{realtimeStats.trabajadores.total}</strong></span>
                <span>• En ruta: <strong style={{ color: '#8b5cf6' }}>{realtimeStats.trabajadores.enRuta}</strong></span>
                <span>• Trabajando: <strong style={{ color: '#10b981' }}>{realtimeStats.trabajadores.trabajando}</strong></span>
              </div>
              <div style={{ 
                marginTop: '8px', 
                padding: '6px', 
                background: '#dcfce7', 
                borderRadius: '4px',
                fontSize: '12px',
                color: '#15803d'
              }}>
                🟢 GPS Activos: <strong>{
                  trabajadores.filter(t => {
                    const tieneUbicacion = t.ubicacion && t.ubicacion.lat && t.ubicacion.lng;
                    const esReciente = t.ubicacion?.timestamp && 
                      (new Date() - new Date(t.ubicacion.timestamp)) < 60000; // Menos de 1 minuto
                    return tieneUbicacion && esReciente;
                  }).length
                }</strong> trabajadores transmitiendo ubicación
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '11px',
            color: '#22c55e',
            fontWeight: 'bold'
          }}>
            🟢 Conectado a Firebase - Actualización en tiempo real
          </div>
        </div>
      )}

      {/* Botón para mostrar estadísticas si están ocultas */}
      {!showStats && (
        <button
          onClick={() => setShowStats(true)}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '10px 15px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 1000,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151'
          }}
        >
          📊 Mostrar estadísticas
        </button>
      )}

      {/* Mapa */}
      <div 
        ref={mapRef}
        style={{ 
          width: '100%', 
          height: '100%'
        }} 
      />

      {/* Indicador de carga */}
      {!mapLoaded && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          zIndex: 1001
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ marginTop: '10px', color: '#666' }}>Cargando mapa...</p>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MapaQuillonFirebase;