// src/components/WelcomeScreen.js - Versión Ultra Minimalista

import React, { useEffect } from 'react';

const WelcomeScreen = ({ currentUser, onClose, stats }) => {
  // Auto-cerrar después de 3 segundos (opcional)
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // 3 segundos
    
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div 
      onClick={onClose} // Click en cualquier parte para continuar
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        cursor: 'pointer',
        position: 'relative'
      }}
    >
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
        `}
      </style>
      
      {/* Logo central */}
      <div style={{ 
        animation: 'fadeIn 1s ease-in',
        textAlign: 'center'
      }}>
        <img 
          src="https://TU_URL_DEL_LOGO_AQUI.png" 
          alt="Municipalidad de Quillón" 
          style={{
            width: '400px',
            height: 'auto',
            objectFit: 'contain',
            animation: 'pulse 2s ease-in-out infinite'
          }}
          onError={(e) => {
            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2Y1ZjVmNSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjOTk5Ij5Mb2dvIE11bmljaXBhbGlkYWQ8L3RleHQ+Cjwvc3ZnPg==';
          }}
        />
        
        {/* Texto sutil debajo */}
        <p style={{
          marginTop: '30px',
          fontSize: '14px',
          color: '#9ca3af',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          Click para continuar
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;