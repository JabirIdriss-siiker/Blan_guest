import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/Auth/LoginForm';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import MissionsList from './components/Missions/MissionsList';
import ApartmentsList from './components/Apartments/ApartmentsList';
import UsersList from './components/Users/UsersList';
import CRMDashboard from './components/CRM/CRMDashboard';
import LaundryDashboard from './components/Laundry/LaundryDashboard';
import InvoiceDashboard from './components/Invoices/InvoiceDashboard';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'missions':
        return <MissionsList />;
      case 'apartments':
        return <ApartmentsList />;
      case 'users':
        return <UsersList />;
      case 'crm':
        return <CRMDashboard />;
      case 'laundry':
        return <LaundryDashboard />;
      case 'invoices':
        return <InvoiceDashboard />;
      case 'activity':
        return <div className="p-6">Section Activité (à implémenter)</div>;
      case 'settings':
        return <div className="p-6">Section Paramètres (à implémenter)</div>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-auto lg:ml-0">
        {renderContent()}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;