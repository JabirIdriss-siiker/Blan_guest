import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Shirt, List, Plus } from 'lucide-react';
import LaundryTasksList from './LaundryTasksList';
import LaundryTaskModal from './LaundryTaskModal';

const LaundryDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [showModal, setShowModal] = useState(false);

  const tabs = [
    { id: 'list', name: 'Liste des tâches', icon: List },
  ];

  const canManageTasks = user?.role === 'Admin' || user?.role === 'Manager';

  const renderContent = () => {
    switch (activeTab) {
      case 'list':
        return <LaundryTasksList />;
      default:
        return <LaundryTasksList />;
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Blanchisserie</h1>
            <p className="text-gray-600 mt-2">
              Gestion des tâches de préparation de linge
            </p>
          </div>
          {canManageTasks && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              <span className="hidden sm:inline">Nouvelle tâche</span>
              <span className="sm:hidden">Nouvelle</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="border-b">
          <nav className="flex px-4 sm:px-6">
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

      {/* Content */}
      {renderContent()}

      {showModal && (
        <LaundryTaskModal
          task={null}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default LaundryDashboard;