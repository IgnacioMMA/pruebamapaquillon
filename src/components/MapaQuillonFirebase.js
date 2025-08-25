  // src/components/MapaQuillonFirebase.js
  import React, { useEffect, useRef, useState } from 'react';
  import { vehiculosService, zonasService, trabajadoresService, reportesService } from '../services/firebaseservices';
  import { pdfExportService } from '../services/pdfExportService';

  const MapaQuillonFirebase = ({ currentUser, onLogout, onViewChange, currentView = 'dashboard' }) => {
  // Estados principales
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [vehiculos, setVehiculos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [zonasAsignadas, setZonasAsignadas] = useState([]);
  const showZonas = true;
  
  const [stats, setStats] = useState({
    vehiculos: { total: 0, activos: 0, enMantenimiento: 0, enUso: 0 },
    zonas: { total: 0, activas: 0, completadas: 0, pendientes: 0 },
    trabajadores: { total: 0, enRuta: 0, trabajando: 0, disponibles: 0 }
  });
  
  // Estados UI - CAMBIO: Inicializar móvil y sidebar
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeTab, setActiveTab] = useState('vehiculos');
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [centerOnUser, setCenterOnUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredItem, setHoveredItem] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showNavbar, setShowNavbar] = useState(!isMobile); // Nuevo estado para el navbar
  
  // Referencias para marcadores
  const markersRef = useRef({
    vehiculos: {},
    zonas: {},
    zonasAsignadas: {},
    trabajadores: {}
  });
  
  const infoWindowRef = useRef(null);
  const API_KEY = 'AIzaSyA7DrdL36n5cx-RNzuXGAQggFeGCheHDbY';

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Solo ocultar sidebar si cambiamos a móvil
      if (mobile && !isMobile) {
        setShowSidebar(false);
        setShowNavbar(false);
      }
      // Si cambiamos a desktop, mostrar navbar
      if (!mobile && isMobile) {
        setShowSidebar(true);
        setShowNavbar(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobile]);

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
            resolve(window.google.maps);
          });
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geometry&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.google.maps);
        script.onerror = reject;
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
          zoomControl: !isMobile,
          mapTypeControl: false,
          scaleControl: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true,
          gestureHandling: isMobile ? 'greedy' : 'auto',
          styles: [
            {
              featureType: "poi.business",
              stylers: [{ visibility: "off" }]
            },
            {
              featureType: "transit",
              elementType: "labels.icon",
              stylers: [{ visibility: "off" }]
            }
          ]
        });

        setMap(mapInstance);
        
        infoWindowRef.current = new maps.InfoWindow();
        
        const locationButton = document.createElement('button');
        locationButton.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            cursor: pointer;
            transition: all 0.3s ease;
          ">
            <span style="font-size: 22px;">📍</span>
          </div>
        `;
        locationButton.style.cssText = 'border: none; background: none; padding: 0; margin: 10px;';
        locationButton.title = 'Mi ubicación';
        
        mapInstance.controls[maps.ControlPosition.RIGHT_BOTTOM].push(locationButton);
        
        locationButton.addEventListener('click', () => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const pos = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                };
                mapInstance.setCenter(pos);
                mapInstance.setZoom(15);
              },
              () => {
                console.log('Error al obtener ubicación');
              }
            );
          }
        });
        
        setMapLoaded(true);
      } catch (err) {
        console.error('Error al cargar el mapa:', err);
      }
    };
    
    setTimeout(() => {
      if (vehiculos.length > 0) updateMarkers('vehiculos', vehiculos);
      if (zonasAsignadas.length > 0) updateMarkers('zonasAsignadas', zonasAsignadas);
      if (trabajadores.length > 0) updateMarkers('trabajadores', trabajadores);
    }, 500);

    initMap();
  }, [isMobile]);

  useEffect(() => {
    const unsubVehiculos = vehiculosService.subscribeToVehiculos((data) => {
      setVehiculos(data);
      if (filterType === 'all' || filterType === 'vehiculos') {
        updateMarkers('vehiculos', data);
      }
    });

    const unsubZonasAsignadas = zonasService.subscribeToZonasAsignadas((data) => {
      setZonasAsignadas(data);
      if (filterType === 'all' || filterType === 'zonas') {
        updateMarkers('zonasAsignadas', data);
      }
    });

    const unsubTrabajadores = trabajadoresService.subscribeToTrabajadores((data) => {
      setTrabajadores(data);
      if (filterType === 'all' || filterType === 'trabajadores') {
        updateMarkers('trabajadores', data);
      }
    });

    reportesService.getRealtimeStats((statsData) => {
      setStats(statsData);
    });

    return () => {
      unsubVehiculos();
      unsubZonasAsignadas();
      unsubTrabajadores();
    };
  }, [filterType, map]);

  
// En MapaQuillonFirebase.js, busca y reemplaza la función handleExportStatsPDF:

const handleExportStatsPDF = () => {
  // Usar los estados que SÍ existen en el componente
  const exportData = {
    stats: {
      vehiculos: {
        total: vehiculos.length,
        activos: vehiculos.filter(v => v.estado === 'disponible' || v.estado === 'en_uso').length,
        enMantenimiento: vehiculos.filter(v => v.estado === 'mantenimiento').length
      },
      zonas: {
        total: zonas.length,
        activas: zonas.filter(z => z.estado === 'activa' || z.estado === 'en_progreso').length,
        completadas: zonas.filter(z => z.estado === 'completada').length
      },
      trabajadores: {
        total: trabajadores.length,
        disponibles: trabajadores.filter(t => t.estado === 'disponible').length,
        trabajando: trabajadores.filter(t => t.estado === 'trabajando').length
      }
    },
    fecha: new Date().toISOString(),
    generadoPor: currentUser.name || currentUser.email
  };
  
  // Por ahora solo mostrar un mensaje
  console.log('Datos para exportar:', exportData);
  alert('Función de exportación PDF en desarrollo');
  
  // TODO: Implementar la exportación real cuando sea necesario
  // pdfExportService.exportStatsPDF(exportData);
};

// En el panel de estadísticas, agregar botón:
<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px'
}}>
  <h2 style={{ margin: 0, fontSize: '20px', color: '#1f2937' }}>
    📊 Estadísticas en Tiempo Real
  </h2>
  
  {/* Botón de exportación */}
  <button
    onClick={handleExportStatsPDF}
    style={{
      padding: '8px 16px',
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }}
  >
    📄 Exportar PDF
  </button>
</div>
  // Actualizar marcadores
  const updateMarkers = (type, data) => {
    if (!map || !window.google) return;

    if (type === 'zonasAsignadas' && !showZonas) {
      Object.values(markersRef.current.zonasAsignadas).forEach(marker => marker.setMap(null));
      markersRef.current.zonasAsignadas = {};
      return;
    }

    Object.values(markersRef.current[type]).forEach(marker => marker.setMap(null));
    markersRef.current[type] = {};

    if (filterType !== 'all' && filterType !== type && type !== 'zonasAsignadas') return;

    data.forEach(item => {
      let position, icon, title, content;

      switch (type) {
        case 'vehiculos':
          if (!item.lat || !item.lng) return;
          position = { lat: item.lat, lng: item.lng };
          icon = {
            url: item.tipo === 'maquinaria' ? 
              'https://maps.google.com/mapfiles/kml/shapes/mechanic.png' :
              'https://maps.google.com/mapfiles/kml/shapes/cabs.png',
            scaledSize: new window.google.maps.Size(36, 36)
          };
          title = item.nombre;
          content = `
            <div style="padding: 12px; min-width: 250px;">
              <h3 style="margin: 0 0 10px 0; color: #1e293b;">
                ${item.tipo === 'maquinaria' ? '🏗️' : '🚗'} ${item.nombre}
              </h3>
              <p style="margin: 5px 0;"><strong>Estado:</strong> ${item.estado}</p>
              <p style="margin: 5px 0;"><strong>Patente:</strong> ${item.patente || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Operador:</strong> ${item.operadorAsignado || 'Sin asignar'}</p>
            </div>
          `;
          break;

        case 'zonasAsignadas':
          if (!item.lat || !item.lng) return;
          position = { lat: item.lat, lng: item.lng };
          
          icon = {
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
            fillColor: item.estado === 'completado' ? '#22c55e' : 
                      item.estado === 'en_progreso' ? '#3b82f6' : 
                      item.prioridad === 'urgente' ? '#ef4444' :
                      item.prioridad === 'alta' ? '#f97316' : '#f59e0b',
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 2,
            anchor: new window.google.maps.Point(12, 24)
          };
          
          title = item.nombre;
          const trabajadorAsignado = trabajadores.find(t => t.id === item.trabajadorAsignado);
          
          content = `
            <div style="padding: 12px; min-width: 250px;">
              <h3 style="margin: 0 0 10px 0; color: #1e293b;">
                🏗️ ${item.nombre}
              </h3>
              <p style="margin: 5px 0;"><strong>Estado:</strong> 
                ${item.estado === 'completado' ? '✅ Completado' :
                  item.estado === 'en_progreso' ? '🔧 En Progreso' : '⏳ Pendiente'}
              </p>
              <p style="margin: 5px 0;"><strong>Dirección:</strong> ${item.direccion || 'Sin dirección'}</p>
              <p style="margin: 5px 0;"><strong>Prioridad:</strong> 
                ${item.prioridad === 'urgente' ? '🔴 Urgente' :
                  item.prioridad === 'alta' ? '🟠 Alta' :
                  item.prioridad === 'normal' ? '🟡 Normal' : '🟢 Baja'}
              </p>
              <p style="margin: 5px 0;"><strong>Trabajador:</strong> 
                ${trabajadorAsignado ? trabajadorAsignado.nombre : 'Sin asignar'}
              </p>
              ${item.descripcion ? `<p style="margin: 5px 0;"><strong>Descripción:</strong> ${item.descripcion}</p>` : ''}
            </div>
          `;
          break;

        case 'zonas':
          if (!item.lat || !item.lng) return;
          position = { lat: item.lat, lng: item.lng };
          icon = {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: item.estado === 'completado' ? '#22c55e' : 
                      item.estado === 'en_progreso' ? '#3b82f6' : '#f59e0b',
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 3
          };
          title = item.nombre;
          content = `
            <div style="padding: 12px; min-width: 250px;">
              <h3 style="margin: 0 0 10px 0; color: #1e293b;">🏗️ ${item.nombre}</h3>
              <p style="margin: 5px 0;"><strong>Estado:</strong> ${item.estado}</p>
              <p style="margin: 5px 0;"><strong>Dirección:</strong> ${item.direccion}</p>
              <p style="margin: 5px 0;"><strong>Trabajador:</strong> ${item.trabajadorAsignado || 'Sin asignar'}</p>
            </div>
          `;
          break;

        case 'trabajadores':
          if (type === 'trabajadores') {
            data.forEach(item => {
              if (!item.ubicacion || typeof item.ubicacion.lat !== 'number' || typeof item.ubicacion.lng !== 'number') {
                return;
              }

              const position = { lat: item.ubicacion.lat, lng: item.ubicacion.lng };
              
              if (markersRef.current[type][item.id]) {
                markersRef.current[type][item.id].setPosition(position);
                return;
              }

              const icon = {
                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 10,
                fillColor: item.estado === 'trabajando' ? '#22c55e' :
                            item.estado === 'en_camino' ? '#f59e0b' : '#6b7280',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
                rotation: 0
              };

              const marker = new window.google.maps.Marker({
                position,
                map,
                title: item.nombre,
                icon,
                animation: null
              });

              const content = `
                <div style="padding: 12px; min-width: 250px;">
                  <h3 style="margin: 0 0 10px 0; color: #1e293b;">👷 ${item.nombre}</h3>
                  <p style="margin: 5px 0;"><strong>Estado:</strong> ${item.estado}</p>
                  <p style="margin: 5px 0;"><strong>Zona:</strong> ${item.zonaDestino || 'Sin asignar'}</p>
                  <p style="margin: 5px 0;"><strong>Última actualización:</strong> ${new Date(item.ubicacion.timestamp).toLocaleTimeString('es-CL')}</p>
                </div>
              `;

              marker.addListener('click', () => {
                infoWindowRef.current.setContent(content);
                infoWindowRef.current.open(map, marker);
                setSelectedItem(item);
              });

              markersRef.current[type][item.id] = marker;
            });
            return;
          }
      }

      const marker = new window.google.maps.Marker({
        position,
        map,
        title,
        icon,
        animation: window.google.maps.Animation.DROP
      });

      marker.addListener('click', () => {
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(map, marker);
        setSelectedItem(item);
      });

      markersRef.current[type][item.id] = marker;
    });
  };

  // Centrar mapa en item seleccionado
  const centerOnItem = (item, type) => {
    if (!map || !item) return;

    let position;
    switch (type) {
      case 'vehiculos':
      case 'zonas':
      case 'zonasAsignadas':
        if (item.lat && item.lng) {
          position = { lat: item.lat, lng: item.lng };
        }
        break;
      case 'trabajadores':
        if (item.ubicacion && item.ubicacion.lat && item.ubicacion.lng) {
          position = { lat: item.ubicacion.lat, lng: item.ubicacion.lng };
        }
        break;
    }

    if (position) {
      map.panTo(position);
      map.setZoom(16);
      
      const marker = markersRef.current[type][item.id];
      if (marker) {
        window.google.maps.event.trigger(marker, 'click');
      }
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilterType(newFilter);
    
    ['vehiculos', 'zonas', 'zonasAsignadas', 'trabajadores'].forEach(type => {
      Object.values(markersRef.current[type]).forEach(marker => marker.setMap(null));
      markersRef.current[type] = {};
    });

    if (newFilter === 'all') {
      updateMarkers('vehiculos', vehiculos);
      updateMarkers('zonasAsignadas', zonasAsignadas);
      updateMarkers('trabajadores', trabajadores);
    } else if (newFilter === 'vehiculos') {
      updateMarkers('vehiculos', vehiculos);
    } else if (newFilter === 'zonas') {
      updateMarkers('zonasAsignadas', zonasAsignadas);
    } else if (newFilter === 'trabajadores') {
      updateMarkers('trabajadores', trabajadores);
    }
    
    if (isMobile) {
      setShowMobileFilters(false);
    }
  };

  // Filtrar items por búsqueda
  const filterBySearch = (items) => {
    if (!searchTerm) return items;
    return items.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      return (
        item.nombre?.toLowerCase().includes(searchLower) ||
        item.patente?.toLowerCase().includes(searchLower) ||
        item.direccion?.toLowerCase().includes(searchLower) ||
        item.zonaDestino?.toLowerCase().includes(searchLower)
      );
    });
  };

  const styles = {
    container: {
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'row', // Cambio: ahora es row para poner navbar a la izquierda
      background: '#f8f9fa'
    },
    
    // NUEVO: Navbar lateral
    navbar: {
      width: showNavbar ? (isMobile ? '280px' : '320px') : '0',
      minWidth: showNavbar ? (isMobile ? '280px' : '320px') : '0',
      background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      position: isMobile ? 'fixed' : 'relative',
      height: '100vh',
      zIndex: isMobile ? 1003 : 1,
      boxShadow: showNavbar ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      left: showNavbar ? '0' : (isMobile ? '-100%' : '0'),
      overflowY: 'auto'
    },
    
    navbarHeader: {
      padding: isMobile ? '16px' : '20px',
      borderBottom: '1px solid rgba(255,255,255,0.15)',
      background: 'rgba(255,255,255,0.1)',
      backdropFilter: 'blur(10px)'
    },
    
    title: {
      margin: 0,
      fontSize: isMobile ? '20px' : '24px',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      letterSpacing: '-0.5px',
      marginBottom: '16px'
    },
    
    navMenu: {
      flex: 1,
      padding: '20px 0'
    },
    
    navItem: {
      width: '100%',
      padding: '16px 24px',
      background: 'transparent',
      color: 'white',
      border: 'none',
      borderLeft: '4px solid transparent',
      cursor: 'pointer',
      fontSize: '15px',
      fontWeight: '500',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      textAlign: 'left'
    },
    
    navItemActive: {
      background: 'rgba(255,255,255,0.15)',
      borderLeftColor: 'white',
      fontWeight: '600'
    },
    
    navItemHover: {
      background: 'rgba(255,255,255,0.1)',
      borderLeftColor: 'rgba(255,255,255,0.5)'
    },
    
    navFooter: {
      padding: '20px',
      borderTop: '1px solid rgba(255,255,255,0.15)'
    },
    
    userInfo: {
      marginBottom: '16px',
      padding: '12px',
      background: 'rgba(255,255,255,0.1)',
      borderRadius: '10px',
      fontSize: '14px'
    },
    
    logoutButton: {
      width: '100%',
      padding: '12px 16px',
      background: 'rgba(239, 68, 68, 0.9)',
      backdropFilter: 'blur(10px)',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    },

    mainContent: {
      flex: 1,
      display: 'flex',
      position: 'relative',
      overflow: 'hidden'
    },
    
    // Botón para mostrar/ocultar navbar (solo móvil y desktop)
    navbarToggle: {
      position: 'fixed',
      left: showNavbar ? (isMobile ? '290px' : '330px') : '10px',
      top: '20px',
      background: 'white',
      border: 'none',
      borderRadius: showNavbar ? '0 12px 12px 0' : '12px',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      cursor: 'pointer',
      zIndex: 1004,
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#667eea',
      fontSize: '20px'
    },
    
    mobileOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 1002,
      display: showNavbar && isMobile ? 'block' : 'none'
    },

    sidebar: {
      width: showSidebar ? (isMobile ? '85%' : '380px') : '0',
      maxWidth: isMobile ? '320px' : '380px',
      background: 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)',
      borderRight: showSidebar ? '1px solid rgba(0,0,0,0.08)' : 'none',
      overflowY: 'auto',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: isMobile ? 'fixed' : 'relative',
      height: isMobile ? '100vh' : '100%',
      top: 0,
      left: showSidebar ? '0' : (isMobile ? '-100%' : '0'),
      zIndex: isMobile ? 999 : 1,
      boxShadow: showSidebar ? '4px 0 20px rgba(0,0,0,0.08)' : 'none',
      transition: 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1), width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    sidebarContent: {
      width: isMobile ? '100%' : '380px',
      opacity: showSidebar ? 1 : 0,
      transition: 'opacity 0.3s ease',
      pointerEvents: showSidebar ? 'auto' : 'none'
    },
    sidebarHeader: {
      padding: isMobile ? '16px' : '20px',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)'
    },
    searchBar: {
      width: '100%',
      padding: '12px 16px',
      border: '2px solid #e2e8f0',
      borderRadius: '12px',
      fontSize: '14px',
      outline: 'none',
      transition: 'all 0.3s ease',
      marginBottom: '16px',
      background: 'white'
    },
    mobileFilterToggle: {
      width: '100%',
      padding: '10px',
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'all 0.3s ease'
    },
    mobileFiltersContainer: {
      overflow: 'hidden',
      maxHeight: showMobileFilters ? '200px' : '0',
      transition: 'max-height 0.3s ease-in-out',
      marginBottom: showMobileFilters ? '16px' : '0'
    },
    filterButtons: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '10px',
      marginBottom: '16px'
    },
    filterButton: {
      padding: isMobile ? '10px' : '12px',
      borderRadius: '12px',
      border: '2px solid #e2e8f0',
      background: 'white',
      cursor: 'pointer',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: '500',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      color: '#64748b'
    },
    filterButtonActive: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      borderColor: 'transparent',
      transform: 'scale(1.02)',
      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '12px',
      marginTop: '16px'
    },
    statCard: {
      padding: '12px',
      background: 'white',
      borderRadius: '14px',
      border: '1px solid rgba(0,0,0,0.06)',
      textAlign: 'center',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer'
    },
    statNumber: {
      fontSize: '20px',
      fontWeight: '700',
      color: '#1e293b',
      marginBottom: '2px'
    },
    statLabel: {
      fontSize: '10px',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
      fontWeight: '600'
    },
    tabs: {
      display: 'flex',
      borderBottom: '2px solid #f1f5f9',
      background: 'white',
      padding: '0 20px',
      gap: '8px',
      position: 'sticky',
      top: 0,
      zIndex: 10
    },
    tab: {
      flex: 1,
      padding: '14px 8px',
      background: 'transparent',
      border: 'none',
      borderBottom: '3px solid transparent',
      cursor: 'pointer',
      fontSize: isMobile ? '13px' : '14px',
      color: '#64748b',
      fontWeight: '500',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      position: 'relative'
    },
    tabActive: {
      color: '#667eea',
      borderBottomColor: '#667eea',
      fontWeight: '600',
      background: 'linear-gradient(180deg, rgba(102, 126, 234, 0.05) 0%, transparent 100%)'
    },
    listContainer: {
      padding: '16px',
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden'
    },
    listItem: {
      padding: '14px',
      marginBottom: '10px',
      background: 'white',
      border: '1px solid rgba(0,0,0,0.06)',
      borderRadius: '12px',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden'
    },
    listItemHover: {
      transform: 'translateY(-2px) scale(1.01)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
      borderColor: '#667eea'
    },
    listItemHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px',
      gap: '8px'
    },
    listItemTitle: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#1e293b',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    listItemBadge: {
      padding: '3px 8px',
      borderRadius: '6px',
      fontSize: '10px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
      flexShrink: 0
    },
    listItemDetails: {
      fontSize: '12px',
      color: '#64748b',
      lineHeight: '1.5',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px'
    },
    map: {
      flex: 1,
      position: 'relative'
    },
    toggleSidebarButton: {
      position: 'fixed',
      left: showSidebar ? '390px' : '10px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'white',
      border: 'none',
      borderRadius: showSidebar ? '0 12px 12px 0' : '12px',
      padding: '16px 8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      zIndex: 1002,
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    legend: {
      position: 'absolute',
      bottom: isMobile ? '60px' : '20px',
      left: '20px',
      borderRadius: '14px',
      padding: '16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      zIndex: 900,
      fontSize: isMobile ? '12px' : '13px',
      minWidth: '180px',
      backdropFilter: 'blur(10px)',
      background: 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(0,0,0,0.06)',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    legendToggleButton: {
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      background: 'white',
      borderRadius: '12px',
      padding: '10px 14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      zIndex: 901,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13px',
      fontWeight: '500',
      color: '#64748b',
      border: '1px solid rgba(0,0,0,0.06)',
      transition: 'all 0.3s ease'
    },
    legendTitle: {
      fontWeight: '700',
      marginBottom: '12px',
      color: '#1e293b',
      fontSize: '14px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '8px',
      padding: '4px 0'
    },
    legendIcon: {
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      flexShrink: 0
    },
    mobileBottomNav: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'white',
      borderTop: '1px solid rgba(0,0,0,0.08)',
      display: 'flex',
      padding: '8px',
      gap: '8px',
      zIndex: 1000,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.08)'
    },
    mobileNavButton: {
      flex: 1,
      padding: '10px',
      background: '#f8f9fa',
      border: 'none',
      borderRadius: '10px',
      fontSize: '11px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      fontWeight: '500',
      transition: 'all 0.3s ease',
      color: '#64748b'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: '#64748b'
    },
    emptyIcon: {
      fontSize: '48px',
      marginBottom: '16px',
      opacity: 0.5
    },
    loadingOverlay: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      zIndex: 1000
    },
    spinner: {
      width: '50px',
      height: '50px',
      border: '4px solid #f3f4f6',
      borderTop: '4px solid #667eea',
      borderRadius: '50%',
      animation: 'spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
    }
  };

  return (
    <div style={styles.container}>
      {/* Overlay para móvil cuando navbar está abierto */}
      {isMobile && (
        <div 
          style={styles.mobileOverlay}
          onClick={() => setShowNavbar(false)}
        />
      )}

      {/* Botón para mostrar/ocultar navbar */}
      <button
        onClick={() => setShowNavbar(!showNavbar)}
        style={styles.navbarToggle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }}
      >
        <span style={{ 
          fontSize: '20px',
          transition: 'transform 0.3s ease',
          display: 'inline-block',
          transform: showNavbar ? 'rotate(180deg)' : 'rotate(0deg)'
        }}>
          ☰
        </span>
      </button>

      {/* Navbar lateral */}
      <div style={styles.navbar}>
        {/* Header del navbar */}
        <div style={styles.navbarHeader}>
          <h1 style={styles.title}>
            📊 {isMobile ? 'Dashboard GPS' : 'MapaQuillón Dashboard'}
          </h1>
          
          {/* Cerrar en móvil */}
          {isMobile && (
            <button
              onClick={() => setShowNavbar(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                padding: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Menú de navegación */}
        <div style={styles.navMenu}>
          <button
            onClick={() => {
              onViewChange('dashboard');
              if (isMobile) setShowNavbar(false);
            }}
            style={{
              ...styles.navItem,
              ...(currentView === 'dashboard' ? styles.navItemActive : {})
            }}
            onMouseEnter={(e) => {
              if (currentView !== 'dashboard') {
                Object.assign(e.currentTarget.style, styles.navItemHover);
              }
            }}
            onMouseLeave={(e) => {
              if (currentView !== 'dashboard') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderLeftColor = 'transparent';
              }
            }}
          >
            <span style={{ fontSize: '18px' }}>📊</span>
            Dashboard GPS
          </button>

          <button
            onClick={() => {
              onViewChange('zones');
              if (isMobile) setShowNavbar(false);
            }}
            style={{
              ...styles.navItem,
              ...(currentView === 'zones' ? styles.navItemActive : {})
            }}
            onMouseEnter={(e) => {
              if (currentView !== 'zones') {
                Object.assign(e.currentTarget.style, styles.navItemHover);
              }
            }}
            onMouseLeave={(e) => {
              if (currentView !== 'zones') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderLeftColor = 'transparent';
              }
            }}
          >
            <span style={{ fontSize: '18px' }}>🗺️</span>
            Gestión de Zonas
          </button>

          <button
            onClick={() => {
              onViewChange('fleet');
              if (isMobile) setShowNavbar(false);
            }}
            style={{
              ...styles.navItem,
              ...(currentView === 'fleet' ? styles.navItemActive : {})
            }}
            onMouseEnter={(e) => {
              if (currentView !== 'fleet') {
                Object.assign(e.currentTarget.style, styles.navItemHover);
              }
            }}
            onMouseLeave={(e) => {
              if (currentView !== 'fleet') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderLeftColor = 'transparent';
              }
            }}
          >
            <span style={{ fontSize: '18px' }}>🚛</span>
            Panel de Flota
          </button>

          {currentUser?.role === 'superadmin' && (
            <button
              onClick={() => {
                onViewChange('admin');
                if (isMobile) setShowNavbar(false);
              }}
              style={{
                ...styles.navItem,
                ...(currentView === 'admin' ? styles.navItemActive : {})
              }}
              onMouseEnter={(e) => {
                if (currentView !== 'admin') {
                  Object.assign(e.currentTarget.style, styles.navItemHover);
                }
              }}
              onMouseLeave={(e) => {
                if (currentView !== 'admin') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderLeftColor = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '18px' }}>🔐</span>
              Panel Admin
            </button>
          )}
        </div>

        {/* Footer del navbar */}
        <div style={styles.navFooter}>
          <div style={styles.userInfo}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
              👤 {currentUser?.name || 'Usuario'}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              {currentUser?.email}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
              Rol: {currentUser?.role}
            </div>
          </div>
          
          <button 
            onClick={onLogout} 
            style={styles.logoutButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
            }}
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div style={styles.mainContent}>
        {/* Overlay para móvil cuando sidebar está abierto */}
        {isMobile && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 998,
              display: showSidebar && isMobile ? 'block' : 'none'
            }}
            onClick={() => setShowSidebar(false)}
          />
        )}
        
        {/* Botón flotante para panel lateral (data panel) en móvil */}
        {isMobile && (
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            style={{
              position: 'fixed',
              right: '10px',
              top: '80px',
              background: showSidebar ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'white',
              border: 'none',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              zIndex: 1002,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              color: showSidebar ? 'white' : '#667eea'
            }}
          >
            <span style={{ 
              fontSize: '24px',
              transition: 'transform 0.3s ease',
              display: 'inline-block'
            }}>
              {showSidebar ? '✕' : '📊'}
            </span>
          </button>
        )}

        {/* Sidebar del panel de datos */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarContent}>
            {/* Header del sidebar para móvil */}
            {isMobile && showSidebar && (
              <div style={{
                padding: '10px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'white'
              }}>
                <span style={{ fontWeight: '600', fontSize: '16px' }}>
                  📊 Panel de Control
                </span>
                <button
                  onClick={() => setShowSidebar(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '5px',
                    color: '#6b7280'
                  }}
                >
                  ✕
                </button>
              </div>
            )}
            
            <div style={styles.sidebarHeader}>
              {/* Barra de búsqueda */}
              <input
                type="text"
                placeholder="🔍 Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchBar}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />

              {/* Botón para mostrar/ocultar filtros en móvil */}
              {isMobile && (
                <button
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  style={styles.mobileFilterToggle}
                >
                  <span style={{ fontSize: '16px' }}>🎯</span>
                  {showMobileFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                  <span style={{ 
                    transform: showMobileFilters ? 'rotate(180deg)' : 'rotate(0)', 
                    transition: 'transform 0.3s ease' 
                  }}>
                    ▼
                  </span>
                </button>
              )}

              {/* Contenedor de filtros */}
              {isMobile ? (
                <div style={styles.mobileFiltersContainer}>
                  <div style={styles.filterButtons}>
                    <button
                      onClick={() => handleFilterChange('all')}
                      style={{
                        ...styles.filterButton,
                        ...(filterType === 'all' ? styles.filterButtonActive : {})
                      }}
                    >
                      🌐 Todo
                    </button>
                    <button
                      onClick={() => handleFilterChange('vehiculos')}
                      style={{
                        ...styles.filterButton,
                        ...(filterType === 'vehiculos' ? styles.filterButtonActive : {})
                      }}
                    >
                      🚛 Vehículos
                    </button>
                    <button
                      onClick={() => handleFilterChange('zonas')}
                      style={{
                        ...styles.filterButton,
                        ...(filterType === 'zonas' ? styles.filterButtonActive : {})
                      }}
                    >
                      🏗️ Zonas
                    </button>
                    <button
                      onClick={() => handleFilterChange('trabajadores')}
                      style={{
                        ...styles.filterButton,
                        ...(filterType === 'trabajadores' ? styles.filterButtonActive : {})
                      }}
                    >
                      👷 Trabajadores
                    </button>
                  </div>
                </div>
              ) : (
                // Filtros normales para desktop
                <div style={styles.filterButtons}>
                  <button
                    onClick={() => handleFilterChange('all')}
                    style={{
                      ...styles.filterButton,
                      ...(filterType === 'all' ? styles.filterButtonActive : {})
                    }}
                  >
                    🌐 Todo
                  </button>
                  <button
                    onClick={() => handleFilterChange('vehiculos')}
                    style={{
                      ...styles.filterButton,
                      ...(filterType === 'vehiculos' ? styles.filterButtonActive : {})
                    }}
                  >
                    🚛 Vehículos
                  </button>
                  <button
                    onClick={() => handleFilterChange('zonas')}
                    style={{
                      ...styles.filterButton,
                      ...(filterType === 'zonas' ? styles.filterButtonActive : {})
                    }}
                  >
                    🏗️ Zonas
                  </button>
                  <button
                    onClick={() => handleFilterChange('trabajadores')}
                    style={{
                      ...styles.filterButton,
                      ...(filterType === 'trabajadores' ? styles.filterButtonActive : {})
                    }}
                  >
                    👷 Trabajadores
                  </button>
                </div>
              )}

              {/* Estadísticas mejoradas */}
              <div style={styles.statsGrid}>
                <div 
                  style={styles.statCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={styles.statNumber}>{stats.vehiculos.activos}</div>
                  <div style={styles.statLabel}>Vehículos Activos</div>
                </div>
                <div 
                  style={styles.statCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={styles.statNumber}>{stats.zonas.activas}</div>
                  <div style={styles.statLabel}>Zonas Activas</div>
                </div>
                <div 
                  style={styles.statCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={styles.statNumber}>{stats.trabajadores.enRuta + stats.trabajadores.trabajando}</div>
                  <div style={styles.statLabel}>Trabajando</div>
                </div>
                <div 
                  style={styles.statCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={styles.statNumber}>{stats.vehiculos.enMantenimiento}</div>
                  <div style={styles.statLabel}>Mantenimiento</div>
                </div>
                <div 
                  style={styles.statCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={styles.statNumber}>{stats.zonas.completadas}</div>
                  <div style={styles.statLabel}>Completadas</div>
                </div>
                <div 
                  style={styles.statCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={styles.statNumber}>{stats.trabajadores.disponibles}</div>
                  <div style={styles.statLabel}>Disponibles</div>
                </div>
              </div>
            </div>

            {/* Tabs mejorados */}
            <div style={styles.tabs}>
              <button
                onClick={() => setActiveTab('vehiculos')}
                style={{
                  ...styles.tab,
                  ...(activeTab === 'vehiculos' ? styles.tabActive : {})
                }}
              >
                🚛 Vehículos
              </button>
              <button
                onClick={() => setActiveTab('zonas')}
                style={{
                  ...styles.tab,
                  ...(activeTab === 'zonas' ? styles.tabActive : {})
                }}
              >
                🏗️ Zonas
              </button>
              <button
                onClick={() => setActiveTab('trabajadores')}
                style={{
                  ...styles.tab,
                  ...(activeTab === 'trabajadores' ? styles.tabActive : {})
                }}
              >
                👷 Trabajadores
              </button>
            </div>

            {/* Lista de items mejorada */}
            <div style={styles.listContainer}>
              {activeTab === 'vehiculos' && (
                filterBySearch(vehiculos).length > 0 ? (
                  filterBySearch(vehiculos).map(vehiculo => (
                    <div
                      key={vehiculo.id}
                      style={{
                        ...styles.listItem,
                        ...(hoveredItem === vehiculo.id ? styles.listItemHover : {})
                      }}
                      onClick={() => {
                        centerOnItem(vehiculo, 'vehiculos');
                        if (isMobile) setShowSidebar(false);
                      }}
                      onMouseEnter={() => setHoveredItem(vehiculo.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <div style={styles.listItemHeader}>
                        <span style={styles.listItemTitle}>
                          {vehiculo.tipo === 'maquinaria' ? '🏗️' : '🚗'} {vehiculo.nombre}
                        </span>
                        <span style={{
                          ...styles.listItemBadge,
                          background: vehiculo.estado === 'disponible' ? 
                            'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' :
                            vehiculo.estado === 'en_uso' ? 
                            'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' :
                            vehiculo.estado === 'mantenimiento' ? 
                            'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : 
                            'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                          color: vehiculo.estado === 'disponible' ? '#166534' :
                                  vehiculo.estado === 'en_uso' ? '#1e40af' :
                                  vehiculo.estado === 'mantenimiento' ? '#92400e' : '#991b1b'
                        }}>
                          {vehiculo.estado === 'disponible' ? 'DISPONIBLE' :
                            vehiculo.estado === 'en_uso' ? 'EN USO' :
                            vehiculo.estado === 'mantenimiento' ? 'MANTENIM.' : 'FUERA'}
                        </span>
                      </div>
                      <div style={styles.listItemDetails}>
                        <div>📌 Patente: {vehiculo.patente || 'N/A'}</div>
                        <div>👤 {vehiculo.operadorAsignado || 'Sin asignar'}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>🚛</div>
                    <p>No se encontraron vehículos</p>
                  </div>
                )
              )}

              {activeTab === 'zonas' && (
                filterBySearch(zonasAsignadas).length > 0 ? (
                  filterBySearch(zonasAsignadas).map(zona => (
                    <div
                      key={zona.id}
                      style={{
                        ...styles.listItem,
                        ...(hoveredItem === zona.id ? styles.listItemHover : {})
                      }}
                      onClick={() => {
                        centerOnItem(zona, 'zonasAsignadas');
                        if (isMobile) setShowSidebar(false);
                      }}
                      onMouseEnter={() => setHoveredItem(zona.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <div style={styles.listItemHeader}>
                        <span style={styles.listItemTitle}>
                          🏗️ {zona.nombre}
                        </span>
                        <span style={{
                          ...styles.listItemBadge,
                          background: zona.estado === 'completado' ? 
                            'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' :
                            zona.estado === 'en_progreso' ? 
                            'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : 
                            'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                          color: zona.estado === 'completado' ? '#166534' :
                                  zona.estado === 'en_progreso' ? '#1e40af' : '#92400e'
                        }}>
                          {zona.estado === 'completado' ? 'COMPLETADO' :
                            zona.estado === 'en_progreso' ? 'EN PROGRESO' : 'PENDIENTE'}
                        </span>
                      </div>
                      <div style={styles.listItemDetails}>
                        <div>📍 {zona.direccion}</div>
                        <div>👷 {zona.trabajadorAsignado || 'Sin asignar'}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>🏗️</div>
                    <p>No se encontraron zonas</p>
                  </div>
                )
              )}

              {activeTab === 'trabajadores' && (
                (() => {
                  const activeTrabajadores = filterBySearch(trabajadores).filter(t => 
                    t.ubicacion && (new Date() - new Date(t.ubicacion.timestamp)) < 300000
                  );
                  
                  return activeTrabajadores.length > 0 ? (
                    activeTrabajadores.map(trabajador => (
                      <div
                        key={trabajador.id}
                        style={{
                          ...styles.listItem,
                          ...(hoveredItem === trabajador.id ? styles.listItemHover : {})
                        }}
                        onClick={() => {
                          centerOnItem(trabajador, 'trabajadores');
                          if (isMobile) setShowSidebar(false);
                        }}
                        onMouseEnter={() => setHoveredItem(trabajador.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        <div style={styles.listItemHeader}>
                          <span style={styles.listItemTitle}>
                            👷 {trabajador.nombre}
                          </span>
                          <span style={{
                            ...styles.listItemBadge,
                            background: trabajador.estado === 'trabajando' ? 
                              'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' :
                              trabajador.estado === 'en_camino' ? 
                              'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : 
                              'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                            color: trabajador.estado === 'trabajando' ? '#166534' :
                                    trabajador.estado === 'en_camino' ? '#92400e' : '#6b7280'
                          }}>
                            {trabajador.estado === 'trabajando' ? 'TRABAJANDO' :
                              trabajador.estado === 'en_camino' ? 'EN CAMINO' : 'DISPONIBLE'}
                          </span>
                        </div>
                        <div style={styles.listItemDetails}>
                          <div>📍 {trabajador.zonaDestino || 'Sin asignar'}</div>
                          <div>🕐 {new Date(trabajador.ubicacion.timestamp).toLocaleTimeString('es-CL')}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={styles.emptyState}>
                      <div style={styles.emptyIcon}>👷</div>
                      <p>No hay trabajadores activos</p>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* Mapa */}
        <div style={styles.map}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          
          {/* Solo mostrar toggle sidebar en desktop */}
          {!isMobile && (
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              style={styles.toggleSidebarButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
            >
              <span style={{ 
                fontSize: '20px',
                transition: 'transform 0.3s ease',
                display: 'inline-block',
                transform: showSidebar ? 'rotate(0deg)' : 'rotate(180deg)'
              }}>
                ◀
              </span>
            </button>
          )}

          {/* Leyenda mejorada con botón para mostrar/ocultar */}
          {!isMobile && (
            <>
              {!showLegend && (
                <button
                  onClick={() => setShowLegend(true)}
                  style={styles.legendToggleButton}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                >
                  📍 Mostrar Leyenda
                </button>
              )}
              
              {showLegend && (
                <div style={styles.legend}>
                  <div style={styles.legendTitle}>
                    Leyenda
                    <button
                      onClick={() => setShowLegend(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        color: '#64748b',
                        padding: '0',
                        transition: 'transform 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={styles.legendItem}>
                    <div style={{ ...styles.legendIcon, background: '#22c55e' }} />
                    <span>Activo/Completado</span>
                  </div>
                  <div style={styles.legendItem}>
                    <div style={{ ...styles.legendIcon, background: '#3b82f6' }} />
                    <span>En Progreso</span>
                  </div>
                  <div style={styles.legendItem}>
                    <div style={{ ...styles.legendIcon, background: '#f59e0b' }} />
                    <span>Pendiente/En Camino</span>
                  </div>
                  <div style={styles.legendItem}>
                    <div style={{ ...styles.legendIcon, background: '#6b7280' }} />
                    <span>Inactivo</span>
                  </div>
                  {showZonas && (
                    <>
                      <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '8px', paddingTop: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                          ZONAS DE TRABAJO
                        </div>
                        <div style={styles.legendItem}>
                          <div style={{ ...styles.legendIcon, background: '#ef4444' }} />
                          <span>Urgente</span>
                        </div>
                        <div style={styles.legendItem}>
                          <div style={{ ...styles.legendIcon, background: '#f97316' }} />
                          <span>Alta Prioridad</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Loading mejorado */}
          {!mapLoaded && (
            <div style={styles.loadingOverlay}>
              <div style={styles.spinner}></div>
              <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>
                Cargando mapa...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navegación inferior móvil - Solo para navegación entre vistas */}
      {isMobile && onViewChange && (
        <div style={styles.mobileBottomNav}>
          <button
            onClick={() => onViewChange('dashboard')}
            style={{
              ...styles.mobileNavButton,
              background: currentView === 'dashboard' ? 
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
              color: currentView === 'dashboard' ? 'white' : '#64748b'
            }}
          >
            <span style={{ fontSize: '18px' }}>📊</span>
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => onViewChange('zones')}
            style={{
              ...styles.mobileNavButton,
              background: currentView === 'zones' ? 
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
              color: currentView === 'zones' ? 'white' : '#64748b'
            }}
          >
            <span style={{ fontSize: '18px' }}>🗺️</span>
            <span>Zonas</span>
          </button>
          <button
            onClick={() => onViewChange('fleet')}
            style={{
              ...styles.mobileNavButton,
              background: currentView === 'fleet' ? 
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
              color: currentView === 'fleet' ? 'white' : '#64748b'
            }}
          >
            <span style={{ fontSize: '18px' }}>🚛</span>
            <span>Flota</span>
          </button>
          {currentUser?.role === 'superadmin' && (
            <button
              onClick={() => onViewChange('admin')}
              style={{
                ...styles.mobileNavButton,
                background: currentView === 'admin' ? 
                  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
                color: currentView === 'admin' ? 'white' : '#64748b'
              }}
            >
              <span style={{ fontSize: '18px' }}>🔐</span>
              <span>Admin</span>
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        ::-webkit-scrollbar {
          width: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%);
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
        }
      `}</style>
    </div>
  );
  };

  export default MapaQuillonFirebase;