// src/components/TrabajadorContainer.js
import React, { useState } from 'react';
import SistemaTrabajadoresFirebase from './SistemaTrabajadoresFirebase';
import DashboardTrabajador from './DashboardTrabajador';

const TrabajadorContainer = ({ currentUser, onLogout }) => {
  const [currentView, setCurrentView] = useState('gps'); // 'gps' o 'dashboard'

  const handleViewChange = (view) => {
    console.log('Cambiando vista a:', view);
    if (view === 'dashboard-trabajador') {
      setCurrentView('dashboard');
    } else {
      setCurrentView(view);
    }
  };

  if (currentView === 'dashboard') {
    return (
      <DashboardTrabajador
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigateToGPS={() => setCurrentView('gps')}
      />
    );
  }

  return (
    <SistemaTrabajadoresFirebase
      currentUser={currentUser}
      onLogout={onLogout}
      onViewChange={handleViewChange}
    />
  );
};

export default TrabajadorContainer;