// src/utils/userHelpers.js

// ========== VALIDACIÓN Y FORMATO DE RUT CHILENO ==========
export const validarRUT = (rut) => {
  // Limpiar RUT
  const rutLimpio = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  
  if (rutLimpio.length < 8 || rutLimpio.length > 9) {
    return false;
  }
  
  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);
  
  // Calcular dígito verificador
  let suma = 0;
  let multiplicador = 2;
  
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  
  const dvCalculado = 11 - (suma % 11);
  const dvFinal = dvCalculado === 11 ? '0' : dvCalculado === 10 ? 'K' : dvCalculado.toString();
  
  return dv === dvFinal;
};

export const formatearRUT = (value) => {
  // Eliminar caracteres no válidos
  let rut = value.replace(/[^0-9kK]/g, '').toUpperCase();
  
  // Limitar longitud
  if (rut.length > 9) {
    rut = rut.slice(0, 9);
  }
  
  // Si tiene más de 1 carácter, formatear
  if (rut.length > 1) {
    // Separar dígito verificador
    const dv = rut.slice(-1);
    let cuerpo = rut.slice(0, -1);
    
    // Agregar puntos cada 3 dígitos
    cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Unir cuerpo y dígito verificador con guión
    rut = `${cuerpo}-${dv}`;
  }
  
  return rut;
};

// ========== LICENCIAS DE CONDUCIR CHILENAS ==========
export const LICENCIAS_CONDUCIR = [
  { value: '', label: 'Sin licencia', descripcion: '' },
  { value: 'B', label: 'Clase B', descripcion: 'Vehículos particulares' },
  { value: 'C', label: 'Clase C', descripcion: 'Vehículos de dos ruedas' },
  { value: 'A1', label: 'Clase A1', descripcion: 'Taxis' },
  { value: 'A2', label: 'Clase A2', descripcion: 'Buses y taxibuses' },
  { value: 'A3', label: 'Clase A3', descripcion: 'Transporte de carga simple' },
  { value: 'A4', label: 'Clase A4', descripcion: 'Transporte con remolque' },
  { value: 'A5', label: 'Clase A5', descripcion: 'Todo tipo de vehículos motorizados' },
  { value: 'D', label: 'Clase D', descripcion: 'Maquinaria automotriz' },
  { value: 'E', label: 'Clase E', descripcion: 'Vehículos de tracción animal' },
  { value: 'F', label: 'Clase F', descripcion: 'Vehículos especiales para personas con discapacidad' }
];

export const obtenerTextoLicencia = (licencia) => {
  const licenciaObj = LICENCIAS_CONDUCIR.find(l => l.value === licencia);
  return licenciaObj ? `${licenciaObj.label} - ${licenciaObj.descripcion}` : 'Sin licencia';
};

export const obtenerIconoLicencia = (licencia) => {
  const iconos = {
    'B': '🚗',
    'C': '🏍️',
    'A1': '🚕',
    'A2': '🚌',
    'A3': '🚚',
    'A4': '🚛',
    'A5': '🚛',
    'D': '🚜',
    'E': '🐴',
    'F': '♿'
  };
  return iconos[licencia] || '';
};

// ========== VEHÍCULOS AUTORIZADOS POR LICENCIA ==========
export const getVehiculosAutorizados = (licencia) => {
  const vehiculos = {
    'B': ['Automóviles particulares', 'Camionetas hasta 3.500 kg', 'Furgones livianos'],
    'C': ['Motocicletas', 'Motonetas', 'Vehículos motorizados de 3 ruedas'],
    'A1': ['Taxis', 'Vehículos de alquiler con conductor', 'Incluye permisos clase B'],
    'A2': ['Buses urbanos', 'Minibuses', 'Taxibuses', 'Incluye permisos A1 y B'],
    'A3': ['Camiones simples', 'Vehículos de carga', 'Incluye permisos A1, A2 y B'],
    'A4': ['Camiones con remolque', 'Vehículos articulados', 'Incluye permisos A1, A2, A3 y B'],
    'A5': ['Todo tipo de vehículos motorizados', 'Licencia profesional completa'],
    'D': ['Maquinaria pesada', 'Retroexcavadoras', 'Grúas', 'Bulldozer', 'Motoniveladora'],
    'E': ['Carretones', 'Vehículos de tracción animal'],
    'F': ['Vehículos adaptados', 'Vehículos especiales para personas con movilidad reducida']
  };
  
  return vehiculos[licencia] || [];
};

// ========== VALIDACIÓN DE PIN ==========
export const validarPIN = (pin) => {
  // Debe ser exactamente 4 dígitos
  return /^\d{4}$/.test(pin);
};

