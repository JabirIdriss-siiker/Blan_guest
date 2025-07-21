import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Users, UserCheck, Target, TrendingUp } from 'lucide-react';
import ClientsList from './Clients/ClientsList';
import ContactsList from './Contacts/ContactsList';
import LeadsList from './Leads/LeadsList';
import LeadsPipeline from './Leads/LeadsPipeline';

const CRMDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('clients');
  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');

  const tabs = [
    { id: 'clients', name: 'Clients', icon: Users },
    { id: 'contacts', name: 'Contacts', icon: UserCheck },
    { id: 'leads', name: 'Leads', icon: Target },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'clients':
        return <ClientsList />;
      case 'contacts':
        return <ContactsList />;
      case 'leads':
        return viewMode === 'pipeline' ? <LeadsPipeline /> : <LeadsList />;
      default:
        return <ClientsList />;
    }
  };

  if (user?.role === 'Staff de ménage') {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="text-center py-12">
          <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            Accès CRM réservé aux Administrateurs et Managers
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">CRM</h1>
            <p className="text-gray-600 mt-2">
              Gestion de la relation client
            </p>
          </div>
          {activeTab === 'leads' && (
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <button
                onClick={() => setViewMode('list')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg transition-colors duration-200 ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Liste
              </button>
              <button
                onClick={() => setViewMode('pipeline')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg transition-colors duration-200 ${
                  viewMode === 'pipeline'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <TrendingUp className="h-4 w-4 mr-2 inline" />
                Pipeline
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="border-b">
          <nav className="flex flex-wrap px-4 sm:px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'leads') {
                    setViewMode('list');
                  }
                }}
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

      {/* Content */}
      {renderContent()}
    </div>
  );
};

export default CRMDashboard;