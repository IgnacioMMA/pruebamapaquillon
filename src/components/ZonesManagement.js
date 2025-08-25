// src/components/ZonesManagement.js
import React, { useState, useEffect, useRef } from 'react';
import { database } from '../config/firebase';
import { ref, push, set, update, remove, onValue } from 'firebase/database';

const ZonesManagement = ({ currentUser, onLogout, onViewChange, currentView = 'zones' }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [zonas, setZonas] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [selectedZona, setSelectedZona] = useState(null);
  const [isCreatingZona, setIsCreatingZona] = useState(false);
  const [showZonaForm, setShowZonaForm] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // all, pendiente, en_progreso, completado
  const [showCompletedZones, setShowCompletedZones] = useState(false);
  const [mobileFormView, setMobileFormView] = useState(false);

  // Form states
  const [newZona, setNewZona] = useState({
    nombre: '',
    descripcion: '',
    direccion: '',
    lat: null,
    lng: null,
    trabajadorAsignado: '',
    prioridad: 'normal',
    fechaLimite: '',
    estado: 'pendiente'
  });

  const markersRef = useRef({});
  const mapClickListenerRef = useRef(null);
  const API_KEY = 'AIzaSyA7DrdL36n5cx-RNzuXGAQggFeGCheHDbY';

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth <= 768) {
        setShowPanel(false); // Ocultar panel por defecto en móvil
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  // Cargar Google Maps
  useEffect(() => {
    const loadGoogleMaps = () => {
      return new Promise((resolve) => {
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
        document.head.appendChild(script);
      });
    };

    const initMap = async () => {
      const maps = await loadGoogleMaps();

      if (!mapRef.current) return;

      const mapInstance = new maps.Map(mapRef.current, {
        center: { lat: -36.7333, lng: -72.4667 },
        zoom: 13,
        mapTypeId: 'roadmap',
        zoomControl: !isMobile,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: isMobile ? 'greedy' : 'auto'
      });

      // Agregar botón de ubicación actual
      const locationButton = document.createElement('button');
      locationButton.innerHTML = `
        <div style="
          background: white;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        ">
          <span style="font-size: 20px;">📍</span>
        </div>
      `;
      locationButton.style.cssText = 'border: none; background: none; padding: 5px; margin: 10px;';
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
            }
          );
        }
      });

      setMap(mapInstance);
      setMapLoaded(true);
    };

    initMap();
  }, [isMobile]);

  // Verificar si hay datos de solicitud pendiente
  useEffect(() => {
    const solicitudData = localStorage.getItem('solicitudParaZona');
    if (solicitudData) {
      const solicitud = JSON.parse(solicitudData);

      setNewZona({
        nombre: solicitud.nombre,
        descripcion: solicitud.descripcion,
        direccion: solicitud.direccion,
        lat: solicitud.lat,
        lng: solicitud.lng,
        trabajadorAsignado: '',
        prioridad: solicitud.prioridad || 'normal',
        fechaLimite: solicitud.fechaLimite || '',
        estado: 'pendiente'
      });

      setShowZonaForm(true);
      setShowPanel(true);

      if (map && window.google) {
        const tempMarker = new window.google.maps.Marker({
          position: { lat: solicitud.lat, lng: solicitud.lng },
          map: map,
          title: 'Nueva zona desde solicitud',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#ef4444',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          temp: true
        });

        markersRef.current.temp = tempMarker;
        map.setCenter({ lat: solicitud.lat, lng: solicitud.lng });
        map.setZoom(16);
      }

      localStorage.removeItem('solicitudParaZona');
    }
  }, [map]);

  // Cargar zonas y trabajadores desde Firebase
  useEffect(() => {
    const zonasRef = ref(database, 'zonas_asignadas');
    const unsubZonas = onValue(zonasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const zonasArray = Object.entries(data).map(([id, zona]) => ({
          id,
          ...zona
        }));
        setZonas(zonasArray);
      } else {
        setZonas([]);
      }
    });

    const trabajadoresRef = ref(database, 'trabajadores');
    const unsubTrabajadores = onValue(trabajadoresRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const trabajadoresArray = Object.entries(data).map(([id, trabajador]) => ({
          id,
          ...trabajador
        }));
        setTrabajadores(trabajadoresArray);
      } else {
        setTrabajadores([]);
      }
    });

    return () => {
      unsubZonas();
      unsubTrabajadores();
    };
  }, []);

  // Actualizar marcadores en el mapa
  useEffect(() => {
    if (!map || !window.google) return;

    // Limpiar marcadores anteriores
    Object.values(markersRef.current).forEach(marker => {
      if (marker && !marker.temp) marker.setMap(null);
    });

    const newMarkers = {};

    // Filtrar zonas según el estado seleccionado
    const zonasToShow = zonas.filter(zona => {
      if (filterStatus === 'all') {
        return !zona.estado || zona.estado !== 'completado' || showCompletedZones;
      }
      if (filterStatus === 'completado') {
        return zona.estado === 'completado';
      }
      return zona.estado === filterStatus;
    });

    // Crear marcadores para cada zona
    zonasToShow.forEach(zona => {
      const isCompleted = zona.estado === 'completado';
      const opacity = isCompleted && !showCompletedZones ? 0.5 : 1;

      const marker = new window.google.maps.Marker({
        position: { lat: zona.lat, lng: zona.lng },
        map: map,
        title: zona.nombre,
        opacity: opacity,
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
          fillColor: zona.estado === 'completado' ? '#22c55e' :
            zona.estado === 'en_progreso' ? '#3b82f6' :
              zona.prioridad === 'urgente' ? '#ef4444' :
                zona.prioridad === 'alta' ? '#f97316' : '#f59e0b',
          fillOpacity: opacity,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 2,
          anchor: new window.google.maps.Point(12, 24)
        }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 10px 0;">${zona.nombre}</h3>
            <p style="margin: 5px 0;"><strong>Dirección:</strong> ${zona.direccion}</p>
            <p style="margin: 5px 0;"><strong>Descripción:</strong> ${zona.descripcion || 'Sin descripción'}</p>
            <p style="margin: 5px 0;"><strong>Trabajador:</strong> ${zona.trabajadorAsignado ?
            trabajadores.find(t => t.id === zona.trabajadorAsignado)?.nombre || 'Sin asignar' :
            'Sin asignar'
          }</p>
            <p style="margin: 5px 0;"><strong>Estado:</strong> ${zona.estado || 'pendiente'}</p>
            <p style="margin: 5px 0;"><strong>Prioridad:</strong> ${zona.prioridad || 'normal'}</p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
        setSelectedZona(zona);
      });

      newMarkers[zona.id] = marker;
    });

    // Mantener el marcador temporal si existe
    if (markersRef.current.temp) {
      newMarkers.temp = markersRef.current.temp;
    }

    markersRef.current = newMarkers;
  }, [map, zonas, trabajadores, filterStatus, showCompletedZones]);

  // Activar modo creación de zona
  const startCreatingZona = () => {
    if (!map) return;

    setIsCreatingZona(true);
    setShowPanel(false); // Ocultar panel para tener más espacio en el mapa
    map.setOptions({ draggableCursor: 'crosshair' });

    // Mostrar mensaje de instrucciones
    const instructionDiv = document.createElement('div');
    instructionDiv.id = 'map-instruction';
    instructionDiv.style.cssText = `
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 1000;
    font-size: 14px;
    font-weight: 500;
  `;
    instructionDiv.innerHTML = '📍 Haz clic en el mapa para seleccionar la ubicación';
    map.getDiv().appendChild(instructionDiv);

    // Crear una función handler que se pueda remover
    const handleMapClick = (event) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      // Remover el listener inmediatamente
      if (mapClickListenerRef.current) {
        window.google.maps.event.removeListener(mapClickListenerRef.current);
        mapClickListenerRef.current = null;
      }

      // Restaurar cursor normal
      map.setOptions({ draggableCursor: null });

      // Remover instrucciones anteriores
      const instruction = document.getElementById('map-instruction');
      if (instruction) {
        instruction.remove();
      }

      // Crear marcador temporal
      if (markersRef.current.temp) {
        markersRef.current.temp.setMap(null);
      }

      const tempMarker = new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: 'Nueva zona',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#ef4444',
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        temp: true,
        draggable: true
      });

      markersRef.current.temp = tempMarker;

      // Actualizar coordenadas
      setNewZona(prev => ({
        ...prev,
        lat,
        lng,
        direccion: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      }));

      // Crear botón de confirmación flotante
      const confirmDiv = document.createElement('div');
      confirmDiv.id = 'confirm-location';
      confirmDiv.style.cssText = `
      position: absolute;
      bottom: ${isMobile ? '80px' : '30px'};
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 15px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    `;

      confirmDiv.innerHTML = `
      <div style="font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 5px;">
        📍 Ubicación seleccionada
      </div>
      <div style="display: flex; gap: 10px;">
        <button id="confirm-btn" style="
          padding: 10px 20px;
          background: #22c55e;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        ">
          ✅ Confirmar y Continuar
        </button>
        <button id="cancel-btn" style="
          padding: 10px 20px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        ">
          ❌ Cancelar
        </button>
      </div>
    `;

      map.getDiv().appendChild(confirmDiv);

      // En el evento del botón confirmar, cambia esta parte:
      document.getElementById('confirm-btn').addEventListener('click', () => {
        // Remover el div de confirmación
        confirmDiv.remove();

        // Establecer que ya no estamos creando
        setIsCreatingZona(false);

        // Obtener dirección
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results[0]) {
            setNewZona(prev => ({
              ...prev,
              direccion: results[0].formatted_address
            }));
          }
        });

        // Si es móvil, mostrar vista de formulario completa
        if (isMobile) {
          setMobileFormView(true);
        } else {
          // Desktop: mostrar normal
          setShowZonaForm(true);
          setShowPanel(true);
        }
      });

      document.getElementById('cancel-btn').addEventListener('click', () => {
        // Limpiar todo
        confirmDiv.remove();
        if (markersRef.current.temp) {
          markersRef.current.temp.setMap(null);
          delete markersRef.current.temp;
        }
        setIsCreatingZona(false);
        setShowPanel(true);
      });
    };

    // Agregar el listener
    mapClickListenerRef.current = map.addListener('click', handleMapClick);
  };

  // Cancelar modo creación
  const cancelCreatingZona = () => {
    setIsCreatingZona(false);
    if (map) {
      map.setOptions({ draggableCursor: null });

      // Asegurarse de remover el listener
      if (mapClickListenerRef.current) {
        window.google.maps.event.removeListener(mapClickListenerRef.current);
        mapClickListenerRef.current = null;
      }

      // Remover instrucciones
      const instructionDiv = document.getElementById('map-instruction');
      if (instructionDiv) {
        instructionDiv.remove();
      }
    }
  };

  // Guardar nueva zona
  const saveZona = async () => {
    if (!newZona.nombre || !newZona.lat || !newZona.lng) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      const zonaData = {
        ...newZona,
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        ultimaActualizacion: new Date().toISOString()
      };

      const zonasRef = ref(database, 'zonas_asignadas');
      const newZonaRef = push(zonasRef);
      await set(newZonaRef, zonaData);

      // Si hay un trabajador asignado, notificarle
      if (newZona.trabajadorAsignado) {
        const notificacionData = {
          tipo: 'nueva_zona',
          mensaje: `Se te ha asignado una nueva zona: ${newZona.nombre}`,
          zonaId: newZonaRef.key,
          trabajadorId: newZona.trabajadorAsignado,
          timestamp: new Date().toISOString(),
          leido: false
        };

        const notifRef = ref(database, 'notificaciones');
        await push(notifRef, notificacionData);
      }

      // Limpiar formulario
      setNewZona({
        nombre: '',
        descripcion: '',
        direccion: '',
        lat: null,
        lng: null,
        trabajadorAsignado: '',
        prioridad: 'normal',
        fechaLimite: '',
        estado: 'pendiente'
      });

      // Limpiar marcador temporal
      if (markersRef.current.temp) {
        markersRef.current.temp.setMap(null);
        delete markersRef.current.temp;
      }

      setShowZonaForm(false);
      alert('✅ Zona creada exitosamente');
    } catch (error) {
      console.error('Error al crear zona:', error);
      alert('❌ Error al crear la zona');
    }
  };

  // Eliminar zona
  const deleteZona = async (zonaId) => {
    if (window.confirm('¿Estás seguro de eliminar esta zona?')) {
      try {
        await remove(ref(database, `zonas_asignadas/${zonaId}`));
        alert('✅ Zona eliminada');
      } catch (error) {
        console.error('Error al eliminar zona:', error);
        alert('❌ Error al eliminar la zona');
      }
    }
  };

  // Actualizar estado de zona
  const updateZonaStatus = async (zonaId, newStatus) => {
    try {
      const zona = zonas.find(z => z.id === zonaId);

      await update(ref(database, `zonas_asignadas/${zonaId}`), {
        estado: newStatus,
        ultimaActualizacion: new Date().toISOString()
      });

      if (newStatus === 'completado' && zona && zona.solicitudId) {
        await update(ref(database, `solicitudes_maquinaria/${zona.solicitudId}`), {
          estado: 'completada',
          fechaCompletado: new Date().toISOString(),
          completadoPor: currentUser.uid
        });
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error);
    }
  };

  // Filtrar zonas para mostrar en el panel
  const getFilteredZonas = () => {
    return zonas.filter(zona => {
      if (filterStatus === 'all') {
        return !showCompletedZones ? zona.estado !== 'completado' : true;
      }
      return zona.estado === filterStatus;
    });
  };

  const filteredZonas = getFilteredZonas();

  const styles = {
    container: {
      display: 'flex',
      height: '100vh',
      position: 'relative',
      flexDirection: 'column'
    },
    header: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: isMobile ? '10px' : '12px 20px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      zIndex: 1003
    },
    headerContent: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '10px',
      flexWrap: isMobile ? 'wrap' : 'nowrap'
    },
    title: {
      margin: 0,
      fontSize: isMobile ? '16px' : '20px',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    navigationButtons: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    navButton: {
      padding: isMobile ? '6px 10px' : '6px 12px',
      background: 'rgba(255,255,255,0.1)',
      color: 'white',
      border: '1px solid rgba(255,255,255,0.3)',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: isMobile ? '11px' : '13px',
      fontWeight: '400',
      whiteSpace: 'nowrap'
    },
    navButtonActive: {
      background: 'rgba(255,255,255,0.25)',
      fontWeight: '600'
    },
    logoutButton: {
      padding: isMobile ? '6px 10px' : '6px 14px',
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: isMobile ? '12px' : '13px',
      fontWeight: '600'
    },
    mainContent: {
      display: 'flex',
      flex: 1,
      position: 'relative',
      overflow: 'hidden'
    },
    panel: {
      width: isMobile ? '100%' : '400px',
      background: 'white',
      borderRight: '1px solid #e5e7eb',
      overflowY: 'auto',
      display: showPanel ? 'flex' : 'none',
      flexDirection: 'column',
      position: isMobile ? 'fixed' : 'relative',
      height: isMobile && showZonaForm ? '100vh' : '100%', // Pantalla completa cuando hay formulario
      zIndex: isMobile ? 9999 : 1001,
      top: isMobile ? '0' : 'auto',
      left: isMobile ? '0' : 'auto',
      right: isMobile ? '0' : 'auto', // Agregar right 0 para móvil
      bottom: isMobile ? '0' : 'auto', // Agregar bottom 0 para móvil
      transition: 'transform 0.3s'
    },
    panelHeader: {
      padding: isMobile ? '15px' : '20px',
      borderBottom: '1px solid #e5e7eb',
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      color: 'white'
    },
    createButton: {
      width: '100%',
      padding: isMobile ? '10px' : '10px',
      background: isCreatingZona ? '#9ca3af' : 'white',
      color: isCreatingZona ? 'white' : '#22c55e',
      border: 'none',
      borderRadius: '6px',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: '500',
      cursor: isCreatingZona ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    },
    filterContainer: {
      padding: isMobile ? '10px' : '15px',
      borderBottom: '1px solid #e5e7eb',
      background: '#f9fafb'
    },
    filterButtons: {
      display: 'flex',
      gap: '8px',
      marginBottom: '10px',
      flexWrap: 'wrap'
    },
    filterButton: {
      flex: 1,
      minWidth: isMobile ? '70px' : 'auto',
      padding: isMobile ? '6px' : '8px 12px',
      background: 'white',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: isMobile ? '11px' : '12px',
      cursor: 'pointer',
      transition: 'all 0.3s'
    },
    filterButtonActive: {
      background: '#667eea',
      color: 'white',
      borderColor: '#667eea'
    },
    toggleCompletedButton: {
      width: '100%',
      padding: isMobile ? '8px' : '10px',
      background: showCompletedZones ? '#10b981' : '#f3f4f6',
      color: showCompletedZones ? 'white' : '#6b7280',
      border: '1px solid',
      borderColor: showCompletedZones ? '#10b981' : '#d1d5db',
      borderRadius: '6px',
      fontSize: isMobile ? '11px' : '12px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px'
    },
    form: {
      padding: isMobile ? '15px' : '20px',
      background: 'white', // Cambiar a blanco sólido
      borderBottom: '2px solid #3b82f6',
      position: 'relative', // Agregar position relative
      zIndex: 10000 // Agregar z-index alto
    },
    formTitle: {
      margin: '0 0 15px 0',
      color: '#1e40af',
      fontSize: isMobile ? '16px' : '18px'
    },
    formGroup: {
      marginBottom: '12px'
    },
    label: {
      display: 'block',
      marginBottom: '4px',
      fontSize: isMobile ? '12px' : '13px',
      fontWeight: '500',
      color: '#374151'
    },
    input: {
      width: '100%',
      padding: isMobile ? '6px' : '8px',
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      fontSize: isMobile ? '13px' : '14px'
    },
    textarea: {
      width: '100%',
      padding: isMobile ? '6px' : '8px',
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      fontSize: isMobile ? '13px' : '14px',
      minHeight: '60px',
      resize: 'vertical'
    },
    select: {
      width: '100%',
      padding: isMobile ? '6px' : '8px',
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      fontSize: isMobile ? '13px' : '14px',
      background: 'white'
    },
    gridTwoColumns: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
      marginBottom: '12px'
    },
    locationInfo: {
      padding: '8px',
      background: '#e0e7ff',
      borderRadius: '4px',
      marginBottom: '12px',
      fontSize: isMobile ? '11px' : '12px'
    },
    formButtons: {
      display: 'flex',
      gap: '8px'
    },
    saveButton: {
      flex: 1,
      padding: isMobile ? '8px' : '10px',
      background: '#22c55e',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: '500',
      cursor: 'pointer'
    },
    cancelButton: {
      flex: 1,
      padding: isMobile ? '8px' : '10px',
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: '500',
      cursor: 'pointer'
    },
    zonasList: {
      flex: 1,
      padding: isMobile ? '15px' : '20px',
      overflowY: 'auto'
    },
    listHeader: {
      margin: '0 0 15px 0',
      fontSize: isMobile ? '14px' : '16px',
      color: '#1f2937',
      fontWeight: '600'
    },
    zonaCard: {
      padding: isMobile ? '10px' : '12px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      marginBottom: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    zonaCardHover: {
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      transform: 'translateY(-1px)'
    },
    zonaHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'start',
      marginBottom: '8px'
    },
    zonaTitle: {
      margin: '0 0 4px 0',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: '600',
      color: '#1f2937'
    },
    zonaAddress: {
      margin: '0 0 4px 0',
      fontSize: isMobile ? '11px' : '12px',
      color: '#6b7280'
    },
    zonaWorker: {
      margin: '0 0 4px 0',
      fontSize: isMobile ? '11px' : '12px',
      color: '#6b7280'
    },
    zonaTags: {
      display: 'flex',
      gap: '6px',
      marginTop: '6px',
      flexWrap: 'wrap'
    },
    tag: {
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: isMobile ? '10px' : '11px',
      fontWeight: '500'
    },
    zonaActions: {
      display: 'flex',
      gap: '4px'
    },
    actionSelect: {
      padding: '4px',
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      fontSize: '11px',
      cursor: 'pointer',
      background: 'white'
    },
    deleteButton: {
      padding: '4px 8px',
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      fontSize: '11px',
      cursor: 'pointer'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: '#6b7280'
    },
    map: {
      flex: 1,
      position: 'relative'
      // NO agregar display none
    },
    togglePanelButton: {
      position: 'absolute',
      left: '10px',
      top: '10px',
      background: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '10px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      cursor: 'pointer',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    mobileBottomNav: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'white',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      padding: '8px',
      gap: '8px',
      zIndex: 1000
    },
    mobileNavButton: {
      flex: 1,
      padding: '8px',
      background: '#f3f4f6',
      border: 'none',
      borderRadius: '6px',
      fontSize: '11px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px'
    }
  };

  // Función para manejar click en el formulario
  const handleFormClick = (e) => {
    e.stopPropagation();
  };
  // Vista móvil del formulario (agregar ANTES del return principal)
  if (isMobile && mobileFormView) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'white',
        zIndex: 10000,
        overflowY: 'auto'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          color: 'white',
          padding: '15px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>
            📍 Nueva Zona de Trabajo
          </h2>
          <button
            onClick={() => {
              setMobileFormView(false);
              setShowPanel(true);
              setShowZonaForm(false);
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            ✖ Cerrar
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <div style={{
            background: '#e0e7ff',
            padding: '10px',
            borderRadius: '6px',
            marginBottom: '15px',
            fontSize: '13px'
          }}>
            📍 Ubicación: {newZona.lat?.toFixed(6)}, {newZona.lng?.toFixed(6)}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              Nombre de la zona *
            </label>
            <input
              type="text"
              value={newZona.nombre}
              onChange={(e) => setNewZona({ ...newZona, nombre: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px'
              }}
              placeholder="Ej: Reparación Calle Principal"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              Descripción
            </label>
            <textarea
              value={newZona.descripcion}
              onChange={(e) => setNewZona({ ...newZona, descripcion: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px',
                minHeight: '80px'
              }}
              placeholder="Detalles del trabajo..."
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              Dirección
            </label>
            <input
              type="text"
              value={newZona.direccion}
              onChange={(e) => setNewZona({ ...newZona, direccion: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              Asignar a trabajador
            </label>
            <select
              value={newZona.trabajadorAsignado}
              onChange={(e) => setNewZona({ ...newZona, trabajadorAsignado: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px',
                background: 'white'
              }}
            >
              <option value="">-- Sin asignar --</option>
              {trabajadores.map(trabajador => (
                <option key={trabajador.id} value={trabajador.id}>
                  {trabajador.nombre || trabajador.email}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '5px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Prioridad
              </label>
              <select
                value={newZona.prioridad}
                onChange={(e) => setNewZona({ ...newZona, prioridad: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px',
                  background: 'white'
                }}
              >
                <option value="baja">🟢 Baja</option>
                <option value="normal">🟡 Normal</option>
                <option value="alta">🟠 Alta</option>
                <option value="urgente">🔴 Urgente</option>
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '5px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Fecha límite
              </label>
              <input
                type="date"
                value={newZona.fechaLimite}
                onChange={(e) => setNewZona({ ...newZona, fechaLimite: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={async () => {
                if (!newZona.nombre || !newZona.lat || !newZona.lng) {
                  alert('Por favor completa todos los campos requeridos');
                  return;
                }

                try {
                  const zonaData = {
                    ...newZona,
                    createdBy: currentUser.uid,
                    createdAt: new Date().toISOString(),
                    ultimaActualizacion: new Date().toISOString()
                  };

                  const zonasRef = ref(database, 'zonas_asignadas');
                  const newZonaRef = push(zonasRef);
                  await set(newZonaRef, zonaData);

                  // Si hay un trabajador asignado, notificarle
                  if (newZona.trabajadorAsignado) {
                    const notificacionData = {
                      tipo: 'nueva_zona',
                      mensaje: `Se te ha asignado una nueva zona: ${newZona.nombre}`,
                      zonaId: newZonaRef.key,
                      trabajadorId: newZona.trabajadorAsignado,
                      timestamp: new Date().toISOString(),
                      leido: false
                    };

                    const notifRef = ref(database, 'notificaciones');
                    await push(notifRef, notificacionData);
                  }

                  // Limpiar formulario
                  setNewZona({
                    nombre: '',
                    descripcion: '',
                    direccion: '',
                    lat: null,
                    lng: null,
                    trabajadorAsignado: '',
                    prioridad: 'normal',
                    fechaLimite: '',
                    estado: 'pendiente'
                  });

                  // Limpiar marcador temporal
                  if (markersRef.current.temp) {
                    markersRef.current.temp.setMap(null);
                    delete markersRef.current.temp;
                  }

                  setMobileFormView(false);
                  setShowPanel(true);
                  alert('✅ Zona creada exitosamente');
                } catch (error) {
                  console.error('Error al crear zona:', error);
                  alert('❌ Error al crear la zona');
                }
              }}
              style={{
                flex: 1,
                padding: '14px',
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              ✅ Guardar Zona
            </button>

            <button
              onClick={() => {
                setMobileFormView(false);
                setShowPanel(true);
                setShowZonaForm(false);
                setNewZona({
                  nombre: '',
                  descripcion: '',
                  direccion: '',
                  lat: null,
                  lng: null,
                  trabajadorAsignado: '',
                  prioridad: 'normal',
                  fechaLimite: '',
                  estado: 'pendiente'
                });
                if (markersRef.current.temp) {
                  markersRef.current.temp.setMap(null);
                  delete markersRef.current.temp;
                }
              }}
              style={{
                flex: 1,
                padding: '14px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              ❌ Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isMobile && (
              <button
                onClick={() => setShowPanel(!showPanel)}
                style={{
                  padding: '6px',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '20px'
                }}
              >
                ☰
              </button>
            )}
            <h1 style={styles.title}>
              🗺️ Gestión de Zonas
            </h1>
          </div>

          <div style={styles.navigationButtons}>
            {!isMobile && onViewChange && (
              <>
                {currentUser?.role === 'superadmin' && (
                  <button
                    onClick={() => onViewChange('admin')}
                    style={styles.navButton}
                  >
                    🔐 Panel Admin
                  </button>
                )}
                <button
                  onClick={() => onViewChange('dashboard')}
                  style={styles.navButton}
                >
                  📊 Dashboard GPS
                </button>
                <button
                  onClick={() => onViewChange('fleet')}
                  style={styles.navButton}
                >
                  🚛 Panel Flota
                </button>
              </>
            )}
            <button onClick={onLogout} style={styles.logoutButton}>
              {isMobile ? '🚪' : '🚪 Salir'}
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div style={styles.mainContent}>
        {/* Panel lateral */}
        <div style={styles.panel}>
          {/* Header del panel */}
          <div style={styles.panelHeader}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: isMobile ? '16px' : '18px' }}>
              📍 Crear y Administrar Zonas
            </h2>
            <button
              onClick={startCreatingZona}
              disabled={isCreatingZona}
              style={styles.createButton}
            >
              {isCreatingZona ? '📍 Haz clic en el mapa...' : '➕ Crear Nueva Zona'}
            </button>
          </div>

          {/* Filtros */}
          <div style={styles.filterContainer}>
            <div style={styles.filterButtons}>
              <button
                onClick={() => setFilterStatus('all')}
                style={{
                  ...styles.filterButton,
                  ...(filterStatus === 'all' ? styles.filterButtonActive : {})
                }}
              >
                Todas
              </button>
              <button
                onClick={() => setFilterStatus('pendiente')}
                style={{
                  ...styles.filterButton,
                  ...(filterStatus === 'pendiente' ? styles.filterButtonActive : {})
                }}
              >
                ⏳ Pendientes
              </button>
              <button
                onClick={() => setFilterStatus('en_progreso')}
                style={{
                  ...styles.filterButton,
                  ...(filterStatus === 'en_progreso' ? styles.filterButtonActive : {})
                }}
              >
                🔧 En Progreso
              </button>
              <button
                onClick={() => setFilterStatus('completado')}
                style={{
                  ...styles.filterButton,
                  ...(filterStatus === 'completado' ? styles.filterButtonActive : {})
                }}
              >
                ✅ Completadas
              </button>
            </div>

            <button
              onClick={() => setShowCompletedZones(!showCompletedZones)}
              style={styles.toggleCompletedButton}
            >
              {showCompletedZones ? '👁️ Ocultar' : '👁️‍🗨️ Mostrar'} Completadas en Mapa
            </button>
          </div>

          {/* Formulario de nueva zona - CORREGIDO */}
          {showZonaForm && (
            <div
              style={styles.form}
              onClick={handleFormClick}
              onMouseDown={handleFormClick}
              onTouchStart={handleFormClick}
            >

              <h3 style={styles.formTitle}>

                Nueva Zona de Trabajo

              </h3>



              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Nombre de la zona *
                </label>
                <input
                  type="text"
                  value={newZona.nombre}
                  onChange={(e) => setNewZona({ ...newZona, nombre: e.target.value })}
                  style={styles.input}
                  placeholder="Ej: Reparación Calle Principal"
                />
              </div>


              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Descripción
                </label>
                <textarea
                  value={newZona.descripcion}
                  onChange={(e) => setNewZona({ ...newZona, descripcion: e.target.value })}
                  style={styles.textarea}
                  placeholder="Detalles del trabajo..."
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Dirección
                </label>
                <input
                  type="text"
                  value={newZona.direccion}
                  onChange={(e) => setNewZona({ ...newZona, direccion: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Asignar a trabajador
                </label>
                <select
                  value={newZona.trabajadorAsignado}
                  onChange={(e) => setNewZona({ ...newZona, trabajadorAsignado: e.target.value })}
                  style={styles.select}
                >
                  <option value="">-- Sin asignar --</option>
                  {trabajadores.map(trabajador => (
                    <option key={trabajador.id} value={trabajador.id}>
                      {trabajador.nombre || trabajador.email}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.gridTwoColumns}>
                <div>
                  <label style={styles.label}>
                    Prioridad
                  </label>
                  <select
                    value={newZona.prioridad}
                    onChange={(e) => setNewZona({ ...newZona, prioridad: e.target.value })}
                    style={styles.select}
                  >
                    <option value="baja">🟢 Baja</option>
                    <option value="normal">🟡 Normal</option>
                    <option value="alta">🟠 Alta</option>
                    <option value="urgente">🔴 Urgente</option>
                  </select>
                </div>

                <div>
                  <label style={styles.label}>
                    Fecha límite
                  </label>
                  <input
                    type="date"
                    value={newZona.fechaLimite}
                    onChange={(e) => setNewZona({ ...newZona, fechaLimite: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.locationInfo}>
                📍 <strong>Ubicación:</strong> {newZona.lat?.toFixed(6)}, {newZona.lng?.toFixed(6)}
              </div>

              <div style={styles.formButtons}>
                <button
                  onClick={saveZona}
                  style={styles.saveButton}
                >
                  ✅ Guardar Zona
                </button>
                <button
                  onClick={async () => {
                    if (!newZona.nombre || !newZona.lat || !newZona.lng) {
                      alert('Por favor completa todos los campos requeridos');
                      return;
                    }

                    try {
                      const zonaData = {
                        ...newZona,
                        createdBy: currentUser.uid,
                        createdAt: new Date().toISOString(),
                        ultimaActualizacion: new Date().toISOString()
                      };

                      const zonasRef = ref(database, 'zonas_asignadas');
                      const newZonaRef = push(zonasRef);
                      await set(newZonaRef, zonaData);

                      // Si hay un trabajador asignado, notificarle
                      if (newZona.trabajadorAsignado) {
                        const notificacionData = {
                          tipo: 'nueva_zona',
                          mensaje: `Se te ha asignado una nueva zona: ${newZona.nombre}`,
                          zonaId: newZonaRef.key,
                          trabajadorId: newZona.trabajadorAsignado,
                          timestamp: new Date().toISOString(),
                          leido: false
                        };

                        const notifRef = ref(database, 'notificaciones');
                        await push(notifRef, notificacionData);
                      }

                      // Guardar temporalmente la ubicación de la nueva zona
                      const newZonaLocation = { lat: newZona.lat, lng: newZona.lng };

                      // Limpiar formulario
                      setNewZona({
                        nombre: '',
                        descripcion: '',
                        direccion: '',
                        lat: null,
                        lng: null,
                        trabajadorAsignado: '',
                        prioridad: 'normal',
                        fechaLimite: '',
                        estado: 'pendiente'
                      });

                      // Limpiar marcador temporal
                      if (markersRef.current.temp) {
                        markersRef.current.temp.setMap(null);
                        delete markersRef.current.temp;
                      }

                      // Cerrar vista móvil del formulario
                      setMobileFormView(false);

                      // NO mostrar el panel, ir directo al mapa
                      setShowPanel(false);

                      // Centrar el mapa en la nueva zona después de un pequeño delay
                      setTimeout(() => {
                        if (map && newZonaLocation) {
                          map.setCenter(newZonaLocation);
                          map.setZoom(16);
                        }
                      }, 100);

                      // Mostrar mensaje de éxito
                      alert('✅ Zona creada exitosamente');

                    } catch (error) {
                      console.error('Error al crear zona:', error);
                      alert('❌ Error al crear la zona');
                    }
                  }}
                  style={styles.cancelButton}
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista de zonas */}
          <div style={styles.zonasList}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '15px'
            }}>
              <h3 style={{ ...styles.listHeader, margin: 0 }}>
                📋 Zonas Activas ({filteredZonas.length})
              </h3>
              {isMobile && (
                <button
                  onClick={() => onViewChange('dashboard')}
                  style={{
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  📊 Ver Mapa
                </button>
              )}
            </div>

            {filteredZonas.length === 0 ? (
              <div style={styles.emptyState}>
                <p>No hay zonas {filterStatus !== 'all' ? filterStatus.replace('_', ' ') : ''}</p>
                <p style={{ fontSize: isMobile ? '11px' : '12px', marginTop: '8px' }}>
                  Haz clic en "Crear Nueva Zona" para comenzar
                </p>
              </div>
            ) : (
              <div>
                {filteredZonas.map(zona => {
                  const trabajador = trabajadores.find(t => t.id === zona.trabajadorAsignado);
                  return (
                    <div
                      key={zona.id}
                      style={{
                        ...styles.zonaCard,
                        background: selectedZona?.id === zona.id ? '#f0f9ff' : 'white'
                      }}
                      onClick={() => {
                        setSelectedZona(zona);
                        if (map && markersRef.current[zona.id]) {
                          map.panTo({ lat: zona.lat, lng: zona.lng });
                          map.setZoom(16);
                          window.google.maps.event.trigger(markersRef.current[zona.id], 'click');
                        }
                      }}
                    >
                      <div style={styles.zonaHeader}>
                        <div style={{ flex: 1 }}>
                          <h4 style={styles.zonaTitle}>
                            {zona.nombre}
                          </h4>
                          <p style={styles.zonaAddress}>
                            📍 {zona.direccion}
                          </p>
                          <p style={styles.zonaWorker}>
                            👷 {trabajador ? trabajador.nombre : 'Sin asignar'}
                          </p>
                          <div style={styles.zonaTags}>
                            <span style={{
                              ...styles.tag,
                              background: zona.estado === 'completado' ? '#dcfce7' :
                                zona.estado === 'en_progreso' ? '#dbeafe' :
                                  '#fef3c7',
                              color: zona.estado === 'completado' ? '#166534' :
                                zona.estado === 'en_progreso' ? '#1e40af' :
                                  '#92400e'
                            }}>
                              {zona.estado === 'completado' ? '✅ Completado' :
                                zona.estado === 'en_progreso' ? '🔧 En progreso' :
                                  '⏳ Pendiente'}
                            </span>
                            <span style={{
                              ...styles.tag,
                              background: zona.prioridad === 'urgente' ? '#fee2e2' :
                                zona.prioridad === 'alta' ? '#fed7aa' :
                                  zona.prioridad === 'normal' ? '#fef3c7' :
                                    '#dcfce7',
                              color: zona.prioridad === 'urgente' ? '#991b1b' :
                                zona.prioridad === 'alta' ? '#9a3412' :
                                  zona.prioridad === 'normal' ? '#92400e' :
                                    '#166534'
                            }}>
                              {zona.prioridad === 'urgente' ? '🔴 Urgente' :
                                zona.prioridad === 'alta' ? '🟠 Alta' :
                                  zona.prioridad === 'normal' ? '🟡 Normal' :
                                    '🟢 Baja'}
                            </span>
                          </div>
                        </div>
                        <div style={styles.zonaActions}>
                          {zona.estado !== 'completado' && (
                            <select
                              value={zona.estado}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateZonaStatus(zona.id, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={styles.actionSelect}
                            >
                              <option value="pendiente">⏳ Pendiente</option>
                              <option value="en_progreso">🔧 En progreso</option>
                              <option value="completado">✅ Completado</option>
                            </select>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteZona(zona.id);
                            }}
                            style={styles.deleteButton}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mapa */}
        <div style={styles.map}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* Botón toggle panel */}

          <button
            onClick={() => setShowPanel(!showPanel)}
            style={styles.togglePanelButton}
          >
            <span style={{ fontSize: '20px' }}>
              {showPanel ? '◀' : '☰'}
            </span>
          </button>


          {!mapLoaded && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
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
        </div>
      </div>

      {/* Navegación inferior móvil */}
      {isMobile && onViewChange && (
        <div style={styles.mobileBottomNav}>
          {currentUser?.role === 'superadmin' && (
            <button
              onClick={() => onViewChange('admin')}
              style={styles.mobileNavButton}
            >
              <span style={{ fontSize: '16px' }}>🔐</span>
              <span>Admin</span>
            </button>
          )}
          <button
            onClick={() => onViewChange('dashboard')}
            style={styles.mobileNavButton}
          >
            <span style={{ fontSize: '16px' }}>📊</span>
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => onViewChange('zones')}
            style={{
              ...styles.mobileNavButton,
              background: '#667eea',
              color: 'white'
            }}
          >
            <span style={{ fontSize: '16px' }}>🗺️</span>
            <span>Zonas</span>
          </button>
          <button
            onClick={() => onViewChange('fleet')}
            style={styles.mobileNavButton}
          >
            <span style={{ fontSize: '16px' }}>🚛</span>
            <span>Flota</span>
          </button>
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

export default ZonesManagement;