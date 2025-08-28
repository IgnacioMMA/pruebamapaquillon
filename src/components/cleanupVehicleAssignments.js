// SCRIPT DE LIMPIEZA - EJECUTAR UNA SOLA VEZ
import { database } from '../config/firebase';
import { ref as databaseRef, get, update } from 'firebase/database';

export const ejecutarLimpiezaAsignaciones = async () => {
    console.log('🧹 Iniciando limpieza de asignaciones de vehículos...');

    try {
        // Obtener todos los vehículos
        const vehiculosRef = databaseRef(database, 'vehiculos');
        const snapshot = await get(vehiculosRef);
        const vehiculos = snapshot.val() || {};

        let vehiculosCorregidos = 0;

        for (const [vehiculoId, vehiculo] of Object.entries(vehiculos)) {
            // Verificar si tiene campos incorrectos con datos
            if (vehiculo.asignadoA || vehiculo.operadorAsignado) {
                console.log(`⚠️ Vehículo ${vehiculo.nombre} tiene campos incorrectos`);
                console.log(`  - asignadoA: ${vehiculo.asignadoA}`);
                console.log(`  - operadorAsignado: ${vehiculo.operadorAsignado}`);
                console.log(`  - trabajadorAsignado: ${vehiculo.trabajadorAsignado}`);

                // Determinar el ID correcto del trabajador
                const trabajadorId = vehiculo.trabajadorAsignado ||
                    vehiculo.asignadoA ||
                    vehiculo.operadorAsignado;

                // Actualizar con el campo correcto
                await update(databaseRef(database, `vehiculos/${vehiculoId}`), {
                    trabajadorAsignado: trabajadorId || null,
                    asignadoA: null,
                    operadorAsignado: null,
                    ultimaActualizacion: new Date().toISOString()
                });

                console.log(`✅ Vehículo ${vehiculo.nombre} corregido`);
                vehiculosCorregidos++;
            }
        }

        console.log(`🎉 Limpieza completada. ${vehiculosCorregidos} vehículos corregidos`);
        return vehiculosCorregidos;

    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
        throw error;
    }
};