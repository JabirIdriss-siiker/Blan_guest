import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Euro, Users, TrendingUp, Calendar } from 'lucide-react';
import InvoicesList from './InvoicesList';
import StaffEarnings from './StaffEarnings';

const InvoiceDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('invoices');
  const [stats, setStats] = useState({
    total: 0,
    totalAmount: 0,
    brouillon: 0,
    envoyee: 0,
    payee: 0,
    annulee: 0,
  });
  const [loading, setLoading] = useState(true);

  const tabs = [
    { id: 'invoices', name: 'Factures', icon: FileText },
    { id: 'earnings', name: 'Gains du personnel', icon: Users },
  ];

  useEffect(() => {
    if (user?.role === 'Admin' || user?.role === 'Manager') {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const response = await axios.get('/invoices/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'invoices':
        return <InvoicesList />;
      case 'earnings':
        return <StaffEarnings />;
      default:
        return <InvoicesList />;
    }
  };

  if (user?.role === 'Blanchisserie') {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            Accès factures réservé aux Administrateurs, Managers et Personnel de ménage
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Factures</h1>
            <p className="text-gray-600 mt-2">
              Gestion des factures et gains du personnel
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards - Only for Admin/Manager */}
      {(user?.role === 'Admin' || user?.role === 'Manager') && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Total Factures</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <Euro className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Montant Total</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAmount.toFixed(0)}€</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">En attente</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.brouillon + stats.envoyee}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Payées</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.payee}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - Only for Admin/Manager */}
      {(user?.role === 'Admin' || user?.role === 'Manager') && (
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b">
            <nav className="flex flex-wrap px-4 sm:px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-2 sm:px-4 mr-4 sm:mr-8 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Content */}
      {renderContent()}
    </div>
  );
};

export default InvoiceDashboard;