export const formatearPIN = (value) => {
  // Solo permitir números y máximo 4 caracteres
  return value.replace(/\D/g, '').slice(0, 4);
};

// ========== CODIFICACIÓN/DECODIFICACIÓN DE PIN ==========
export const codificarPIN = (pin) => {
  // Codificación básica con btoa
  try {
    return btoa(pin);
  } catch (error) {
    console.error('Error al codificar PIN:', error);
    return null;
  }
};

export const decodificarPIN = (pinCodificado) => {
  // Decodificación básica con atob
  try {
    return atob(pinCodificado);
  } catch (error) {
    console.error('Error al decodificar PIN:', error);
    return null;
  }
};

// ========== VALIDACIONES DE FORMULARIO ==========
export const validarFormularioUsuario = (formData, esEdicion = false) => {
  const errores = [];
  
  // Validar nombre
  if (!formData.name || formData.name.trim().length < 3) {
    errores.push('El nombre debe tener al menos 3 caracteres');
  }
  
  // Validar email (solo en creación)
  if (!esEdicion && !formData.email) {
    errores.push('El email es requerido');
  }
  
  // Validar RUT
  if (!formData.rut) {
    errores.push('El RUT es requerido');
  } else if (!validarRUT(formData.rut)) {
    errores.push('El RUT es inválido');
  }
  
  // Validar PIN (solo en creación o si se proporciona en edición)
  if (!esEdicion && !formData.recoveryPin) {
    errores.push('El PIN de recuperación es requerido');
  } else if (formData.recoveryPin && !validarPIN(formData.recoveryPin)) {
    errores.push('El PIN debe tener exactamente 4 dígitos');
  }
  
  // Validar contraseña (solo en creación)
  if (!esEdicion && (!formData.password || formData.password.length < 6)) {
    errores.push('La contraseña debe tener al menos 6 caracteres');
  }
  
  // Validar teléfono (opcional pero si existe, validar formato)
  if (formData.phone && !/^(\+56)?[0-9]{8,9}$/.test(formData.phone.replace(/\s/g, ''))) {
    errores.push('El teléfono debe tener un formato válido');
  }
  
  // Validar localidad para junta de vecinos
  if (formData.role === 'junta_vecinos' && !formData.localidad) {
    errores.push('La localidad es requerida para Junta de Vecinos');
  }
  
  return errores;
};

// ========== PREPARAR DATOS PARA GUARDAR ==========
export const prepararDatosUsuario = (formData, esEdicion = false) => {
  const datos = {
    name: formData.name.trim(),
    role: formData.role,
    phone: formData.phone || null,
    vehicleId: formData.vehicleId || null,
    localidad: formData.localidad || null,
    rut: formData.rut || null,
    licenciaConducir: formData.licenciaConducir || null
  };
  
  // Solo incluir email en creación
  if (!esEdicion) {
    datos.email = formData.email.toLowerCase().trim();
  }
  
  // Solo incluir PIN si se proporciona
  if (formData.recoveryPin && validarPIN(formData.recoveryPin)) {
    datos.recoveryPin = codificarPIN(formData.recoveryPin);
  }
  
  return datos;
};

// ========== ESTADÍSTICAS DE USUARIOS ==========
export const calcularEstadisticasUsuarios = (usuarios) => {
  return {
    total: usuarios.length,
    porRol: {
      superadmin: usuarios.filter(u => u.role === 'superadmin').length,
      admin: usuarios.filter(u => u.role === 'admin').length,
      trabajador: usuarios.filter(u => u.role === 'trabajador').length,
      juntaVecinos: usuarios.filter(u => u.role === 'junta_vecinos').length
    },
    porEstado: {
      activos: usuarios.filter(u => u.active !== false).length,
      inactivos: usuarios.filter(u => u.active === false).length
    },
    porLicencia: {
      conLicencia: usuarios.filter(u => u.licenciaConducir).length,
      sinLicencia: usuarios.filter(u => !u.licenciaConducir).length,
      porTipo: LICENCIAS_CONDUCIR.reduce((acc, lic) => {
        if (lic.value) {
          acc[lic.value] = usuarios.filter(u => u.licenciaConducir === lic.value).length;
        }
        return acc;
      }, {})
    }
  };
};

// ========== EXPORTAR TODO ==========
export default {
  validarRUT,
  formatearRUT,
  LICENCIAS_CONDUCIR,
  obtenerTextoLicencia,
  obtenerIconoLicencia,
  getVehiculosAutorizados,
  validarPIN,
  formatearPIN,
  codificarPIN,
  decodificarPIN,
  validarFormularioUsuario,
  prepararDatosUsuario,
  calcularEstadisticasUsuarios
};