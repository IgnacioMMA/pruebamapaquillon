// src/services/chileCitiesService.js

// Base de datos completa de comunas de Chile
const COMUNAS_CHILE = [
  // Región de Arica y Parinacota
  { codigo: '15101', nombre: 'Arica', region: 'Arica y Parinacota' },
  { codigo: '15102', nombre: 'Camarones', region: 'Arica y Parinacota' },
  { codigo: '15201', nombre: 'Putre', region: 'Arica y Parinacota' },
  { codigo: '15202', nombre: 'General Lagos', region: 'Arica y Parinacota' },
  
  // Región de Tarapacá
  { codigo: '01101', nombre: 'Iquique', region: 'Tarapacá' },
  { codigo: '01102', nombre: 'Alto Hospicio', region: 'Tarapacá' },
  { codigo: '01401', nombre: 'Pozo Almonte', region: 'Tarapacá' },
  { codigo: '01402', nombre: 'Camiña', region: 'Tarapacá' },
  { codigo: '01403', nombre: 'Colchane', region: 'Tarapacá' },
  { codigo: '01404', nombre: 'Huara', region: 'Tarapacá' },
  { codigo: '01405', nombre: 'Pica', region: 'Tarapacá' },
  
  // Región de Antofagasta
  { codigo: '02101', nombre: 'Antofagasta', region: 'Antofagasta' },
  { codigo: '02102', nombre: 'Mejillones', region: 'Antofagasta' },
  { codigo: '02103', nombre: 'Sierra Gorda', region: 'Antofagasta' },
  { codigo: '02104', nombre: 'Taltal', region: 'Antofagasta' },
  { codigo: '02201', nombre: 'Calama', region: 'Antofagasta' },
  { codigo: '02202', nombre: 'Ollagüe', region: 'Antofagasta' },
  { codigo: '02203', nombre: 'San Pedro de Atacama', region: 'Antofagasta' },
  { codigo: '02301', nombre: 'Tocopilla', region: 'Antofagasta' },
  { codigo: '02302', nombre: 'María Elena', region: 'Antofagasta' },
  
  // Región de Atacama
  { codigo: '03101', nombre: 'Copiapó', region: 'Atacama' },
  { codigo: '03102', nombre: 'Caldera', region: 'Atacama' },
  { codigo: '03103', nombre: 'Tierra Amarilla', region: 'Atacama' },
  { codigo: '03201', nombre: 'Chañaral', region: 'Atacama' },
  { codigo: '03202', nombre: 'Diego de Almagro', region: 'Atacama' },
  { codigo: '03301', nombre: 'Vallenar', region: 'Atacama' },
  { codigo: '03302', nombre: 'Alto del Carmen', region: 'Atacama' },
  { codigo: '03303', nombre: 'Freirina', region: 'Atacama' },
  { codigo: '03304', nombre: 'Huasco', region: 'Atacama' },
  
  // Región de Coquimbo
  { codigo: '04101', nombre: 'La Serena', region: 'Coquimbo' },
  { codigo: '04102', nombre: 'Coquimbo', region: 'Coquimbo' },
  { codigo: '04103', nombre: 'Andacollo', region: 'Coquimbo' },
  { codigo: '04104', nombre: 'La Higuera', region: 'Coquimbo' },
  { codigo: '04105', nombre: 'Paihuano', region: 'Coquimbo' },
  { codigo: '04106', nombre: 'Vicuña', region: 'Coquimbo' },
  { codigo: '04201', nombre: 'Illapel', region: 'Coquimbo' },
  { codigo: '04202', nombre: 'Canela', region: 'Coquimbo' },
  { codigo: '04203', nombre: 'Los Vilos', region: 'Coquimbo' },
  { codigo: '04204', nombre: 'Salamanca', region: 'Coquimbo' },
  { codigo: '04301', nombre: 'Ovalle', region: 'Coquimbo' },
  { codigo: '04302', nombre: 'Combarbalá', region: 'Coquimbo' },
  { codigo: '04303', nombre: 'Monte Patria', region: 'Coquimbo' },
  { codigo: '04304', nombre: 'Punitaqui', region: 'Coquimbo' },
  { codigo: '04305', nombre: 'Río Hurtado', region: 'Coquimbo' },
  
  // Región de Valparaíso
  { codigo: '05101', nombre: 'Valparaíso', region: 'Valparaíso' },
  { codigo: '05102', nombre: 'Casablanca', region: 'Valparaíso' },
  { codigo: '05103', nombre: 'Concón', region: 'Valparaíso' },
  { codigo: '05104', nombre: 'Juan Fernández', region: 'Valparaíso' },
  { codigo: '05105', nombre: 'Puchuncaví', region: 'Valparaíso' },
  { codigo: '05107', nombre: 'Quintero', region: 'Valparaíso' },
  { codigo: '05109', nombre: 'Viña del Mar', region: 'Valparaíso' },
  { codigo: '05201', nombre: 'Isla de Pascua', region: 'Valparaíso' },
  { codigo: '05301', nombre: 'Los Andes', region: 'Valparaíso' },
  { codigo: '05302', nombre: 'Calle Larga', region: 'Valparaíso' },
  { codigo: '05303', nombre: 'Rinconada', region: 'Valparaíso' },
  { codigo: '05304', nombre: 'San Esteban', region: 'Valparaíso' },
  { codigo: '05401', nombre: 'La Ligua', region: 'Valparaíso' },
  { codigo: '05402', nombre: 'Cabildo', region: 'Valparaíso' },
  { codigo: '05403', nombre: 'Papudo', region: 'Valparaíso' },
  { codigo: '05404', nombre: 'Petorca', region: 'Valparaíso' },
  { codigo: '05405', nombre: 'Zapallar', region: 'Valparaíso' },
  { codigo: '05501', nombre: 'Quillota', region: 'Valparaíso' },
  { codigo: '05502', nombre: 'La Calera', region: 'Valparaíso' },
  { codigo: '05503', nombre: 'Hijuelas', region: 'Valparaíso' },
  { codigo: '05504', nombre: 'La Cruz', region: 'Valparaíso' },
  { codigo: '05506', nombre: 'Nogales', region: 'Valparaíso' },
  { codigo: '05601', nombre: 'San Antonio', region: 'Valparaíso' },
  { codigo: '05602', nombre: 'Algarrobo', region: 'Valparaíso' },
  { codigo: '05603', nombre: 'Cartagena', region: 'Valparaíso' },
  { codigo: '05604', nombre: 'El Quisco', region: 'Valparaíso' },
  { codigo: '05605', nombre: 'El Tabo', region: 'Valparaíso' },
  { codigo: '05606', nombre: 'Santo Domingo', region: 'Valparaíso' },
  { codigo: '05701', nombre: 'San Felipe', region: 'Valparaíso' },
  { codigo: '05702', nombre: 'Catemu', region: 'Valparaíso' },
  { codigo: '05703', nombre: 'Llay Llay', region: 'Valparaíso' },
  { codigo: '05704', nombre: 'Panquehue', region: 'Valparaíso' },
  { codigo: '05705', nombre: 'Putaendo', region: 'Valparaíso' },
  { codigo: '05706', nombre: 'Santa María', region: 'Valparaíso' },
  { codigo: '05801', nombre: 'Quilpué', region: 'Valparaíso' },
  { codigo: '05802', nombre: 'Limache', region: 'Valparaíso' },
  { codigo: '05803', nombre: 'Olmué', region: 'Valparaíso' },
  { codigo: '05804', nombre: 'Villa Alemana', region: 'Valparaíso' },
  
  // Región Metropolitana
  { codigo: '13101', nombre: 'Santiago', region: 'Metropolitana' },
  { codigo: '13102', nombre: 'Cerrillos', region: 'Metropolitana' },
  { codigo: '13103', nombre: 'Cerro Navia', region: 'Metropolitana' },
  { codigo: '13104', nombre: 'Conchalí', region: 'Metropolitana' },
  { codigo: '13105', nombre: 'El Bosque', region: 'Metropolitana' },
  { codigo: '13106', nombre: 'Estación Central', region: 'Metropolitana' },
  { codigo: '13107', nombre: 'Huechuraba', region: 'Metropolitana' },
  { codigo: '13108', nombre: 'Independencia', region: 'Metropolitana' },
  { codigo: '13109', nombre: 'La Cisterna', region: 'Metropolitana' },
  { codigo: '13110', nombre: 'La Florida', region: 'Metropolitana' },
  { codigo: '13111', nombre: 'La Granja', region: 'Metropolitana' },
  { codigo: '13112', nombre: 'La Pintana', region: 'Metropolitana' },
  { codigo: '13113', nombre: 'La Reina', region: 'Metropolitana' },
  { codigo: '13114', nombre: 'Las Condes', region: 'Metropolitana' },
  { codigo: '13115', nombre: 'Lo Barnechea', region: 'Metropolitana' },
  { codigo: '13116', nombre: 'Lo Espejo', region: 'Metropolitana' },
  { codigo: '13117', nombre: 'Lo Prado', region: 'Metropolitana' },
  { codigo: '13118', nombre: 'Macul', region: 'Metropolitana' },
  { codigo: '13119', nombre: 'Maipú', region: 'Metropolitana' },
  { codigo: '13120', nombre: 'Ñuñoa', region: 'Metropolitana' },
  { codigo: '13121', nombre: 'Pedro Aguirre Cerda', region: 'Metropolitana' },
  { codigo: '13122', nombre: 'Peñalolén', region: 'Metropolitana' },
  { codigo: '13123', nombre: 'Providencia', region: 'Metropolitana' },
  { codigo: '13124', nombre: 'Pudahuel', region: 'Metropolitana' },
  { codigo: '13125', nombre: 'Quilicura', region: 'Metropolitana' },
  { codigo: '13126', nombre: 'Quinta Normal', region: 'Metropolitana' },
  { codigo: '13127', nombre: 'Recoleta', region: 'Metropolitana' },
  { codigo: '13128', nombre: 'Renca', region: 'Metropolitana' },
  { codigo: '13129', nombre: 'San Joaquín', region: 'Metropolitana' },
  { codigo: '13130', nombre: 'San Miguel', region: 'Metropolitana' },
  { codigo: '13131', nombre: 'San Ramón', region: 'Metropolitana' },
  { codigo: '13132', nombre: 'Vitacura', region: 'Metropolitana' },
  { codigo: '13201', nombre: 'Puente Alto', region: 'Metropolitana' },
  { codigo: '13202', nombre: 'Pirque', region: 'Metropolitana' },
  { codigo: '13203', nombre: 'San José de Maipo', region: 'Metropolitana' },
  { codigo: '13301', nombre: 'Colina', region: 'Metropolitana' },
  { codigo: '13302', nombre: 'Lampa', region: 'Metropolitana' },
  { codigo: '13303', nombre: 'Tiltil', region: 'Metropolitana' },
  { codigo: '13401', nombre: 'San Bernardo', region: 'Metropolitana' },
  { codigo: '13402', nombre: 'Buin', region: 'Metropolitana' },
  { codigo: '13403', nombre: 'Calera de Tango', region: 'Metropolitana' },
  { codigo: '13404', nombre: 'Paine', region: 'Metropolitana' },
  { codigo: '13501', nombre: 'Melipilla', region: 'Metropolitana' },
  { codigo: '13502', nombre: 'Alhué', region: 'Metropolitana' },
  { codigo: '13503', nombre: 'Curacaví', region: 'Metropolitana' },
  { codigo: '13504', nombre: 'María Pinto', region: 'Metropolitana' },
  { codigo: '13505', nombre: 'San Pedro', region: 'Metropolitana' },
  { codigo: '13601', nombre: 'Talagante', region: 'Metropolitana' },
  { codigo: '13602', nombre: 'El Monte', region: 'Metropolitana' },
  { codigo: '13603', nombre: 'Isla de Maipo', region: 'Metropolitana' },
  { codigo: '13604', nombre: 'Padre Hurtado', region: 'Metropolitana' },
  { codigo: '13605', nombre: 'Peñaflor', region: 'Metropolitana' },
  
  // Región de O'Higgins
  { codigo: '06101', nombre: 'Rancagua', region: "O'Higgins" },
  { codigo: '06102', nombre: 'Codegua', region: "O'Higgins" },
  { codigo: '06103', nombre: 'Coinco', region: "O'Higgins" },
  { codigo: '06104', nombre: 'Coltauco', region: "O'Higgins" },
  { codigo: '06105', nombre: 'Doñihue', region: "O'Higgins" },
  { codigo: '06106', nombre: 'Graneros', region: "O'Higgins" },
  { codigo: '06107', nombre: 'Las Cabras', region: "O'Higgins" },
  { codigo: '06108', nombre: 'Machalí', region: "O'Higgins" },
  { codigo: '06109', nombre: 'Malloa', region: "O'Higgins" },
  { codigo: '06110', nombre: 'Mostazal', region: "O'Higgins" },
  { codigo: '06111', nombre: 'Olivar', region: "O'Higgins" },
  { codigo: '06112', nombre: 'Peumo', region: "O'Higgins" },
  { codigo: '06113', nombre: 'Pichidegua', region: "O'Higgins" },
  { codigo: '06114', nombre: 'Quinta de Tilcoco', region: "O'Higgins" },
  { codigo: '06115', nombre: 'Rengo', region: "O'Higgins" },
  { codigo: '06116', nombre: 'Requínoa', region: "O'Higgins" },
  { codigo: '06117', nombre: 'San Vicente', region: "O'Higgins" },
  { codigo: '06201', nombre: 'Pichilemu', region: "O'Higgins" },
  { codigo: '06202', nombre: 'La Estrella', region: "O'Higgins" },
  { codigo: '06203', nombre: 'Litueche', region: "O'Higgins" },
  { codigo: '06204', nombre: 'Marchihue', region: "O'Higgins" },
  { codigo: '06205', nombre: 'Navidad', region: "O'Higgins" },
  { codigo: '06206', nombre: 'Paredones', region: "O'Higgins" },
  { codigo: '06301', nombre: 'San Fernando', region: "O'Higgins" },
  { codigo: '06302', nombre: 'Chépica', region: "O'Higgins" },
  { codigo: '06303', nombre: 'Chimbarongo', region: "O'Higgins" },
  { codigo: '06304', nombre: 'Lolol', region: "O'Higgins" },
  { codigo: '06305', nombre: 'Nancagua', region: "O'Higgins" },
  { codigo: '06306', nombre: 'Palmilla', region: "O'Higgins" },
  { codigo: '06307', nombre: 'Peralillo', region: "O'Higgins" },
  { codigo: '06308', nombre: 'Placilla', region: "O'Higgins" },
  { codigo: '06309', nombre: 'Pumanque', region: "O'Higgins" },
  { codigo: '06310', nombre: 'Santa Cruz', region: "O'Higgins" },
  
  // Región del Maule
  { codigo: '07101', nombre: 'Talca', region: 'Maule' },
  { codigo: '07102', nombre: 'Constitución', region: 'Maule' },
  { codigo: '07103', nombre: 'Curepto', region: 'Maule' },
  { codigo: '07104', nombre: 'Empedrado', region: 'Maule' },
  { codigo: '07105', nombre: 'Maule', region: 'Maule' },
  { codigo: '07106', nombre: 'Pelarco', region: 'Maule' },
  { codigo: '07107', nombre: 'Pencahue', region: 'Maule' },
  { codigo: '07108', nombre: 'Río Claro', region: 'Maule' },
  { codigo: '07109', nombre: 'San Clemente', region: 'Maule' },
  { codigo: '07110', nombre: 'San Rafael', region: 'Maule' },
  { codigo: '07201', nombre: 'Cauquenes', region: 'Maule' },
  { codigo: '07202', nombre: 'Chanco', region: 'Maule' },
  { codigo: '07203', nombre: 'Pelluhue', region: 'Maule' },
  { codigo: '07301', nombre: 'Curicó', region: 'Maule' },
  { codigo: '07302', nombre: 'Hualañé', region: 'Maule' },
  { codigo: '07303', nombre: 'Licantén', region: 'Maule' },
  { codigo: '07304', nombre: 'Molina', region: 'Maule' },
  { codigo: '07305', nombre: 'Rauco', region: 'Maule' },
  { codigo: '07306', nombre: 'Romeral', region: 'Maule' },
  { codigo: '07307', nombre: 'Sagrada Familia', region: 'Maule' },
  { codigo: '07308', nombre: 'Teno', region: 'Maule' },
  { codigo: '07309', nombre: 'Vichuquén', region: 'Maule' },
  { codigo: '07401', nombre: 'Linares', region: 'Maule' },
  { codigo: '07402', nombre: 'Colbún', region: 'Maule' },
  { codigo: '07403', nombre: 'Longaví', region: 'Maule' },
  { codigo: '07404', nombre: 'Parral', region: 'Maule' },
  { codigo: '07405', nombre: 'Retiro', region: 'Maule' },
  { codigo: '07406', nombre: 'San Javier', region: 'Maule' },
  { codigo: '07407', nombre: 'Villa Alegre', region: 'Maule' },
  { codigo: '07408', nombre: 'Yerbas Buenas', region: 'Maule' },
  
  // Región de Ñuble (IMPORTANTE PARA QUILLÓN)
  { codigo: '16101', nombre: 'Chillán', region: 'Ñuble' },
  { codigo: '16102', nombre: 'Chillán Viejo', region: 'Ñuble' },
  { codigo: '16103', nombre: 'Quirihue', region: 'Ñuble' },
  { codigo: '16104', nombre: 'Cobquecura', region: 'Ñuble' },
  { codigo: '16105', nombre: 'Coelemu', region: 'Ñuble' },
  { codigo: '16106', nombre: 'Ninhue', region: 'Ñuble' },
  { codigo: '16107', nombre: 'Portezuelo', region: 'Ñuble' },
  { codigo: '16108', nombre: 'Ránquil', region: 'Ñuble' },
  { codigo: '16109', nombre: 'Treguaco', region: 'Ñuble' },
  { codigo: '16201', nombre: 'San Carlos', region: 'Ñuble' },
  { codigo: '16202', nombre: 'Coihueco', region: 'Ñuble' },
  { codigo: '16203', nombre: 'Ñiquén', region: 'Ñuble' },
  { codigo: '16204', nombre: 'San Fabián', region: 'Ñuble' },
  { codigo: '16205', nombre: 'San Nicolás', region: 'Ñuble' },
  { codigo: '16301', nombre: 'Bulnes', region: 'Ñuble' },
  { codigo: '16302', nombre: 'Quillón', region: 'Ñuble' }, // ⭐ QUILLÓN
  { codigo: '16303', nombre: 'San Ignacio', region: 'Ñuble' },
  { codigo: '16304', nombre: 'El Carmen', region: 'Ñuble' },
  { codigo: '16305', nombre: 'Pemuco', region: 'Ñuble' },
  { codigo: '16306', nombre: 'Pinto', region: 'Ñuble' },
  { codigo: '16307', nombre: 'Yungay', region: 'Ñuble' },
  
  // Región del Biobío
  { codigo: '08101', nombre: 'Concepción', region: 'Biobío' },
  { codigo: '08102', nombre: 'Coronel', region: 'Biobío' },
  { codigo: '08103', nombre: 'Chiguayante', region: 'Biobío' },
  { codigo: '08104', nombre: 'Florida', region: 'Biobío' },
  { codigo: '08105', nombre: 'Hualqui', region: 'Biobío' },
  { codigo: '08106', nombre: 'Lota', region: 'Biobío' },
  { codigo: '08107', nombre: 'Penco', region: 'Biobío' },
  { codigo: '08108', nombre: 'San Pedro de la Paz', region: 'Biobío' },
  { codigo: '08109', nombre: 'Santa Juana', region: 'Biobío' },
  { codigo: '08110', nombre: 'Talcahuano', region: 'Biobío' },
  { codigo: '08111', nombre: 'Tomé', region: 'Biobío' },
  { codigo: '08112', nombre: 'Hualpén', region: 'Biobío' },
  { codigo: '08201', nombre: 'Lebu', region: 'Biobío' },
  { codigo: '08202', nombre: 'Arauco', region: 'Biobío' },
  { codigo: '08203', nombre: 'Cañete', region: 'Biobío' },
  { codigo: '08204', nombre: 'Contulmo', region: 'Biobío' },
  { codigo: '08205', nombre: 'Curanilahue', region: 'Biobío' },
  { codigo: '08206', nombre: 'Los Álamos', region: 'Biobío' },
  { codigo: '08207', nombre: 'Tirúa', region: 'Biobío' },
  { codigo: '08301', nombre: 'Los Ángeles', region: 'Biobío' },
  { codigo: '08302', nombre: 'Antuco', region: 'Biobío' },
  { codigo: '08303', nombre: 'Cabrero', region: 'Biobío' },
  { codigo: '08304', nombre: 'Laja', region: 'Biobío' },
  { codigo: '08305', nombre: 'Mulchén', region: 'Biobío' },
  { codigo: '08306', nombre: 'Nacimiento', region: 'Biobío' },
  { codigo: '08307', nombre: 'Negrete', region: 'Biobío' },
  { codigo: '08308', nombre: 'Quilaco', region: 'Biobío' },
  { codigo: '08309', nombre: 'Quilleco', region: 'Biobío' },
  { codigo: '08310', nombre: 'San Rosendo', region: 'Biobío' },
  { codigo: '08311', nombre: 'Santa Bárbara', region: 'Biobío' },
  { codigo: '08312', nombre: 'Tucapel', region: 'Biobío' },
  { codigo: '08313', nombre: 'Yumbel', region: 'Biobío' },
  { codigo: '08314', nombre: 'Alto Biobío', region: 'Biobío' },
  
  // Región de La Araucanía
  { codigo: '09101', nombre: 'Temuco', region: 'Araucanía' },
  { codigo: '09102', nombre: 'Carahue', region: 'Araucanía' },
  { codigo: '09103', nombre: 'Cunco', region: 'Araucanía' },
  { codigo: '09104', nombre: 'Curarrehue', region: 'Araucanía' },
  { codigo: '09105', nombre: 'Freire', region: 'Araucanía' },
  { codigo: '09106', nombre: 'Galvarino', region: 'Araucanía' },
  { codigo: '09107', nombre: 'Gorbea', region: 'Araucanía' },
  { codigo: '09108', nombre: 'Lautaro', region: 'Araucanía' },
  { codigo: '09109', nombre: 'Loncoche', region: 'Araucanía' },
  { codigo: '09110', nombre: 'Melipeuco', region: 'Araucanía' },
  { codigo: '09111', nombre: 'Nueva Imperial', region: 'Araucanía' },
  { codigo: '09112', nombre: 'Padre Las Casas', region: 'Araucanía' },
  { codigo: '09113', nombre: 'Perquenco', region: 'Araucanía' },
  { codigo: '09114', nombre: 'Pitrufquén', region: 'Araucanía' },
  { codigo: '09115', nombre: 'Pucón', region: 'Araucanía' },
  { codigo: '09116', nombre: 'Saavedra', region: 'Araucanía' },
  { codigo: '09117', nombre: 'Teodoro Schmidt', region: 'Araucanía' },
  { codigo: '09118', nombre: 'Toltén', region: 'Araucanía' },
  { codigo: '09119', nombre: 'Vilcún', region: 'Araucanía' },
  { codigo: '09120', nombre: 'Villarrica', region: 'Araucanía' },
  { codigo: '09121', nombre: 'Cholchol', region: 'Araucanía' },
  { codigo: '09201', nombre: 'Angol', region: 'Araucanía' },
  { codigo: '09202', nombre: 'Collipulli', region: 'Araucanía' },
  { codigo: '09203', nombre: 'Curacautín', region: 'Araucanía' },
  { codigo: '09204', nombre: 'Ercilla', region: 'Araucanía' },
  { codigo: '09205', nombre: 'Lonquimay', region: 'Araucanía' },
  { codigo: '09206', nombre: 'Los Sauces', region: 'Araucanía' },
  { codigo: '09207', nombre: 'Lumaco', region: 'Araucanía' },
  { codigo: '09208', nombre: 'Purén', region: 'Araucanía' },
  { codigo: '09209', nombre: 'Renaico', region: 'Araucanía' },
  { codigo: '09210', nombre: 'Traiguén', region: 'Araucanía' },
  { codigo: '09211', nombre: 'Victoria', region: 'Araucanía' },
  
  // Región de Los Ríos
  { codigo: '14101', nombre: 'Valdivia', region: 'Los Ríos' },
  { codigo: '14102', nombre: 'Corral', region: 'Los Ríos' },
  { codigo: '14103', nombre: 'Lanco', region: 'Los Ríos' },
  { codigo: '14104', nombre: 'Los Lagos', region: 'Los Ríos' },
  { codigo: '14105', nombre: 'Máfil', region: 'Los Ríos' },
  { codigo: '14106', nombre: 'Mariquina', region: 'Los Ríos' },
  { codigo: '14107', nombre: 'Paillaco', region: 'Los Ríos' },
  { codigo: '14108', nombre: 'Panguipulli', region: 'Los Ríos' },
  { codigo: '14201', nombre: 'La Unión', region: 'Los Ríos' },
  { codigo: '14202', nombre: 'Futrono', region: 'Los Ríos' },
  { codigo: '14203', nombre: 'Lago Ranco', region: 'Los Ríos' },
  { codigo: '14204', nombre: 'Río Bueno', region: 'Los Ríos' },
  
  // Región de Los Lagos
  { codigo: '10101', nombre: 'Puerto Montt', region: 'Los Lagos' },
  { codigo: '10102', nombre: 'Calbuco', region: 'Los Lagos' },
  { codigo: '10103', nombre: 'Cochamó', region: 'Los Lagos' },
  { codigo: '10104', nombre: 'Fresia', region: 'Los Lagos' },
  { codigo: '10105', nombre: 'Frutillar', region: 'Los Lagos' },
  { codigo: '10106', nombre: 'Los Muermos', region: 'Los Lagos' },
  { codigo: '10107', nombre: 'Llanquihue', region: 'Los Lagos' },
  { codigo: '10108', nombre: 'Maullín', region: 'Los Lagos' },
  { codigo: '10109', nombre: 'Puerto Varas', region: 'Los Lagos' },
  { codigo: '10201', nombre: 'Castro', region: 'Los Lagos' },
  { codigo: '10202', nombre: 'Ancud', region: 'Los Lagos' },
  { codigo: '10203', nombre: 'Chonchi', region: 'Los Lagos' },
  { codigo: '10204', nombre: 'Curaco de Vélez', region: 'Los Lagos' },
  { codigo: '10205', nombre: 'Dalcahue', region: 'Los Lagos' },
  { codigo: '10206', nombre: 'Puqueldón', region: 'Los Lagos' },
  { codigo: '10207', nombre: 'Queilén', region: 'Los Lagos' },
  { codigo: '10208', nombre: 'Quellón', region: 'Los Lagos' },
  { codigo: '10209', nombre: 'Quemchi', region: 'Los Lagos' },
  { codigo: '10210', nombre: 'Quinchao', region: 'Los Lagos' },
  { codigo: '10301', nombre: 'Osorno', region: 'Los Lagos' },
  { codigo: '10302', nombre: 'Puerto Octay', region: 'Los Lagos' },
  { codigo: '10303', nombre: 'Purranque', region: 'Los Lagos' },
  { codigo: '10304', nombre: 'Puyehue', region: 'Los Lagos' },
  { codigo: '10305', nombre: 'Río Negro', region: 'Los Lagos' },
  { codigo: '10306', nombre: 'San Juan de la Costa', region: 'Los Lagos' },
  { codigo: '10307', nombre: 'San Pablo', region: 'Los Lagos' },
  { codigo: '10401', nombre: 'Chaitén', region: 'Los Lagos' },
  { codigo: '10402', nombre: 'Futaleufú', region: 'Los Lagos' },
  { codigo: '10403', nombre: 'Hualaihué', region: 'Los Lagos' },
  { codigo: '10404', nombre: 'Palena', region: 'Los Lagos' },
  
  // Región de Aysén
  { codigo: '11101', nombre: 'Coyhaique', region: 'Aysén' },
  { codigo: '11102', nombre: 'Lago Verde', region: 'Aysén' },
  { codigo: '11201', nombre: 'Aysén', region: 'Aysén' },
  { codigo: '11202', nombre: 'Cisnes', region: 'Aysén' },
  { codigo: '11203', nombre: 'Guaitecas', region: 'Aysén' },
  { codigo: '11301', nombre: 'Cochrane', region: 'Aysén' },
  { codigo: '11302', nombre: "O'Higgins", region: 'Aysén' },
  { codigo: '11303', nombre: 'Tortel', region: 'Aysén' },
  { codigo: '11401', nombre: 'Chile Chico', region: 'Aysén' },
  { codigo: '11402', nombre: 'Río Ibáñez', region: 'Aysén' },
  
  // Región de Magallanes
  { codigo: '12101', nombre: 'Punta Arenas', region: 'Magallanes' },
  { codigo: '12102', nombre: 'Laguna Blanca', region: 'Magallanes' },
  { codigo: '12103', nombre: 'Río Verde', region: 'Magallanes' },
  { codigo: '12104', nombre: 'San Gregorio', region: 'Magallanes' },
  { codigo: '12201', nombre: 'Cabo de Hornos', region: 'Magallanes' },
  { codigo: '12202', nombre: 'Antártica', region: 'Magallanes' },
  { codigo: '12301', nombre: 'Porvenir', region: 'Magallanes' },
  { codigo: '12302', nombre: 'Primavera', region: 'Magallanes' },
  { codigo: '12303', nombre: 'Timaukel', region: 'Magallanes' },
  { codigo: '12401', nombre: 'Natales', region: 'Magallanes' },
  { codigo: '12402', nombre: 'Torres del Paine', region: 'Magallanes' }
];

