// src/components/TrabajadorVehiclePanel.js
import React, { useState, useEffect } from 'react';
import { vehiculosService, trabajadoresService } from '../services/firebaseservices';
import chileCitiesService from '../services/chileCitiesService';

const TrabajadorVehiclePanel = ({ currentUser, onClose }) => {
  const [vehiculos, setVehiculos] = useState([]);
  const [selectedVehiculo, setSelectedVehiculo] = useState('');
  const [destino, setDestino] = useState('');
  const [ciudades, setCiudades] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCiudades, setShowCiudades] = useState(false);
  const [trabajadorData, setTrabajadorData] = useState(null);
  const [message, setMessage] = useState(null);

  // Cargar vehículos disponibles
  useEffect(() => {
    const unsubscribe = vehiculosService.subscribeToVehiculos((vehiculosData) => {
      // Filtrar solo vehículos disponibles o el asignado al trabajador
      const disponibles = vehiculosData.filter(v => 
        v.estado === 'disponible' || v.asignadoA === currentUser.uid
      );
      setVehiculos(disponibles);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Cargar datos del trabajador
  useEffect(() => {
    const unsubscribe = trabajadoresService.getTrabajadorById(
      currentUser.uid, 
      (data) => {
        setTrabajadorData(data);
        if (data) {
          setSelectedVehiculo(data.vehiculoAsignado || '');
          setDestino(data.destino || '');
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Cargar ciudades al escribir
  // El código ya maneja el fallback correctamente
useEffect(() => {
  const loadCiudades = async () => {
    if (searchTerm.length >= 2) {
      setLoading(true);
      try {
        // Usar directamente la búsqueda local
        const results = await chileCitiesService.searchCities(searchTerm);
        setCiudades(results);
        setShowCiudades(true);
      } catch (error) {
        console.error('Error al buscar ciudades:', error);
        setCiudades([]);
      } finally {
        setLoading(false);
      }
    } else {
      setCiudades([]);
      setShowCiudades(false);
    }
  };

  const debounceTimer = setTimeout(loadCiudades, 300);
  return () => clearTimeout(debounceTimer);
}, [searchTerm]);

  // Guardar cambios
  const handleSave = async () => {
    if (!selectedVehiculo) {
      setMessage({ type: 'error', text: '⚠️ Debes seleccionar un vehículo' });
      return;
    }

    if (!destino) {
      setMessage({ type: 'error', text: '⚠️ Debes indicar el destino' });
      return;
    }

    setLoading(true);
    try {
      // Actualizar datos del trabajador
      await trabajadoresService.updateTrabajadorData(currentUser.uid, {
        vehiculoAsignado: selectedVehiculo,
        destino: destino,
        destinoActualizadoEn: new Date().toISOString()
      });

      // Actualizar estado del vehículo
      await vehiculosService.updateVehiculoEstado(selectedVehiculo, 'en_uso', {
        asignadoA: currentUser.uid,
        asignadoNombre: currentUser.name,
        destino: destino
      });

      // Si había un vehículo anterior diferente, liberarlo
      if (trabajadorData?.vehiculoAsignado && 
          trabajadorData.vehiculoAsignado !== selectedVehiculo) {
        await vehiculosService.updateVehiculoEstado(
          trabajadorData.vehiculoAsignado, 
          'disponible', 
          {
            asignadoA: null,
            asignadoNombre: null,
            destino: null
          }
        );
      }

      setMessage({ 
        type: 'success', 
        text: '✅ Información actualizada correctamente' 
      });

      // Cerrar el panel después de 2 segundos
      setTimeout(() => {
        if (onClose) onClose();
      }, 2000);

    } catch (error) {
      console.error('Error al guardar:', error);
      setMessage({ 
        type: 'error', 
        text: '❌ Error al guardar los cambios' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Seleccionar ciudad
  const handleSelectCiudad = (ciudad) => {
    setDestino(`${ciudad.nombre}, ${ciudad.region}`);
    setSearchTerm(ciudad.nombre);
    setShowCiudades(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px 12px 0 0'
        }}>
          <h2 style={{ 
            margin: 0, 
            color: 'white',
            fontSize: '24px',
            fontWeight: '600'
          }}>
            🚛 Configurar Vehículo y Destino
          </h2>
          <p style={{ 
            margin: '5px 0 0 0', 
            color: 'rgba(255,255,255,0.9)',
            fontSize: '14px'
          }}>
            Selecciona tu vehículo e indica tu destino
          </p>
        </div>

        {/* Mensaje */}
        {message && (
          <div style={{
            margin: '20px 20px 0',
            padding: '12px',
            borderRadius: '8px',
            background: message.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: message.type === 'error' ? '#dc2626' : '#065f46',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {message.text}
          </div>
        )}

        {/* Contenido */}
        <div style={{ padding: '20px' }}>
          {/* Selección de Vehículo */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              🚛 Vehículo Asignado
            </label>
            <select
              value={selectedVehiculo}
              onChange={(e) => setSelectedVehiculo(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            >
              <option value="">Seleccionar vehículo...</option>
              {vehiculos.map(vehiculo => (
                <option key={vehiculo.id} value={vehiculo.id}>
                  {vehiculo.nombre} - {vehiculo.marca} {vehiculo.modelo} 
                  ({vehiculo.patente || 'Sin patente'})
                  {vehiculo.asignadoA === currentUser.uid && ' ✅ (Actual)'}
                </option>
              ))}
            </select>
          </div>

          {/* Campo de Destino */}
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              📍 Ciudad de Destino
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchTerm.length >= 2 && setShowCiudades(true)}
              placeholder="Escribe el nombre de la ciudad..."
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
            
            {/* Lista de ciudades */}
            {showCiudades && ciudades.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 10,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                {loading ? (
                  <div style={{ padding: '10px', textAlign: 'center', color: '#6b7280' }}>
                    Buscando ciudades...
                  </div>
                ) : (
                  ciudades.map((ciudad, index) => (
                    <div
                      key={ciudad.codigo || index}
                      onClick={() => handleSelectCiudad(ciudad)}
                      style={{
                        padding: '10px',
                        cursor: 'pointer',
                        borderBottom: index < ciudades.length - 1 ? '1px solid #f3f4f6' : 'none',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.background = 'white'}
                    >
                      <div style={{ fontSize: '14px', color: '#1f2937' }}>
                        {ciudad.nombre}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Región {ciudad.region}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Destino seleccionado */}
            {destino && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                background: '#f0fdf4',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#15803d'
              }}>
                📍 Destino actual: <strong>{destino}</strong>
              </div>
            )}
          </div>

          {/* Información del vehículo seleccionado */}
          {selectedVehiculo && vehiculos.find(v => v.id === selectedVehiculo) && (
            <div style={{
              padding: '15px',
              background: '#f9fafb',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1f2937', fontSize: '14px' }}>
                Información del Vehículo:
              </h4>
              {(() => {
                const vehiculo = vehiculos.find(v => v.id === selectedVehiculo);
                return (
                  <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                    <div>📌 <strong>Marca:</strong> {vehiculo.marca}</div>
                    <div>📌 <strong>Modelo:</strong> {vehiculo.modelo}</div>
                    <div>📌 <strong>Año:</strong> {vehiculo.año || 'No especificado'}</div>
                    <div>📌 <strong>Patente:</strong> {vehiculo.patente || 'No especificada'}</div>
                    <div>📌 <strong>Estado:</strong> {
                      vehiculo.estado === 'disponible' ? '✅ Disponible' :
                      vehiculo.estado === 'en_uso' ? '🔧 En uso' :
                      vehiculo.estado
                    }</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Botones de acción */}
          <div style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              Cancelar
            </button>
            
            <button
              onClick={handleSave}
              disabled={loading || !selectedVehiculo || !destino}
              style={{
                padding: '10px 20px',
                background: loading || !selectedVehiculo || !destino 
                  ? '#9ca3af' 
                  : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading || !selectedVehiculo || !destino 
                  ? 'not-allowed' 
                  : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid white',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></span>
                  Guardando...
                </>
              ) : (
                <>✅ Guardar Cambios</>
              )}
            </button>
          </div>
        </div>
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

export default TrabajadorVehiclePanel;