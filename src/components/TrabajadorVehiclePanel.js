// src/components/TrabajadorVehiclePanel.js
import React, { useState, useEffect } from 'react';
import { vehiculosService, trabajadoresService } from '../services/firebaseservices';
import { database } from '../config/firebase';
import { ref as databaseRef, update, get } from 'firebase/database';

const TrabajadorVehiclePanel = ({ currentUser, onClose }) => {
  // ... resto del código
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
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [kilometrajeLlegada, setKilometrajeLlegada] = useState('');
  const [errorKmLlegada, setErrorKmLlegada] = useState('');

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
            // Buscar vehículo asignado - SOLO buscar en trabajadorAsignado
            let vehiculoEncontrado = null;

            // IMPORTANTE: Solo buscar en el campo correcto para evitar falsos positivos
            vehiculoEncontrado = vehiculosData.find(v => {
              // Solo aceptar si está específicamente asignado como trabajadorAsignado
              const asignado = v.trabajadorAsignado === currentUser.uid;

              if (asignado) {
                console.log('✅ Vehículo encontrado correctamente asignado:', v.nombre);
              }
              // Botón temporal para limpiar campos legacy
              <button
                onClick={async () => {
                  try {
                    const vehiculoRef = databaseRef(database, `vehiculos/${vehiculoAsignado.id}`);
                    await update(vehiculoRef, {
                      operadorAsignado: null,  // Limpiar campo antiguo
                      asignadoA: null,  // Limpiar por si acaso
                      ultimaActualizacion: new Date().toISOString()
                    });

                    alert('✅ Campos antiguos limpiados');
                    window.location.reload();
                  } catch (error) {
                    console.error('Error:', error);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Limpiar campos antiguos (ejecutar una vez)
              </button>

              // DEBUG: Mostrar si hay asignaciones incorrectas
              if (v.asignadoA === currentUser.uid || v.operadorAsignado === currentUser.uid) {
                console.log('⚠️ ADVERTENCIA: Vehículo mal asignado en campos incorrectos:', v.nombre);
                console.log('- asignadoA:', v.asignadoA);
                console.log('- operadorAsignado:', v.operadorAsignado);
                console.log('- trabajadorAsignado:', v.trabajadorAsignado);
                // NO retornar true aquí - ignorar estas asignaciones incorrectas
              }
              //dame el codigo separado con
              return asignado;
            });

            // NO buscar en otros campos para evitar falsos positivos
            console.log('Resultado de búsqueda:', vehiculoEncontrado ? 'Vehículo encontrado' : 'NO hay vehículo asignado');
            // NO BUSCAR EN NINGÚN OTRO CAMPO - Comentar o eliminar estas líneas:
            /*
            if (!vehiculoEncontrado && trabajadorData?.vehiculoAsignado) {
              // NO buscar aquí
            }
            
            if (!vehiculoEncontrado && currentUser.vehicleId) {
              // NO buscar aquí tampoco
            }
            */

            console.log('Resultado final:', vehiculoEncontrado ? `Vehículo asignado: ${vehiculoEncontrado.nombre}` : 'NO hay vehículo asignado');
            if (vehiculoEncontrado) {
              console.log('✅ VEHÍCULO ASIGNADO:', vehiculoEncontrado);
              setVehiculoAsignado(vehiculoEncontrado);
              setFormViaje(prev => ({
                ...prev,
                kilometrajeSalida: '' // Dejar vacío en lugar de prellenar
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
      setMessage({ type: 'error', text: '⚠️ Debes indicar el kilometraje actual del vehículo' });
      return;
    }
    // NUEVA VALIDACIÓN: Verificar que el kilometraje no sea menor al registrado
    const kilometrajeActual = vehiculoAsignado.kilometraje || 0;
    const kilometrajeSalida = parseInt(formViaje.kilometrajeSalida);
    if (kilometrajeSalida < kilometrajeActual) {
      setMessage({
        type: 'error',
        text: `⚠️ El kilometraje no puede ser menor al registrado (${kilometrajeActual.toLocaleString()} km)`
      });
      return;
    }
    // Si el kilometraje es mayor al actual, preguntar confirmación
    if (kilometrajeSalida > kilometrajeActual + 1000) {
      const confirmar = window.confirm(
        `El kilometraje ingresado (${kilometrajeSalida.toLocaleString()} km) es mucho mayor al último registro (${kilometrajeActual.toLocaleString()} km).\n\n¿Es correcto?`
      );
      if (!confirmar) return;
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
    setShowFinalizarModal(true);
    setKilometrajeLlegada('');
    setErrorKmLlegada('');
  };
  const confirmarFinalizarViaje = async () => {
    // Validaciones
    if (!kilometrajeLlegada) {
      setErrorKmLlegada('Debes ingresar el kilometraje final');
      return;
    }

    const kmLlegada = parseInt(kilometrajeLlegada);
    const kmSalida = viajeActivo.kilometrajeSalida;

    if (kmLlegada < kmSalida) {
      setErrorKmLlegada(`El kilometraje final no puede ser menor al inicial (${kmSalida.toLocaleString()} km)`);
      return;
    }

    if (kmLlegada === kmSalida) {
      setErrorKmLlegada('El vehículo debe haber recorrido alguna distancia');
      return;
    }

    if (kmLlegada > kmSalida + 5000) {
      const confirmar = window.confirm(
        `¿Seguro que recorriste ${(kmLlegada - kmSalida).toLocaleString()} km en este viaje?`
      );
      if (!confirmar) return;
    }

    setLoading(true);
    setShowFinalizarModal(false);

    try {
      const horaLlegada = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      const kmRecorridos = kmLlegada - kmSalida;

      // Actualizar vehículo - DESASIGNANDO AL TRABAJADOR
      await vehiculosService.updateVehiculoEstado(vehiculoAsignado.id, 'disponible', {
        // CAMBIOS IMPORTANTES: Desasignar completamente el vehículo
        trabajadorAsignado: null,     // Campo principal - desasignar
        asignadoA: null,              // Limpiar campo legacy
        operadorAsignado: null,       // Limpiar campo legacy
        asignadoNombre: null,         // Limpiar nombre del asignado

        // Actualizar kilometraje y registro del último viaje
        kilometraje: kmLlegada,
        ultimoViaje: {
          ...viajeActivo,
          fechaLlegada: new Date().toISOString().split('T')[0],
          horaLlegada: horaLlegada,
          kilometrajeLlegada: kmLlegada,
          kilometrosRecorridos: kmRecorridos,
          estado: 'finalizado'
        },

        // Limpiar el viaje activo del vehículo
        viajeActivo: null,
        destino: null,
        kilometrajeUltimoViaje: kmLlegada
      });

      // Limpiar viaje activo del trabajador Y DESASIGNAR VEHÍCULO
      await trabajadoresService.updateTrabajadorData(currentUser.uid, {
        // CAMBIOS IMPORTANTES: Desasignar vehículo del trabajador
        viajeActivo: null,
        vehiculoAsignado: null,       // Desasignar vehículo
        vehicleId: null,              // Limpiar campo legacy
        estadoActual: 'disponible',

        // Guardar información del último viaje
        ultimoViaje: {
          ...viajeActivo,
          fechaLlegada: new Date().toISOString().split('T')[0],
          horaLlegada: horaLlegada,
          kilometrajeLlegada: kmLlegada,
          kilometrosRecorridos: kmRecorridos,
          vehiculoUsado: vehiculoAsignado.nombre // Guardar referencia del vehículo usado
        }
      });

      // Limpiar estados locales
      setViajeActivo(null);
      setVehiculoAsignado(null); // IMPORTANTE: Limpiar vehículo asignado del estado local

      // Mensaje de éxito actualizado
      setMessage({
        type: 'success',
        text: `✅ Viaje finalizado. Recorriste ${kmRecorridos.toLocaleString()} km. El vehículo ${vehiculoAsignado.nombre} ha sido liberado.`
      });

      // Cerrar el panel automáticamente después de 3 segundos
      setTimeout(() => {
        onClose();
      }, 3000);

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
  if (!vehiculoAsignado) {
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

          {/* Botón temporal para limpiar datos mal guardados
          <button
            onClick={async () => {
              console.log('🧹 Limpiando asignaciones incorrectas...');
              try {
                // Limpiar TODOS los vehículos mal asignados
                const vehiculosRef = databaseRef(database, 'vehiculos');
                const snapshot = await get(vehiculosRef);
                const vehiculos = snapshot.val() || {};

                for (const [id, vehiculo] of Object.entries(vehiculos)) {
                  if (vehiculo.asignadoA === currentUser.uid ||
                    vehiculo.operadorAsignado === currentUser.uid) {
                    console.log(`Limpiando vehículo ${id}...`);
                    await update(databaseRef(database, `vehiculos/${id}`), {
                      asignadoA: null,
                      operadorAsignado: null
                    });
                  }
                }

                // Limpiar el trabajador
                await update(databaseRef(database, `trabajadores/${currentUser.uid}`), {
                  vehiculoAsignado: null,
                  vehicleId: null
                });

                alert('✅ Limpieza completada. Por favor recarga la página.');
                window.location.reload();

              } catch (error) {
                console.error('Error:', error);
                alert('Error: ' + error.message);
              }
            }}
            style={{
              padding: '10px 20px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            🧹 LIMPIAR TODAS LAS ASIGNACIONES (DEBUG)
          </button> */}
        </div>
      </div>
    );
  }

  // Solo mostrar el formulario si hay vehículo asignado
  if (!vehiculoAsignado) {
    return null; // Seguridad adicional
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
                    🚗 Kilometraje Actual del Vehículo
                  </label>
                  <div style={{
                    padding: '10px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: '#f9fafb',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1f2937'
                  }}>
                    {(vehiculoAsignado.kilometraje || 0).toLocaleString()} km
                  </div>
                </div>

                {/* Nuevo Kilometraje */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    📏 Kilometraje al Iniciar Viaje
                  </label>
                  <input
                    type="number"
                    value={formViaje.kilometrajeSalida}
                    onChange={(e) => {
                      const nuevoKm = e.target.value;
                      setFormViaje({ ...formViaje, kilometrajeSalida: nuevoKm });
                    }}
                    placeholder={`Mínimo: ${(vehiculoAsignado.kilometraje || 0).toLocaleString()} km`}
                    required
                    min={vehiculoAsignado.kilometraje || 0}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  {formViaje.kilometrajeSalida && parseInt(formViaje.kilometrajeSalida) < (vehiculoAsignado.kilometraje || 0) && (
                    <div style={{
                      marginTop: '5px',
                      padding: '8px',
                      backgroundColor: '#fee2e2',
                      borderRadius: '6px',
                      color: '#dc2626',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      ⚠️ El kilometraje no puede ser menor a {(vehiculoAsignado.kilometraje || 0).toLocaleString()} km
                    </div>
                  )}
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
                {/* Botón de acción */}
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !formViaje.kilometrajeSalida ||
                    !formViaje.destino ||
                    (parseInt(formViaje.kilometrajeSalida) < (vehiculoAsignado.kilometraje || 0))
                  }
                  style={{
                    padding: '14px',
                    background: loading || (parseInt(formViaje.kilometrajeSalida) < (vehiculoAsignado.kilometraje || 0))
                      ? '#9ca3af'
                      : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: loading || (parseInt(formViaje.kilometrajeSalida) < (vehiculoAsignado.kilometraje || 0))
                      ? 'not-allowed'
                      : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    transition: 'transform 0.2s',
                    opacity: loading || (parseInt(formViaje.kilometrajeSalida) < (vehiculoAsignado.kilometraje || 0))
                      ? 0.5
                      : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && !(parseInt(formViaje.kilometrajeSalida) < (vehiculoAsignado.kilometraje || 0))) {
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }
                  }}
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
      {/* Modal de Finalización de Viaje */}
      {showFinalizarModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '450px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            {/* Header del Modal */}
            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              borderRadius: '12px 12px 0 0',
              color: 'white'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                🏁 Finalizar Viaje
              </h3>
            </div>

            {/* Contenido del Modal */}
            <div style={{ padding: '20px' }}>
              {/* Info del viaje */}
              <div style={{
                background: '#f9fafb',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>Destino:</span>
                  <div style={{ fontWeight: '600', fontSize: '16px', color: '#1f2937' }}>
                    {viajeActivo.destino}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Hora de salida:</span>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>
                      {viajeActivo.horaSalida}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Km de salida:</span>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>
                      {viajeActivo.kilometrajeSalida.toLocaleString()} km
                    </div>
                  </div>
                </div>
              </div>

              {/* Campo de kilometraje final */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  📏 Kilometraje Final del Vehículo
                </label>
                <input
                  type="number"
                  value={kilometrajeLlegada}
                  onChange={(e) => {
                    setKilometrajeLlegada(e.target.value);
                    setErrorKmLlegada('');
                  }}
                  placeholder={`Mínimo: ${(viajeActivo.kilometrajeSalida + 1).toLocaleString()} km`}
                  min={viajeActivo.kilometrajeSalida + 1}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: errorKmLlegada ? '2px solid #ef4444' : '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '500',
                    backgroundColor: errorKmLlegada ? '#fee2e2' : 'white'
                  }}
                  autoFocus
                />

                {/* Mensaje de error */}
                {errorKmLlegada && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: '#fee2e2',
                    borderRadius: '6px',
                    color: '#dc2626',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    ⚠️ {errorKmLlegada}
                  </div>
                )}

                {/* Información de kilómetros a recorrer */}
                {kilometrajeLlegada && parseInt(kilometrajeLlegada) > viajeActivo.kilometrajeSalida && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px',
                    backgroundColor: '#dcfce7',
                    borderRadius: '6px',
                    color: '#15803d',
                    fontSize: '14px',
                    fontWeight: '500',
                    textAlign: 'center'
                  }}>
                    📍 Distancia recorrida: {(parseInt(kilometrajeLlegada) - viajeActivo.kilometrajeSalida).toLocaleString()} km
                  </div>
                )}
              </div>

              {/* Botones */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginTop: '20px'
              }}>
                <button
                  onClick={() => {
                    setShowFinalizarModal(false);
                    setKilometrajeLlegada('');
                    setErrorKmLlegada('');
                  }}
                  style={{
                    padding: '12px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarFinalizarViaje}
                  disabled={!kilometrajeLlegada || parseInt(kilometrajeLlegada) <= viajeActivo.kilometrajeSalida}
                  style={{
                    padding: '12px',
                    background: !kilometrajeLlegada || parseInt(kilometrajeLlegada) <= viajeActivo.kilometrajeSalida
                      ? '#9ca3af'
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: !kilometrajeLlegada || parseInt(kilometrajeLlegada) <= viajeActivo.kilometrajeSalida
                      ? 'not-allowed'
                      : 'pointer',
                    opacity: !kilometrajeLlegada || parseInt(kilometrajeLlegada) <= viajeActivo.kilometrajeSalida
                      ? 0.5
                      : 1
                  }}
                >
                  🏁 Finalizar Viaje
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrabajadorVehiclePanel;