import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, User, UserPlus, UserMinus, Building } from 'lucide-react';

interface Manager {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  managedApartments?: Array<{
    _id: string;
    name: string;
  }>;
}

interface Apartment {
  _id: string;
  name: string;
  address: string;
}

interface ManagerAssignModalProps {
  apartment: Apartment;
  onClose: () => void;
}

const ManagerAssignModal: React.FC<ManagerAssignModalProps> = ({ apartment, onClose }) => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [assignedManagers, setAssignedManagers] = useState<Manager[]>([]);
  const [unassignedManagers, setUnassignedManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadManagers();
  }, [apartment._id]);

  const loadManagers = async () => {
    try {
      setError('');
      const response = await axios.get('/users?role=Manager');
      const allManagers = response.data.filter((user: any) => user.role === 'Manager' && user.isActive);
      
      setManagers(allManagers);
      
      // Séparer les managers assignés et non assignés
      const assigned = allManagers.filter((manager: Manager) => 
        manager.managedApartments?.some(apt => apt._id === apartment._id)
      );
      const unassigned = allManagers.filter((manager: Manager) => 
        !manager.managedApartments?.some(apt => apt._id === apartment._id)
      );
      
      setAssignedManagers(assigned);
      setUnassignedManagers(unassigned);
    } catch (error: any) {
      console.error('Erreur lors du chargement des managers:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement des managers');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignManager = async (managerId: string) => {
    try {
      setProcessing(managerId);
      await axios.post(`/apartments/${apartment._id}/assign-manager`, { managerId });
      await loadManagers();
    } catch (error: any) {
      console.error('Erreur lors de l\'assignation:', error);
      alert(error.response?.data?.message || 'Erreur lors de l\'assignation du manager');
    } finally {
      setProcessing(null);
    }
  };

  const handleUnassignManager = async (managerId: string) => {
    try {
      setProcessing(managerId);
      await axios.delete(`/apartments/${apartment._id}/unassign-manager/${managerId}`);
      await loadManagers();
    } catch (error: any) {
      console.error('Erreur lors du retrait:', error);
      alert(error.response?.data?.message || 'Erreur lors du retrait du manager');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Gestion des Managers
              </h2>
              <p className="text-gray-600 mt-1">
                <Building className="h-4 w-4 inline mr-1" />
                {apartment.name} - {apartment.address}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Managers assignés */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <UserPlus className="h-5 w-5 mr-2 text-green-600" />
                  Managers assignés ({assignedManagers.length})
                </h3>
                {assignedManagers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                    Aucun manager assigné à cet appartement
                  </p>
                ) : (
                  <div className="space-y-3">
                    {assignedManagers.map((manager) => (
                      <div
                        key={manager._id}
                        className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-green-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {manager.firstName} {manager.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {manager.email}
                            </div>
                            <div className="text-xs text-gray-500">
                              Gère {manager.managedApartments?.length || 0} appartement(s)
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnassignManager(manager._id)}
                          disabled={processing === manager._id}
                          className="inline-flex items-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
                        >
                          <UserMinus className="h-4 w-4 mr-1" />
                          {processing === manager._id ? 'Retrait...' : 'Retirer'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Managers disponibles */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="h-5 w-5 mr-2 text-blue-600" />
                  Managers disponibles ({unassignedManagers.length})
                </h3>
                {unassignedManagers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                    Tous les managers sont déjà assignés à cet appartement
                  </p>
                ) : (
                  <div className="space-y-3">
                    {unassignedManagers.map((manager) => (
                      <div
                        key={manager._id}
                        className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-gray-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {manager.firstName} {manager.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {manager.email}
                            </div>
                            <div className="text-xs text-gray-500">
                              Gère {manager.managedApartments?.length || 0} appartement(s)
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssignManager(manager._id)}
                          disabled={processing === manager._id}
                          className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          {processing === manager._id ? 'Assignation...' : 'Assigner'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-6 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerAssignModal;