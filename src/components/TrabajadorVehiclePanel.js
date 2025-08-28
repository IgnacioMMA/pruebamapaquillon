// src/components/TrabajadorVehiclePanel.js
import React, { useState, useEffect } from 'react';
import { vehiculosService, trabajadoresService } from '../services/firebaseservices';

const TrabajadorVehiclePanel = ({ currentUser, onClose }) => {
  const [vehiculoAsignado, setVehiculoAsignado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingVehiculo, setLoadingVehiculo] = useState(true); // NUEVO: Estado de carga inicial
  const [message, setMessage] = useState(null);
  const [trabajadorData, setTrabajadorData] = useState(null);
  
  // Estados del formulario de viaje
  const [formViaje, setFormViaje] = useState({
    fechaSalida: new Date().toISOString().split('T')[0], // Fecha de hoy
    horaSalida: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    kilometrajeSalida: '',
    destino: '',
    motivoViaje: 'trabajo', // trabajo, emergencia, mantenimiento
    observaciones: ''
  });

  // Estado para el viaje activo
  const [viajeActivo, setViajeActivo] = useState(null);

  // Cargar datos del trabajador y su vehículo
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      console.log('🔄 Iniciando carga de vehículo para:', currentUser.uid);
      setLoadingVehiculo(true);
      
      try {
        // Esperar un momento para que Firebase se estabilice
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar si el componente sigue montado
        if (!mounted) return;
        
        // Obtener datos del trabajador
        let trabajadorData = null;
        await new Promise((resolve) => {
          const unsubscribe = trabajadoresService.getTrabajadorById(
            currentUser.uid,
            (data) => {
              console.log('👷 Datos del trabajador:', data);
              trabajadorData = data;
              setTrabajadorData(data);
              if (data?.viajeActivo) {
                setViajeActivo(data.viajeActivo);
              }
              resolve();
            }
          );
          
          // Timeout para evitar espera infinita
          setTimeout(() => resolve(), 3000);
        });
        
        // Verificar vehículos
        await new Promise((resolve) => {
          const unsubscribe = vehiculosService.subscribeToVehiculos((vehiculosData) => {
            console.log('🚛 Total de vehículos:', vehiculosData.length);
            
            // Buscar vehículo asignado
            let vehiculoEncontrado = null;
            
            // Buscar por diferentes campos
            vehiculoEncontrado = vehiculosData.find(v => {
              const asignado = v.asignadoA === currentUser.uid || 
                               v.operadorAsignado === currentUser.uid ||
                               v.trabajadorAsignado === currentUser.uid;
              
              if (asignado) {
                console.log('✅ Vehículo encontrado por asignación directa:', v.nombre);
              }
              return asignado;
            });
            
            // Si no encuentra, buscar por ID en datos del trabajador
            if (!vehiculoEncontrado && trabajadorData?.vehiculoAsignado) {
              vehiculoEncontrado = vehiculosData.find(v => v.id === trabajadorData.vehiculoAsignado);
              if (vehiculoEncontrado) {
                console.log('✅ Vehículo encontrado por ID del trabajador:', vehiculoEncontrado.nombre);
              }
            }
            
            // Si no encuentra, buscar por vehicleId del usuario
            if (!vehiculoEncontrado && currentUser.vehicleId) {
              vehiculoEncontrado = vehiculosData.find(v => v.id === currentUser.vehicleId);
              if (vehiculoEncontrado) {
                console.log('✅ Vehículo encontrado por vehicleId:', vehiculoEncontrado.nombre);
              }
            }
            
            if (vehiculoEncontrado) {
              console.log('✅ VEHÍCULO ASIGNADO:', vehiculoEncontrado);
              setVehiculoAsignado(vehiculoEncontrado);
              setFormViaje(prev => ({
                ...prev,
                kilometrajeSalida: vehiculoEncontrado.kilometraje?.toString() || ''
              }));
            } else {
              console.log('❌ NO HAY VEHÍCULO ASIGNADO');
              setVehiculoAsignado(null);
            }
            
            // Solo cambiar loading a false después de verificar todo
            if (mounted) {
              setLoadingVehiculo(false);
            }
            
            resolve();
          });
          
          // Timeout para evitar espera infinita
          setTimeout(() => {
            if (mounted) {
              setLoadingVehiculo(false);
            }
            resolve();
          }, 3000);
        });
        
      } catch (error) {
        console.error('❌ Error al cargar datos:', error);
        if (mounted) {
          setMessage({
            type: 'error',
            text: '❌ Error al cargar información'
          });
          setLoadingVehiculo(false);
          setVehiculoAsignado(null);
        }
      }
    };
    
    loadData();
    
    // Cleanup function
    return () => {
      mounted = false;
    };
  }, [currentUser.uid]);

  // Iniciar viaje
  const handleIniciarViaje = async () => {
    // Validaciones
    if (!formViaje.destino) {
      setMessage({ type: 'error', text: '⚠️ Debes indicar el destino' });
      return;
    }

    if (!formViaje.kilometrajeSalida) {
      setMessage({ type: 'error', text: '⚠️ Debes indicar el kilometraje actual' });
      return;
    }

    setLoading(true);
    try {
      const viajeData = {
        vehiculoId: vehiculoAsignado.id,
        vehiculoNombre: vehiculoAsignado.nombre,
        trabajadorId: currentUser.uid,
        trabajadorNombre: currentUser.name,
        fechaSalida: formViaje.fechaSalida,
        horaSalida: formViaje.horaSalida,
        kilometrajeSalida: parseInt(formViaje.kilometrajeSalida),
        destino: formViaje.destino,
        motivoViaje: formViaje.motivoViaje,
        observaciones: formViaje.observaciones,
        estado: 'en_curso',
        iniciadoEn: new Date().toISOString()
      };

      // Actualizar estado del vehículo a "en_uso"
      await vehiculosService.updateVehiculoEstado(vehiculoAsignado.id, 'en_uso', {
        asignadoA: currentUser.uid,
        asignadoNombre: currentUser.name,
        destino: formViaje.destino,
        kilometrajeUltimoViaje: parseInt(formViaje.kilometrajeSalida),
        viajeActivo: viajeData
      });

      // Actualizar datos del trabajador con el viaje activo
      await trabajadoresService.updateTrabajadorData(currentUser.uid, {
        viajeActivo: viajeData,
        estadoActual: 'en_viaje',
        ultimoDestino: formViaje.destino
      });

      setViajeActivo(viajeData);
      setMessage({
        type: 'success',
        text: '✅ Viaje iniciado exitosamente'
      });

    } catch (error) {
      console.error('Error al iniciar viaje:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al iniciar el viaje'
      });
    } finally {
      setLoading(false);
    }
  };

  // Finalizar viaje
  const handleFinalizarViaje = async () => {
    const kilometrajeLlegada = prompt('Ingresa el kilometraje al finalizar el viaje:');
    if (!kilometrajeLlegada) return;

    setLoading(true);
    try {
      const horaLlegada = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      const kmRecorridos = parseInt(kilometrajeLlegada) - viajeActivo.kilometrajeSalida;

      // Actualizar vehículo
      await vehiculosService.updateVehiculoEstado(vehiculoAsignado.id, 'disponible', {
        asignadoA: currentUser.uid,
        kilometraje: parseInt(kilometrajeLlegada),
        ultimoViaje: {
          ...viajeActivo,
          fechaLlegada: new Date().toISOString().split('T')[0],
          horaLlegada: horaLlegada,
          kilometrajeLlegada: parseInt(kilometrajeLlegada),
          kilometrosRecorridos: kmRecorridos,
          estado: 'finalizado'
        }
      });

      // Limpiar viaje activo del trabajador
      await trabajadoresService.updateTrabajadorData(currentUser.uid, {
        viajeActivo: null,
        estadoActual: 'disponible',
        ultimoViaje: {
          ...viajeActivo,
          fechaLlegada: new Date().toISOString().split('T')[0],
          horaLlegada: horaLlegada,
          kilometrajeLlegada: parseInt(kilometrajeLlegada),
          kilometrosRecorridos: kmRecorridos
        }
      });

      setViajeActivo(null);
      setMessage({
        type: 'success',
        text: `✅ Viaje finalizado. Recorriste ${kmRecorridos} km`
      });

    } catch (error) {
      console.error('Error al finalizar viaje:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al finalizar el viaje'
      });
    } finally {
      setLoading(false);
    }
  };

  // Si está cargando, mostrar indicador de carga
  if (loadingVehiculo) {
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
          padding: '30px',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <h3 style={{ color: '#1f2937', marginBottom: '10px' }}>
            Cargando información...
          </h3>
          <p style={{ color: '#6b7280' }}>
            Verificando vehículo asignado
          </p>
        </div>
      </div>
    );
  }

  // Si no hay vehículo asignado (después de cargar)
  if (!loadingVehiculo && !vehiculoAsignado) {
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
          padding: '30px',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚫</div>
          <h3 style={{ color: '#1f2937', marginBottom: '10px' }}>
            No tienes vehículo asignado
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            Contacta con tu supervisor para que te asigne un vehículo
          </p>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

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
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
          borderRadius: '12px 12px 0 0',
          color: 'white'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
                🚛 Control de Vehículo
              </h2>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                {viajeActivo ? 'Viaje en curso' : 'Registrar salida de vehículo'}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                padding: '8px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ✖
            </button>
          </div>
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

        {/* Información del vehículo */}
        <div style={{
          padding: '20px',
          background: '#f0f9ff',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            margin: '0 0 15px 0',
            color: '#0c4a6e',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Vehículo Asignado
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '15px'
          }}>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Vehículo:</span>
              <p style={{ margin: '4px 0', fontWeight: '600', color: '#0c4a6e' }}>
                {vehiculoAsignado.nombre}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Patente:</span>
              <p style={{ margin: '4px 0', fontWeight: '600', color: '#0c4a6e' }}>
                {vehiculoAsignado.patente || 'Sin patente'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Marca/Modelo:</span>
              <p style={{ margin: '4px 0', fontWeight: '600', color: '#0c4a6e' }}>
                {vehiculoAsignado.marca} {vehiculoAsignado.modelo}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Estado:</span>
              <p style={{ margin: '4px 0', fontWeight: '600' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: viajeActivo ? '#fef3c7' : '#dcfce7',
                  color: viajeActivo ? '#92400e' : '#15803d'
                }}>
                  {viajeActivo ? '🚗 En viaje' : '✅ Disponible'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <div style={{ padding: '20px' }}>
          {!viajeActivo ? (
            // Formulario para iniciar viaje
            <form onSubmit={(e) => { e.preventDefault(); handleIniciarViaje(); }}>
              <div style={{ display: 'grid', gap: '15px' }}>
                {/* Fecha y hora de salida */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151'
                    }}>
                      📅 Fecha de Salida
                    </label>
                    <input
                      type="date"
                      value={formViaje.fechaSalida}
                      onChange={(e) => setFormViaje({ ...formViaje, fechaSalida: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151'
                    }}>
                      ⏰ Hora de Salida
                    </label>
                    <input
                      type="time"
                      value={formViaje.horaSalida}
                      onChange={(e) => setFormViaje({ ...formViaje, horaSalida: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>

                {/* Kilometraje */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    🚗 Kilometraje Actual
                  </label>
                  <input
                    type="number"
                    value={formViaje.kilometrajeSalida}
                    onChange={(e) => setFormViaje({ ...formViaje, kilometrajeSalida: e.target.value })}
                    placeholder="Ej: 45000"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px' }}>
                    Último registro: {vehiculoAsignado.kilometraje || 0} km
                  </small>
                </div>

                {/* Destino */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    📍 Destino
                  </label>
                  <input
                    type="text"
                    value={formViaje.destino}
                    onChange={(e) => setFormViaje({ ...formViaje, destino: e.target.value })}
                    placeholder="Ingresa el lugar de destino"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {/* Motivo del viaje */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    📋 Motivo del Viaje
                  </label>
                  <select
                    value={formViaje.motivoViaje}
                    onChange={(e) => setFormViaje({ ...formViaje, motivoViaje: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="trabajo">Trabajo en terreno</option>
                    <option value="emergencia">Emergencia</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="traslado">Traslado de personal</option>
                    <option value="carga">Transporte de carga</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                {/* Observaciones */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    📝 Observaciones (Opcional)
                  </label>
                  <textarea
                    value={formViaje.observaciones}
                    onChange={(e) => setFormViaje({ ...formViaje, observaciones: e.target.value })}
                    placeholder="Detalles adicionales del viaje..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'none'
                    }}
                  />
                </div>

                {/* Botón de acción */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '14px',
                    background: loading ? '#9ca3af' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {loading ? (
                    <>
                      <span style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></span>
                      Iniciando...
                    </>
                  ) : (
                    <>
                      🚀 INICIAR VIAJE
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            // Información del viaje activo
            <div>
              <div style={{
                padding: '20px',
                background: '#fef3c7',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h3 style={{
                  margin: '0 0 15px 0',
                  color: '#92400e',
                  fontSize: '18px',
                  fontWeight: '600'
                }}>
                  🚗 Viaje en Curso
                </h3>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: '#92400e' }}>Destino:</span>
                    <p style={{ margin: '4px 0', fontWeight: '600', fontSize: '15px' }}>
                      {viajeActivo.destino}
                    </p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <span style={{ fontSize: '13px', color: '#92400e' }}>Hora de salida:</span>
                      <p style={{ margin: '4px 0', fontWeight: '600' }}>
                        {viajeActivo.horaSalida}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', color: '#92400e' }}>Km de salida:</span>
                      <p style={{ margin: '4px 0', fontWeight: '600' }}>
                        {viajeActivo.kilometrajeSalida} km
                      </p>
                    </div>
                  </div>
                  {viajeActivo.observaciones && (
                    <div>
                      <span style={{ fontSize: '13px', color: '#92400e' }}>Observaciones:</span>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        {viajeActivo.observaciones}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleFinalizarViaje}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading ? '#9ca3af' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                {loading ? 'Finalizando...' : '🏁 FINALIZAR VIAJE'}
              </button>
            </div>
          )}
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