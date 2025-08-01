import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Search, Calendar, MapPin, User, Clock, Edit, Trash2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import LaundryTaskModal from './LaundryTaskModal';

interface LaundryTask {
  _id: string;
  apartment: {
    _id: string;
    name: string;
    address: string;
  };
  scheduledAt: string;
  items: Array<{
    label: string;
    qty: number;
  }>;
  assignedTo: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  status: 'À préparer' | 'Préparé' | 'Problème';
  autoGenerated: boolean;
  notes?: string;
  completedAt?: string;
  createdBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

const LaundryTasksList: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<LaundryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [apartmentFilter, setApartmentFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<LaundryTask | null>(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    loadTasks();
  }, [pagination.page, statusFilter, apartmentFilter, dateFromFilter, dateToFilter]);

  const loadTasks = async () => {
    try {
      setError('');
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (statusFilter) params.append('status', statusFilter);
      if (apartmentFilter) params.append('apartment', apartmentFilter);
      if (dateFromFilter) params.append('dateFrom', dateFromFilter);
      if (dateToFilter) params.append('dateTo', dateToFilter);

      const response = await axios.get(`/laundry?${params}`);
      setTasks(response.data.tasks);
      setPagination(response.data.pagination);
    } catch (error: any) {
      console.error('Erreur lors du chargement des tâches:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      setUpdating(taskId);
      await axios.put(`/laundry/${taskId}`, { status: newStatus });
      await loadTasks();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setUpdating(null);
    }
  };

  const handleEdit = (task: LaundryTask) => {
    setSelectedTask(task);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedTask(null);
    setShowModal(true);
  };

  const handleDelete = async (taskId: string, taskApartment: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer cette tâche pour "${taskApartment}" ?`)) {
      try {
        await axios.delete(`/laundry/${taskId}`);
        await loadTasks();
      } catch (error: any) {
        console.error('Erreur lors de la suppression:', error);
        alert(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedTask(null);
    loadTasks();
  };

  const getStatusColor = (status: LaundryTask['status']) => {
    switch (status) {
      case 'À préparer':
        return 'bg-yellow-100 text-yellow-800';
      case 'Préparé':
        return 'bg-green-100 text-green-800';
      case 'Problème':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canUpdateStatus = (task: LaundryTask) => {
    return user?.role === 'Blanchisserie' && task.assignedTo._id === user.id;
  };

  const canManageTasks = user?.role === 'Admin' || user?.role === 'Manager';

  const filteredTasks = tasks.filter(task =>
    !searchTerm || 
    task.apartment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.apartment.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.assignedTo.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.assignedTo.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-4 sm:space-y-0">
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher des tâches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 sm:ml-4">
            <button
              onClick={loadTasks}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors duration-200"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            {canManageTasks && (
              <button
                onClick={handleCreate}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                <span className="hidden sm:inline">Nouvelle tâche</span>
                <span className="sm:hidden">Nouvelle</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="À préparer">À préparer</option>
            <option value="Préparé">Préparé</option>
            <option value="Problème">Problème</option>
          </select>

          <input
            type="date"
            value={dateFromFilter}
            onChange={(e) => setDateFromFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Date de début"
          />

          <input
            type="date"
            value={dateToFilter}
            onChange={(e) => setDateToFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Date de fin"
          />

          <div className="flex items-center text-sm text-gray-600 sm:col-span-2 lg:col-span-1">
            <Clock className="h-4 w-4 mr-1" />
            {pagination.total} tâche(s)
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <div
            key={task._id}
            className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-6">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-4 space-y-4 lg:space-y-0">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {task.apartment.name}
                    </h3>
                    {task.autoGenerated && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        Auto
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{task.apartment.address}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-2 flex-shrink-0" />
                      {task.assignedTo.firstName} {task.assignedTo.lastName}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                      {format(new Date(task.scheduledAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                    </div>
                    
                    {task.completedAt && (
                      <div className="flex items-center text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                        Terminé le {format(new Date(task.completedAt), 'dd MMM yyyy', { locale: fr })}
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Articles à préparer:</h4>
                    <div className="flex flex-wrap gap-2">
                      {task.items.map((item, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                        >
                          {item.qty}x {item.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {task.notes && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600">{task.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-row lg:flex-col items-start lg:items-end justify-between lg:justify-start space-x-2 lg:space-x-0 lg:space-y-2 lg:ml-4">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                  
                  {canUpdateStatus(task) && (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {task.status === 'À préparer' && (
                        <button
                          onClick={() => handleStatusUpdate(task._id, 'Préparé')}
                          disabled={updating === task._id}
                          className="px-2 sm:px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
                        >
                          {updating === task._id ? 'Mise à jour...' : 'Marquer Préparé'}
                        </button>
                      )}
                      {task.status !== 'Problème' && (
                        <button
                          onClick={() => handleStatusUpdate(task._id, 'Problème')}
                          disabled={updating === task._id}
                          className="px-2 sm:px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
                        >
                          {updating === task._id ? 'Mise à jour...' : 'Signaler Problème'}
                        </button>
                      )}
                    </div>
                  )}
                  
                  {canManageTasks && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleEdit(task)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-200"
                        title="Modifier"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(task._id, task.apartment.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">
            Affichage de {((pagination.page - 1) * pagination.limit) + 1} à{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} sur{' '}
            {pagination.total} résultats
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.pages}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {filteredTasks.length === 0 && !loading && (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm || statusFilter || dateFromFilter || dateToFilter 
              ? 'Aucune tâche trouvée pour ces critères' 
              : 'Aucune tâche trouvée'
            }
          </p>
          {canManageTasks && !searchTerm && !statusFilter && !dateFromFilter && !dateToFilter && (
            <button
              onClick={handleCreate}
              className="mt-4 w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Créer la première tâche
            </button>
          )}
        </div>
      )}

      {showModal && (
        <LaundryTaskModal
          task={selectedTask}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default LaundryTasksList;