import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Filter, Search, Calendar, MapPin, User, Clock, AlertCircle, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import MissionModal from './MissionModal';

interface Mission {
  _id: string;
  title: string;
  description: string;
  apartment: {
    _id: string;
    name: string;
    address: string;
  };
  assignedTo: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  dateDebut: string;
  dateFin: string;
  status: 'En attente' | 'En cours' | 'Terminé' | 'Problème';
  priority: 'Faible' | 'Normale' | 'Élevée' | 'Urgente';
  createdAt: string;
  estimatedDuration?: number;
  actualDuration?: number;
}

const MissionsList: React.FC = () => {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [filteredMissions, setFilteredMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadMissions();
  }, []);

  useEffect(() => {
    filterMissions();
  }, [missions, searchTerm, statusFilter, priorityFilter]);

  const loadMissions = async () => {
    try {
      setError('');
      const response = await axios.get('/missions');
      setMissions(response.data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des missions:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement des missions');
    } finally {
      setLoading(false);
    }
  };

  const filterMissions = () => {
    let filtered = missions;

    if (searchTerm) {
      filtered = filtered.filter(mission =>
        mission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.apartment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.assignedTo.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.assignedTo.lastName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(mission => mission.status === statusFilter);
    }

    if (priorityFilter) {
      filtered = filtered.filter(mission => mission.priority === priorityFilter);
    }

    setFilteredMissions(filtered);
  };

  const handleStatusUpdate = async (missionId: string, newStatus: string) => {
    try {
      setUpdating(missionId);
      await axios.put(`/missions/${missionId}`, { status: newStatus });
      await loadMissions();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setUpdating(null);
    }
  };

  const handleEdit = (mission: Mission) => {
    setSelectedMission(mission);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedMission(null);
    setShowModal(true);
  };

  const handleDelete = async (missionId: string, missionTitle: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la mission "${missionTitle}" ?`)) {
      try {
        await axios.delete(`/missions/${missionId}`);
        await loadMissions();
      } catch (error: any) {
        console.error('Erreur lors de la suppression:', error);
        alert(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedMission(null);
    loadMissions();
  };

  const getStatusColor = (status: Mission['status']) => {
    switch (status) {
      case 'En attente':
        return 'bg-yellow-100 text-yellow-800';
      case 'En cours':
        return 'bg-blue-100 text-blue-800';
      case 'Terminé':
        return 'bg-green-100 text-green-800';
      case 'Problème':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: Mission['priority']) => {
    switch (priority) {
      case 'Faible':
        return 'text-green-600';
      case 'Normale':
        return 'text-blue-600';
      case 'Élevée':
        return 'text-orange-600';
      case 'Urgente':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const canUpdateStatus = (mission: Mission) => {
    return user?.role === 'Staff de ménage' && mission.assignedTo._id === user.id;
  };

  const canManageMissions = user?.role === 'Admin' || user?.role === 'Manager';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Missions</h1>
            <p className="text-gray-600 mt-2">
              Gestion des missions de nettoyage
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={loadMissions}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors duration-200"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            {canManageMissions && (
              <button
                onClick={handleCreate}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                Nouvelle mission
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="En attente">En attente</option>
            <option value="En cours">En cours</option>
            <option value="Terminé">Terminé</option>
            <option value="Problème">Problème</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes les priorités</option>
            <option value="Faible">Faible</option>
            <option value="Normale">Normale</option>
            <option value="Élevée">Élevée</option>
            <option value="Urgente">Urgente</option>
          </select>

          <div className="flex items-center text-sm text-gray-600">
            <Filter className="h-4 w-4 mr-1" />
            {filteredMissions.length} résultat(s)
          </div>
        </div>
      </div>

      {/* Missions List */}
      <div className="space-y-4">
        {filteredMissions.map((mission) => (
          <div
            key={mission._id}
            className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {mission.title}
                  </h3>
                  {mission.description && (
                    <p className="text-gray-600 mb-3">{mission.description}</p>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{mission.apartment.name} - {mission.apartment.address}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-2 flex-shrink-0" />
                      {mission.assignedTo.firstName} {mission.assignedTo.lastName}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                      {format(new Date(mission.dateDebut), 'dd MMM yyyy', { locale: fr })} - 
                      {format(new Date(mission.dateFin), 'dd MMM yyyy', { locale: fr })}
                    </div>
                    
                    <div className="flex items-center text-sm">
                      <AlertCircle className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                      <span className={`font-medium ${getPriorityColor(mission.priority)}`}>
                        Priorité: {mission.priority}
                      </span>
                    </div>

                    {mission.estimatedDuration && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                        Durée estimée: {mission.estimatedDuration} min
                        {mission.actualDuration && (
                          <span className="ml-2 text-blue-600">
                            (Réelle: {mission.actualDuration} min)
                          </span>
                        )}
                      </div>
                    )}

                    {mission.cleaningPrice > 0 && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium">Prix: {mission.cleaningPrice}€</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-2 ml-4">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(mission.status)}`}>
                    {mission.status}
                  </span>
                  
                  {canUpdateStatus(mission) && (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {mission.status === 'En attente' && (
                        <button
                          onClick={() => handleStatusUpdate(mission._id, 'En cours')}
                          disabled={updating === mission._id}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                        >
                          {updating === mission._id ? 'Mise à jour...' : 'Commencer'}
                        </button>
                      )}
                      {mission.status === 'En cours' && (
                        <>
                          <button
                            onClick={() => handleStatusUpdate(mission._id, 'Terminé')}
                            disabled={updating === mission._id}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
                          >
                            {updating === mission._id ? 'Mise à jour...' : 'Terminer'}
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(mission._id, 'Problème')}
                            disabled={updating === mission._id}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
                          >
                            {updating === mission._id ? 'Mise à jour...' : 'Problème'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  
                  {canManageMissions && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleEdit(mission)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-200"
                        title="Modifier"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {mission.status !== 'Terminé' && (
                        <button
                          onClick={() => handleDelete(mission._id, mission.title)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredMissions.length === 0 && !loading && (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm || statusFilter || priorityFilter 
              ? 'Aucune mission trouvée pour ces critères' 
              : 'Aucune mission trouvée'
            }
          </p>
          {canManageMissions && !searchTerm && !statusFilter && !priorityFilter && (
            <button
              onClick={handleCreate}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Créer la première mission
            </button>
          )}
        </div>
      )}

      {showModal && (
        <MissionModal
          mission={selectedMission}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default MissionsList;