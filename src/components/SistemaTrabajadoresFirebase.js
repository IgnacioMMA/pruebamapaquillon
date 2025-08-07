// src/components/SistemaTrabajadoresFirebase.js
import React, { useEffect, useRef, useState } from 'react';

// Zonas de trabajo disponibles (esto podría venir de Firebase)
const zonasDisponibles = [
  { id: 1, nombre: "Obra Sector Norte", lat: -36.741, lng: -72.538, direccion: "Av. Principal 123" },
  { id: 2, nombre: "Reparación Puente", lat: -36.728, lng: -72.470, direccion: "Puente Los Aromos" },
  { id: 3, nombre: "Pavimentación Ruta", lat: -36.720, lng: -72.480, direccion: "Ruta Q-45 Km 12" },
  { id: 4, nombre: "Construcción Plaza", lat: -36.735, lng: -72.465, direccion: "Plaza Central" },
  { id: 5, nombre: "Mantención Parque", lat: -36.745, lng: -72.455, direccion: "Parque Municipal" },
];

const SistemaTrabajadoresFirebase = () => {
  // Estados principales
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [selectedZona, setSelectedZona] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [workStatus, setWorkStatus] = useState('idle'); // idle, traveling, working, completed
  const [workLog, setWorkLog] = useState({
    startTime: null,
    arrivalTime: null,
    endTime: null,
    zona: null
  });
  
  // Referencias para marcadores y servicios
  const userMarkerRef = useRef(null);
  const zonaMarkerRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const watchIdRef = useRef(null);
  
  // Estados de UI
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [showWorkLog, setShowWorkLog] = useState(false);

  const API_KEY = 'AIzaSyA7DrdL36n5cx-RNzuXGAQggFeGCheHDbY';

  // Función para cargar Google Maps
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
          } else {
            reject(new Error('Google Maps no disponible'));
          }
        };

        script.onerror = () => {
          reject(new Error('Error al cargar Google Maps'));
        };

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
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true
        });

        setMap(mapInstance);
        
        // Inicializar servicios de direcciones
        directionsServiceRef.current = new maps.DirectionsService();
        directionsRendererRef.current = new maps.DirectionsRenderer({
          map: mapInstance,
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: '#4285F4',
            strokeWeight: 6,
            strokeOpacity: 0.8
          }
        });

        setMapLoaded(true);
      } catch (err) {
        setError('Error al cargar el mapa: ' + err.message);
      }
    };

    initMap();
  }, []);

  // Función para activar/desactivar GPS
  const toggleGPS = () => {
    if (isTracking) {
      // Detener tracking
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      
      // Limpiar marcador de usuario
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      setUserPosition(null);
    } else {
      // Iniciar tracking
      if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización');
        return;
      }

      setIsTracking(true);
      
      // Obtener posición inicial
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          updateUserPosition(pos);
        },
        (error) => {
          console.error('Error al obtener ubicación:', error);
          alert('Error al obtener tu ubicación. Verifica los permisos de GPS.');
          setIsTracking(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );

      // Seguimiento continuo
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          updateUserPosition(pos);
        },
        (error) => {
          console.error('Error en tracking:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }
  };

  // Actualizar posición del usuario en el mapa
  const updateUserPosition = (position) => {
    setUserPosition(position);
    
    if (!map || !window.google) return;

    // Crear o actualizar marcador del usuario
    if (!userMarkerRef.current) {
      userMarkerRef.current = new window.google.maps.Marker({
        position: position,
        map: map,
        title: 'Tu ubicación',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3
        },
        zIndex: 1000
      });
      
      // Centrar mapa en usuario
      map.setCenter(position);
      map.setZoom(15);
    } else {
      userMarkerRef.current.setPosition(position);
    }

    // Si está navegando, actualizar distancia
    if (isNavigating && selectedZona) {
      const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(position.lat, position.lng),
        new window.google.maps.LatLng(selectedZona.lat, selectedZona.lng)
      );
      
      // Si llegó al destino (menos de 50 metros)
      if (distance < 50 && workStatus === 'traveling') {
        handleArrival();
      }
    }
  };

  // Seleccionar zona de trabajo
  const selectZona = (zona) => {
    setSelectedZona(zona);
    
    if (!map || !window.google) return;

    // Limpiar marcador anterior
    if (zonaMarkerRef.current) {
      zonaMarkerRef.current.setMap(null);
    }

    // Crear marcador de zona
    zonaMarkerRef.current = new window.google.maps.Marker({
      position: { lat: zona.lat, lng: zona.lng },
      map: map,
      title: zona.nombre,
      icon: {
        path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 8,
        fillColor: '#22c55e',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    });

    // Ajustar vista para mostrar ambos puntos
    if (userPosition) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(userPosition);
      bounds.extend({ lat: zona.lat, lng: zona.lng });
      map.fitBounds(bounds, 100);
    } else {
      map.setCenter({ lat: zona.lat, lng: zona.lng });
      map.setZoom(15);
    }
  };

  // Iniciar navegación
  const startNavigation = () => {
    if (!selectedZona || !userPosition) {
      alert('Debes activar el GPS y seleccionar una zona primero');
      return;
    }

    setIsNavigating(true);
    setWorkStatus('traveling');
    setWorkLog({
      ...workLog,
      startTime: new Date().toISOString(),
      zona: selectedZona
    });

    // Calcular y mostrar ruta
    const request = {
      origin: userPosition,
      destination: { lat: selectedZona.lat, lng: selectedZona.lng },
      travelMode: window.google.maps.TravelMode.DRIVING
    };

    directionsServiceRef.current.route(request, (result, status) => {
      if (status === 'OK') {
        directionsRendererRef.current.setDirections(result);
        
        const route = result.routes[0];
        const leg = route.legs[0];
        
        setDistance(leg.distance.text);
        setDuration(leg.duration.text);
      } else {
        alert('No se pudo calcular la ruta: ' + status);
      }
    });
  };

  // Manejar llegada a la zona
  const handleArrival = () => {
    setWorkStatus('working');
    setWorkLog({
      ...workLog,
      arrivalTime: new Date().toISOString()
    });
    
    alert('¡Has llegado a la zona de trabajo! Puedes iniciar tu tarea.');
  };

  // Finalizar trabajo
  const finishWork = () => {
    const endTime = new Date().toISOString();
    const finalLog = {
      ...workLog,
      endTime: endTime
    };
    
    setWorkLog(finalLog);
    setWorkStatus('completed');
    setIsNavigating(false);
    setShowWorkLog(true);
    
    // Limpiar ruta
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
    }
    
    // Aquí podrías enviar los datos a Firebase
    console.log('Registro de trabajo:', finalLog);
  };

  // Resetear para nuevo trabajo
  const resetWork = () => {
    setSelectedZona(null);
    setWorkStatus('idle');
    setWorkLog({
      startTime: null,
      arrivalTime: null,
      endTime: null,
      zona: null
    });
    setIsNavigating(false);
    setDistance(null);
    setDuration(null);
    setShowWorkLog(false);
    
    if (zonaMarkerRef.current) {
      zonaMarkerRef.current.setMap(null);
      zonaMarkerRef.current = null;
    }
    
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
    }
  };

  // Formatear tiempo
  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-CL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Calcular duración
  const calculateDuration = (start, end) => {
    if (!start || !end) return '--';
    const diff = new Date(end) - new Date(start);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Encabezado */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        color: 'white',
        padding: '15px 20px',
        zIndex: 1000,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
          👷‍♂️ Panel del Trabajador
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.95 }}>
          GPS y Navegación a Zona de Trabajo
        </p>
      </div>

      {/* Panel de control principal */}
      <div style={{
        position: 'absolute',
        top: '70px',
        left: '10px',
        right: '10px',
        background: 'white',
        borderRadius: '12px',
        padding: '15px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        zIndex: 1000,
        maxWidth: '400px'
      }}>
        {/* Activación GPS */}
        <div style={{ marginBottom: '15px' }}>
          <button
            onClick={toggleGPS}
            style={{
              width: '100%',
              padding: '12px',
              background: isTracking ? '#ef4444' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isTracking ? '📍 Desactivar GPS' : '📍 Activar GPS'}
          </button>
          {userPosition && (
            <div style={{ 
              marginTop: '8px', 
              fontSize: '12px', 
              color: '#666',
              textAlign: 'center'
            }}>
              📍 Ubicación: {userPosition.lat.toFixed(4)}, {userPosition.lng.toFixed(4)}
            </div>
          )}
        </div>

        {/* Selector de zona */}
        {isTracking && workStatus === 'idle' && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500' 
            }}>
              🏗️ Seleccionar Zona de Trabajo:
            </label>
            <select
              value={selectedZona?.id || ''}
              onChange={(e) => {
                const zona = zonasDisponibles.find(z => z.id === parseInt(e.target.value));
                if (zona) selectZona(zona);
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            >
              <option value="">-- Seleccionar zona --</option>
              {zonasDisponibles.map(zona => (
                <option key={zona.id} value={zona.id}>
                  {zona.nombre} - {zona.direccion}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Información de zona seleccionada */}
        {selectedZona && (
          <div style={{
            background: '#f0f9ff',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '15px',
            border: '1px solid #bae6fd'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#0369a1', fontSize: '14px' }}>
              Zona Seleccionada:
            </h4>
            <div style={{ fontSize: '13px', color: '#333' }}>
              <strong>{selectedZona.nombre}</strong><br/>
              📍 {selectedZona.direccion}
              {distance && duration && (
                <div style={{ marginTop: '8px', color: '#666' }}>
                  🚗 {distance} • ⏱️ {duration}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botones de acción según estado */}
        {workStatus === 'idle' && selectedZona && userPosition && (
          <button
            onClick={startNavigation}
            style={{
              width: '100%',
              padding: '12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            🚗 Iniciar Recorrido
          </button>
        )}

        {workStatus === 'traveling' && (
          <div style={{
            background: '#fef3c7',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #fde68a'
          }}>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#92400e' }}>
              🚗 En camino...
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#78350f' }}>
              Hora de salida: {formatTime(workLog.startTime)}
            </div>
          </div>
        )}

        {workStatus === 'working' && (
          <div>
            <div style={{
              background: '#dcfce7',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '12px',
              border: '1px solid #bbf7d0'
            }}>
              <div style={{ fontSize: '16px', fontWeight: '500', color: '#14532d' }}>
                ✅ En zona de trabajo
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#166534' }}>
                Llegada: {formatTime(workLog.arrivalTime)}
              </div>
            </div>
            <button
              onClick={finishWork}
              style={{
                width: '100%',
                padding: '12px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              🏁 Finalizar Trabajo
            </button>
          </div>
        )}

        {workStatus === 'completed' && (
          <div>
            <div style={{
              background: '#e0e7ff',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '12px',
              border: '1px solid #c7d2fe'
            }}>
              <div style={{ fontSize: '16px', fontWeight: '500', color: '#312e81' }}>
                ✅ Trabajo Completado
              </div>
              <button
                onClick={() => setShowWorkLog(!showWorkLog)}
                style={{
                  marginTop: '8px',
                  padding: '6px 12px',
                  background: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                📋 Ver Resumen
              </button>
            </div>
            <button
              onClick={resetWork}
              style={{
                width: '100%',
                padding: '12px',
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              🔄 Nuevo Trabajo
            </button>
          </div>
        )}
      </div>

      {/* Modal de resumen de trabajo */}
      {showWorkLog && workLog.zona && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '400px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>
              📋 Resumen del Trabajo
            </h3>
            
            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <div style={{ marginBottom: '15px' }}>
                <strong>Zona de trabajo:</strong><br/>
                {workLog.zona.nombre}<br/>
                📍 {workLog.zona.direccion}
              </div>
              
              <div style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>🚗 Hora de salida:</strong> {formatTime(workLog.startTime)}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>✅ Hora de llegada:</strong> {formatTime(workLog.arrivalTime)}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>🏁 Hora de término:</strong> {formatTime(workLog.endTime)}
                </div>
                <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #e5e7eb' }}/>
                <div>
                  <strong>⏱️ Tiempo de viaje:</strong> {calculateDuration(workLog.startTime, workLog.arrivalTime)}
                </div>
                <div>
                  <strong>⏱️ Tiempo trabajado:</strong> {calculateDuration(workLog.arrivalTime, workLog.endTime)}
                </div>
                <div>
                  <strong>⏱️ Tiempo total:</strong> {calculateDuration(workLog.startTime, workLog.endTime)}
                </div>
              </div>
              
              <button
                onClick={() => setShowWorkLog(false)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
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
            borderTop: '4px solid #22c55e',
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

export default SistemaTrabajadoresFirebase;