// Servicio para obtener ciudades de Chile
export const chileCitiesService = {
  
  // Obtener todas las comunas
  getAllComunas: () => {
    return Promise.resolve(COMUNAS_CHILE);
  },
  
  // Buscar comunas por término
  searchCities: async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }
    
    const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const results = COMUNAS_CHILE.filter(comuna => {
      const nombreNormalizado = comuna.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return nombreNormalizado.includes(term);
    }).slice(0, 10);
    
    return Promise.resolve(results);
  },
  
  // Obtener comunas por región
  getComunasByRegion: (regionName) => {
    const comunas = COMUNAS_CHILE.filter(comuna => 
      comuna.region === regionName
    );
    return Promise.resolve(comunas);
  },
  
  // Obtener regiones únicas
  getRegiones: () => {
    const regiones = [...new Set(COMUNAS_CHILE.map(c => c.region))].sort();
    return Promise.resolve(regiones);
  },
  
  // Obtener comuna por código
  getComunaByCodigo: (codigo) => {
    const comuna = COMUNAS_CHILE.find(c => c.codigo === codigo);
    return Promise.resolve(comuna);
  },
  
  // Obtener comunas cercanas a Quillón (para sugerencias rápidas)
  getComunasCercanas: () => {
    const cercanas = [
      'Quillón',
      'Bulnes',
      'Chillán',
      'Chillán Viejo',
      'San Carlos',
      'Cabrero',
      'Yumbel',
      'Florida',
      'Pemuco',
      'San Ignacio',
      'El Carmen',
      'Pinto',
      'Coihueco',
      'San Nicolás',
      'Ñiquén'
    ];
    
    const comunasCercanas = COMUNAS_CHILE.filter(c => 
      cercanas.includes(c.nombre)
    );
    
    return Promise.resolve(comunasCercanas);
  }
};

export default chileCitiesService;