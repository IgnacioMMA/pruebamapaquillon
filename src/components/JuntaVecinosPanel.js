// src/components/JuntaVecinosPanel.js
import React, { useState, useEffect, useRef } from 'react';
import { database } from '../config/firebase';
import { ref, push, set, onValue, update } from 'firebase/database';

const JuntaVecinosPanel = ({ currentUser, onLogout }) => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [showNewSolicitud, setShowNewSolicitud] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [expandedSolicitud, setExpandedSolicitud] = useState(null);
  const [mapError, setMapError] = useState(false);
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  
  const [formData, setFormData] = useState({
    asunto: '',
    tipoMaquinaria: '',
    descripcion: '',
    nombreSolicitante: '',
    telefonoContacto: '',
    fechaNecesaria: '',
    duracionEstimada: '1',
    prioridad: 'normal'
  });

  // API Key correcta
  const GOOGLE_MAPS_API_KEY = 'AIzaSyA7DrdL36n5cx-RNzuXGAQggFeGCheHDbY';

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cargar Google Maps de forma segura
  useEffect(() => {
    if (!showNewSolicitud) return;

    const loadGoogleMaps = () => {
      // Verificar si ya está cargado
      if (window.google && window.google.maps) {
        console.log('Google Maps ya está cargado');
        initializeMap();
        return;
      }

      // Verificar si ya hay un script cargándose
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        console.log('Script de Google Maps ya existe, esperando carga...');
        existingScript.addEventListener('load', initializeMap);
        existingScript.addEventListener('error', handleMapError);
        return;
      }

      // Crear y cargar el script
      console.log('Cargando Google Maps...');
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMapCallback`;
      script.async = true;
      script.defer = true;
      script.onerror = handleMapError;
      
      // Definir callback global
      window.initMapCallback = () => {
        console.log('Google Maps cargado exitosamente');
        initializeMap();
      };
      
      document.head.appendChild(script);
    };

    const handleMapError = () => {
      console.error('Error al cargar Google Maps');
      setMapError(true);
    };

    // Pequeño delay para asegurar que el DOM esté listo
    setTimeout(loadGoogleMaps, 100);

    return () => {
      // Limpiar callback global
      if (window.initMapCallback) {
        delete window.initMapCallback;
      }
    };
  }, [showNewSolicitud]);

  // Cargar solicitudes del usuario
  useEffect(() => {
    const solicitudesRef = ref(database, 'solicitudes_maquinaria');
    const unsubscribe = onValue(solicitudesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const solicitudesArray = Object.entries(data)
          .filter(([id, sol]) => sol.solicitanteId === currentUser.uid)
          .map(([id, sol]) => ({ id, ...sol }))
          .sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));
        setSolicitudes(solicitudesArray);
      } else {
        setSolicitudes([]);
      }
    });
    return () => unsubscribe();
  }, [currentUser.uid]);

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) {
      console.error('Referencias del mapa no disponibles');
      return;
    }

    try {
      const quillonCenter = { lat: -36.7333, lng: -72.4667 };
      
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: quillonCenter,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: !isMobile,
        gestureHandling: isMobile ? 'greedy' : 'auto',
        mapTypeId: 'roadmap'
      });

      // Crear botón personalizado "Mi Ubicación" en el mapa
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
          border: none;
          transition: all 0.3s;
        ">
          <span style="font-size: 20px;">📍</span>
        </div>
      `;
      locationButton.style.cssText = 'border: none; background: none; padding: 5px; margin: 10px;';
      locationButton.title = 'Usar mi ubicación actual';
      
      mapInstanceRef.current.controls[window.google.maps.ControlPosition.RIGHT_BOTTOM].push(locationButton);
      
      // Evento click del botón de ubicación en el mapa
      locationButton.addEventListener('click', () => {
        getCurrentLocation();
      });

      // Listener para clicks en el mapa
      mapInstanceRef.current.addListener('click', (event) => {
        const location = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng()
        };
        setSelectedLocation(location);
        
        if (markerRef.current) {
          markerRef.current.setPosition(location);
        } else {
          markerRef.current = new window.google.maps.Marker({
            position: location,
            map: mapInstanceRef.current,
            title: 'Ubicación seleccionada',
            draggable: true,
            animation: window.google.maps.Animation.DROP
          });
          
          markerRef.current.addListener('dragend', (event) => {
            setSelectedLocation({
              lat: event.latLng.lat(),
              lng: event.latLng.lng()
            });
          });
        }
      });

      setMapError(false);
      console.log('Mapa inicializado correctamente');
    } catch (error) {
      console.error('Error al inicializar el mapa:', error);
      setMapError(true);
    }
  };

  // Función para obtener ubicación actual del usuario
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage({
        type: 'error',
        text: '⚠️ Tu navegador no soporta geolocalización'
      });
      return;
    }

    setMessage({
      type: 'info',
      text: '🔍 Obteniendo tu ubicación actual...'
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        setSelectedLocation(userLocation);
        
        // Si el mapa está cargado, centrar y agregar marcador
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(userLocation);
          mapInstanceRef.current.setZoom(16);
          
          // Actualizar o crear marcador
          if (markerRef.current) {
            markerRef.current.setPosition(userLocation);
          } else {
            markerRef.current = new window.google.maps.Marker({
              position: userLocation,
              map: mapInstanceRef.current,
              title: 'Tu ubicación actual',
              draggable: true,
              animation: window.google.maps.Animation.DROP
            });
            
            markerRef.current.addListener('dragend', (event) => {
              setSelectedLocation({
                lat: event.latLng.lat(),
                lng: event.latLng.lng()
              });
            });
          }
        }
        
        setMessage({
          type: 'success',
          text: '✅ Ubicación actual seleccionada'
        });
        
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      },
      (error) => {
        console.error('Error al obtener ubicación:', error);
        let errorMessage = '❌ No se pudo obtener tu ubicación';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '❌ Permiso de ubicación denegado. Por favor, habilita los permisos en tu navegador.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '❌ Información de ubicación no disponible';
            break;
          case error.TIMEOUT:
            errorMessage = '❌ Tiempo de espera agotado al obtener ubicación';
            break;
        }
        
        setMessage({
          type: 'error',
          text: errorMessage
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Función alternativa para seleccionar ubicación manualmente
  const handleManualLocation = () => {
    // Coordenadas de ejemplo para Quillón centro
    const defaultLocation = {
      lat: -36.7333,
      lng: -72.4667
    };
    setSelectedLocation(defaultLocation);
    
    // Si el mapa está cargado, centrar y agregar marcador
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(defaultLocation);
      mapInstanceRef.current.setZoom(14);
      
      if (markerRef.current) {
        markerRef.current.setPosition(defaultLocation);
      } else {
        markerRef.current = new window.google.maps.Marker({
          position: defaultLocation,
          map: mapInstanceRef.current,
          title: 'Ubicación de Quillón',
          draggable: true
        });
      }
    }
    
    setMessage({
      type: 'info',
      text: '📍 Ubicación de Quillón centro seleccionada. Puedes ajustarla arrastrando el marcador.'
    });
  };

  const handleSubmitSolicitud = async (e) => {
    e.preventDefault();
    
    if (!selectedLocation && !mapError) {
      setMessage({ 
        type: 'error', 
        text: '⚠️ Por favor, selecciona una ubicación en el mapa' 
      });
      return;
    }

    // Si hay error en el mapa, usar ubicación por defecto
    const finalLocation = selectedLocation || { lat: -36.7333, lng: -72.4667 };

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const solicitudData = {
        ...formData,
        ubicacion: finalLocation,
        solicitanteId: currentUser.uid,
        solicitanteEmail: currentUser.email,
        solicitanteName: currentUser.name || currentUser.email,
        localidad: currentUser.localidad || 'No especificada',
        fechaSolicitud: new Date().toISOString(),
        estado: 'pendiente',
        visto: false,
        respuesta: null,
        fechaRespuesta: null
      };

      const solicitudesRef = ref(database, 'solicitudes_maquinaria');
      await push(solicitudesRef, solicitudData);

      const notificacionRef = ref(database, 'notificaciones');
      await push(notificacionRef, {
        tipo: 'nueva_solicitud',
        mensaje: `Nueva solicitud de maquinaria de ${currentUser.localidad || 'Junta de Vecinos'}`,
        timestamp: new Date().toISOString(),
        paraRole: 'superadmin',
        leido: false
      });

      setMessage({ 
        type: 'success', 
        text: '✅ Solicitud enviada exitosamente' 
      });

      // Limpiar formulario
      setFormData({
        asunto: '',
        tipoMaquinaria: '',
        descripcion: '',
        nombreSolicitante: '',
        telefonoContacto: '',
        fechaNecesaria: '',
        duracionEstimada: '1',
        prioridad: 'normal'
      });
      setSelectedLocation(null);
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      
      setTimeout(() => {
        setShowNewSolicitud(false);
        setMessage({ type: '', text: '' });
      }, 3000);

    } catch (error) {
      console.error('Error al enviar solicitud:', error);
      setMessage({ 
        type: 'error', 
        text: '❌ Error al enviar la solicitud' 
      });
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente': return '#f59e0b';
      case 'aprobada': return '#22c55e';
      case 'rechazada': return '#ef4444';
      case 'en_proceso': return '#3b82f6';
      case 'completada': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getEstadoTexto = (estado) => {
    switch (estado) {
      case 'pendiente': return '⏳ Pendiente';
      case 'aprobada': return '✅ Aprobada';
      case 'rechazada': return '❌ Rechazada';
      case 'en_proceso': return '🔧 En Proceso';
      case 'completada': return '✔️ Completada';
      default: return estado;
    }
  };

  const styles = {
    container: {
      width: '100%',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: isMobile ? '0' : '10px'
    },
    header: {
      background: 'white',
      borderRadius: isMobile ? '0' : '12px',
      padding: isMobile ? '12px' : '15px',
      marginBottom: isMobile ? '0' : '15px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      position: isMobile ? 'sticky' : 'relative',
      top: 0,
      zIndex: 100
    },
    headerContent: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '10px'
    },
    title: {
      margin: 0,
      fontSize: isMobile ? '18px' : '20px',
      color: '#1f2937',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    subtitle: {
      margin: '4px 0 0 0',
      fontSize: isMobile ? '12px' : '14px',
      color: '#6b7280'
    },
    logoutButton: {
      padding: isMobile ? '6px 12px' : '8px 16px',
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: isMobile ? '12px' : '14px',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    content: {
      padding: isMobile ? '10px' : '0'
    },
    newSolicitudButton: {
      width: '100%',
      padding: isMobile ? '12px' : '15px',
      background: 'white',
      color: '#667eea',
      border: '2px dashed #667eea',
      borderRadius: isMobile ? '8px' : '12px',
      fontSize: isMobile ? '14px' : '16px',
      fontWeight: '600',
      cursor: 'pointer',
      marginBottom: isMobile ? '15px' : '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    },
    formContainer: {
      background: 'white',
      borderRadius: isMobile ? '8px' : '12px',
      padding: isMobile ? '15px' : '20px',
      marginBottom: isMobile ? '15px' : '20px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    },
    formHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isMobile ? '15px' : '20px'
    },
    formTitle: {
      margin: 0,
      fontSize: isMobile ? '16px' : '18px',
      color: '#1f2937'
    },
    formSection: {
      marginBottom: isMobile ? '15px' : '20px'
    },
    sectionTitle: {
      margin: `0 0 ${isMobile ? '10px' : '15px'} 0`,
      fontSize: isMobile ? '14px' : '16px',
      color: '#374151'
    },
    formGroup: {
      marginBottom: isMobile ? '12px' : '15px'
    },
    label: {
      display: 'block',
      marginBottom: '5px',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: '500',
      color: '#374151'
    },
    input: {
      width: '100%',
      padding: isMobile ? '8px' : '10px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: isMobile ? '16px' : '14px', // 16px en móvil previene zoom en iOS
      WebkitAppearance: 'none'
    },
    select: {
      width: '100%',
      padding: isMobile ? '8px' : '10px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: isMobile ? '16px' : '14px',
      WebkitAppearance: 'none',
      background: 'white'
    },
    textarea: {
      width: '100%',
      padding: isMobile ? '8px' : '10px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: isMobile ? '16px' : '14px',
      resize: 'vertical',
      minHeight: isMobile ? '80px' : '100px',
      WebkitAppearance: 'none'
    },
    gridTwoColumns: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: isMobile ? '12px' : '10px',
      marginBottom: isMobile ? '12px' : '15px'
    },
    mapContainer: {
      width: '100%',
      height: isMobile ? '250px' : '300px',
      borderRadius: '8px',
      border: '2px solid #e5e7eb',
      marginBottom: '10px',
      position: 'relative',
      overflow: 'hidden',
      background: '#f3f4f6'
    },
    mapError: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '20px',
      textAlign: 'center',
      color: '#6b7280'
    },
    locationInfo: {
      marginTop: '10px',
      padding: isMobile ? '8px' : '10px',
      background: '#f0f9ff',
      borderRadius: '6px',
      fontSize: isMobile ? '12px' : '13px',
      color: '#0369a1'
    },
    manualLocationInput: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '10px',
      marginTop: '10px'
    },
    buttonGroup: {
      display: 'flex',
      gap: '10px',
      marginTop: isMobile ? '15px' : '20px',
      flexDirection: isMobile ? 'column' : 'row'
    },
    submitButton: {
      flex: 1,
      padding: isMobile ? '10px' : '12px',
      background: loading ? '#9ca3af' : '#22c55e',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: isMobile ? '14px' : '16px',
      fontWeight: '600',
      cursor: loading ? 'not-allowed' : 'pointer'
    },
    cancelButton: {
      padding: '5px 10px',
      background: '#6b7280',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: isMobile ? '12px' : '14px',
      cursor: 'pointer'
    },
    solicitudesList: {
      background: 'white',
      borderRadius: isMobile ? '8px' : '12px',
      padding: isMobile ? '15px' : '20px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    },
    solicitudCard: {
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: isMobile ? '12px' : '15px',
      background: '#f9fafb',
      marginBottom: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    solicitudHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '10px',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
      gap: '8px'
    },
    solicitudTitle: {
      margin: '0 0 5px 0',
      fontSize: isMobile ? '14px' : '16px',
      color: '#1f2937'
    },
    solicitudDate: {
      margin: '0',
      fontSize: isMobile ? '11px' : '13px',
      color: '#6b7280'
    },
    solicitudDetails: {
      fontSize: isMobile ? '12px' : '14px',
      color: '#374151',
      marginBottom: '10px',
      lineHeight: '1.5'
    },
    estadoBadge: {
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: isMobile ? '11px' : '12px',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    },
    respuestaBox: {
      marginTop: '10px',
      padding: isMobile ? '8px' : '10px',
      borderRadius: '6px',
      fontSize: isMobile ? '12px' : '13px'
    },
    emptyState: {
      textAlign: 'center',
      padding: isMobile ? '30px 20px' : '40px 20px',
      color: '#6b7280'
    },
    messageAlert: {
      padding: isMobile ? '10px' : '12px',
      borderRadius: '8px',
      marginBottom: '15px',
      fontSize: isMobile ? '13px' : '14px'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.title}>
              🏘️ Junta de Vecinos
            </h1>
            <p style={styles.subtitle}>
              {currentUser.localidad || currentUser.name || currentUser.email}
            </p>
          </div>
          
          <button onClick={onLogout} style={styles.logoutButton}>
            {isMobile ? '🚪' : '🚪 Salir'}
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {/* Mensajes */}
        {message.text && (
          <div style={{
            ...styles.messageAlert,
            background: message.type === 'success' ? '#dcfce7' : 
                       message.type === 'error' ? '#fee2e2' : '#e0f2fe',
            border: `1px solid ${
              message.type === 'success' ? '#86efac' : 
              message.type === 'error' ? '#fecaca' : '#7dd3fc'
            }`,
            color: message.type === 'success' ? '#166534' : 
                   message.type === 'error' ? '#991b1b' : '#075985'
          }}>
            {message.text}
          </div>
        )}

        {/* Botón Nueva Solicitud */}
        {!showNewSolicitud && (
          <button onClick={() => setShowNewSolicitud(true)} style={styles.newSolicitudButton}>
            <span style={{ fontSize: isMobile ? '20px' : '24px' }}>➕</span>
            {isMobile ? 'Nueva Solicitud' : 'Nueva Solicitud de Maquinaria'}
          </button>
        )}

        {/* Formulario de Nueva Solicitud */}
        {showNewSolicitud && (
          <div style={styles.formContainer}>
            <div style={styles.formHeader}>
              <h2 style={styles.formTitle}>
                📝 Nueva Solicitud
              </h2>
              <button
                onClick={() => {
                  setShowNewSolicitud(false);
                  setFormData({
                    asunto: '',
                    tipoMaquinaria: '',
                    descripcion: '',
                    nombreSolicitante: '',
                    telefonoContacto: '',
                    fechaNecesaria: '',
                    duracionEstimada: '1',
                    prioridad: 'normal'
                  });
                  setSelectedLocation(null);
                  if (markerRef.current) {
                    markerRef.current.setMap(null);
                    markerRef.current = null;
                  }
                }}
                style={styles.cancelButton}
              >
                ✖ {isMobile ? '' : 'Cancelar'}
              </button>
            </div>

            <form onSubmit={handleSubmitSolicitud}>
              {/* Información del Solicitante */}
              <div style={styles.formSection}>
                <h3 style={styles.sectionTitle}>
                  👤 Información del Solicitante
                </h3>
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombreSolicitante}
                    onChange={(e) => setFormData({...formData, nombreSolicitante: e.target.value})}
                    placeholder="Ej: Juan Pérez González"
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Teléfono de Contacto *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.telefonoContacto}
                    onChange={(e) => setFormData({...formData, telefonoContacto: e.target.value})}
                    placeholder="+56 9 XXXX XXXX"
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Detalles de la Solicitud */}
              <div style={styles.formSection}>
                <h3 style={styles.sectionTitle}>
                  🚜 Detalles de la Solicitud
                </h3>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Asunto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.asunto}
                    onChange={(e) => setFormData({...formData, asunto: e.target.value})}
                    placeholder="Ej: Limpieza de canal"
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Tipo de Maquinaria *
                  </label>
                  <select
                    required
                    value={formData.tipoMaquinaria}
                    onChange={(e) => setFormData({...formData, tipoMaquinaria: e.target.value})}
                    style={styles.select}
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="retroexcavadora">🏗️ Retroexcavadora</option>
                    <option value="motoniveladora">🚧 Motoniveladora</option>
                    <option value="camion">🚛 Camión</option>
                    <option value="excavadora">⚒️ Excavadora</option>
                    <option value="bulldozer">🚜 Bulldozer</option>
                    <option value="otro">📋 Otro</option>
                  </select>
                </div>

                <div style={styles.gridTwoColumns}>
                  <div>
                    <label style={styles.label}>
                      Fecha Necesaria *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.fechaNecesaria}
                      onChange={(e) => setFormData({...formData, fechaNecesaria: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>
                      Duración (días) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="30"
                      value={formData.duracionEstimada}
                      onChange={(e) => setFormData({...formData, duracionEstimada: e.target.value})}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Prioridad *
                  </label>
                  <select
                    required
                    value={formData.prioridad}
                    onChange={(e) => setFormData({...formData, prioridad: e.target.value})}
                    style={styles.select}
                  >
                    <option value="baja">🟢 Baja</option>
                    <option value="normal">🟡 Normal</option>
                    <option value="alta">🟠 Alta</option>
                    <option value="urgente">🔴 Urgente</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Descripción Detallada *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    placeholder="Describa el trabajo a realizar..."
                    style={styles.textarea}
                  />
                </div>
              </div>

              {/* Ubicación */}
              <div style={styles.formSection}>
                <h3 style={styles.sectionTitle}>
                  📍 Ubicación del Trabajo *
                </h3>
                
                <p style={{
                  fontSize: isMobile ? '12px' : '13px',
                  color: '#6b7280',
                  marginBottom: '10px'
                }}>
                  {mapError ? 
                    'Ingresa las coordenadas manualmente o usa la ubicación por defecto' :
                    'Toca el mapa para marcar la ubicación exacta'
                  }
                </p>

                {/* Botones de ubicación */}
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '10px',
                  flexWrap: 'wrap'
                }}>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    style={{
                      flex: 1,
                      minWidth: isMobile ? '140px' : 'auto',
                      padding: '8px 12px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>📍</span>
                    Usar mi ubicación actual
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleManualLocation}
                    style={{
                      flex: 1,
                      minWidth: isMobile ? '140px' : 'auto',
                      padding: '8px 12px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>🏘️</span>
                    Ubicación de Quillón
                  </button>
                </div>

                <div ref={mapRef} style={styles.mapContainer}>
                  {mapError && (
                    <div style={styles.mapError}>
                      <div style={{ fontSize: '48px', marginBottom: '10px' }}>🗺️</div>
                      <p style={{ marginBottom: '15px' }}>
                        No se pudo cargar el mapa
                      </p>
                      <p style={{ fontSize: '12px', color: '#6b7280' }}>
                        Usa los botones de arriba para seleccionar una ubicación
                      </p>
                    </div>
                  )}
                </div>

                {selectedLocation && (
                  <div style={styles.locationInfo}>
                    📍 Ubicación seleccionada: 
                    <br />
                    Lat: {selectedLocation.lat.toFixed(6)}, 
                    Lng: {selectedLocation.lng.toFixed(6)}
                  </div>
                )}

                {mapError && (
                  <div style={styles.manualLocationInput}>
                    <div>
                      <label style={{ ...styles.label, fontSize: '12px' }}>
                        Latitud (opcional)
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={selectedLocation?.lat || ''}
                        onChange={(e) => setSelectedLocation({
                          ...selectedLocation,
                          lat: parseFloat(e.target.value) || -36.7333
                        })}
                        placeholder="-36.7333"
                        style={{ ...styles.input, fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ ...styles.label, fontSize: '12px' }}>
                        Longitud (opcional)
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={selectedLocation?.lng || ''}
                        onChange={(e) => setSelectedLocation({
                          ...selectedLocation,
                          lng: parseFloat(e.target.value) || -72.4667
                        })}
                        placeholder="-72.4667"
                        style={{ ...styles.input, fontSize: '14px' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botones */}
              <div style={styles.buttonGroup}>
                <button
                  type="submit"
                  disabled={loading}
                  style={styles.submitButton}
                >
                  {loading ? '⏳ Enviando...' : '📤 Enviar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Solicitudes */}
        <div style={styles.solicitudesList}>
          <h2 style={{
            margin: `0 0 ${isMobile ? '15px' : '20px'} 0`,
            fontSize: isMobile ? '16px' : '18px',
            color: '#1f2937'
          }}>
            📋 Mis Solicitudes
          </h2>

          {solicitudes.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: isMobile ? '36px' : '48px', marginBottom: '10px' }}>📭</div>
              <p>No tienes solicitudes registradas</p>
              <p style={{ fontSize: isMobile ? '12px' : '14px' }}>
                Haz clic en "Nueva Solicitud" para comenzar
              </p>
            </div>
          ) : (
            <div>
              {solicitudes.map((solicitud) => (
                <div
                  key={solicitud.id}
                  style={styles.solicitudCard}
                  onClick={() => setExpandedSolicitud(
                    expandedSolicitud === solicitud.id ? null : solicitud.id
                  )}
                >
                  <div style={styles.solicitudHeader}>
                    <div style={{ flex: 1 }}>
                      <h3 style={styles.solicitudTitle}>
                        {solicitud.asunto}
                      </h3>
                      <p style={styles.solicitudDate}>
                        {new Date(solicitud.fechaSolicitud).toLocaleDateString('es-CL')}
                      </p>
                    </div>
                    <span style={{
                      ...styles.estadoBadge,
                      background: getEstadoColor(solicitud.estado) + '20',
                      color: getEstadoColor(solicitud.estado)
                    }}>
                      {getEstadoTexto(solicitud.estado)}
                    </span>
                  </div>

                  {expandedSolicitud === solicitud.id && (
                    <div style={styles.solicitudDetails}>
                      <strong>Tipo:</strong> {solicitud.tipoMaquinaria}<br/>
                      <strong>Fecha necesaria:</strong> {new Date(solicitud.fechaNecesaria).toLocaleDateString('es-CL')}<br/>
                      <strong>Duración:</strong> {solicitud.duracionEstimada} día(s)<br/>
                      <strong>Prioridad:</strong> {solicitud.prioridad}
                    </div>
                  )}

                  {solicitud.respuesta && (
                    <div style={{
                      ...styles.respuestaBox,
                      background: solicitud.estado === 'aprobada' ? '#dcfce7' : '#fee2e2'
                    }}>
                      <strong>Respuesta:</strong><br/>
                      {solicitud.respuesta}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JuntaVecinosPanel;