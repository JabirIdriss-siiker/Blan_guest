import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Search, User, Mail, Phone, Shield, Edit, Trash2, RefreshCw, UserCheck, UserX } from 'lucide-react';
import UserModal from './UserModal';

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'Admin' | 'Staff de ménage' | 'Manager' | 'Blanchisserie';
  phone?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  missionStats?: {
    total: number;
    enAttente: number;
    enCours: number;
    termine: number;
    probleme: number;
  };
  managedApartments?: Array<{
    _id: string;
    name: string;
    address: string;
  }>;
}

const UsersList: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      setError('');
      const response = await axios.get('/users');
      setUsers(response.data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter) {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (statusFilter) {
      filtered = filtered.filter(user => 
        statusFilter === 'active' ? user.isActive : !user.isActive
      );
    }

    setFilteredUsers(filtered);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedUser(null);
    setShowModal(true);
  };

  const handleDeactivate = async (userId: string, userName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir désactiver l'utilisateur "${userName}" ?`)) {
      try {
        await axios.delete(`/users/${userId}`);
        await loadUsers();
      } catch (error: any) {
        console.error('Erreur lors de la désactivation:', error);
        alert(error.response?.data?.message || 'Erreur lors de la désactivation');
      }
    }
  };

  const handleActivate = async (userId: string, userName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir réactiver l'utilisateur "${userName}" ?`)) {
      try {
        await axios.put(`/users/${userId}/activate`);
        await loadUsers();
      } catch (error: any) {
        console.error('Erreur lors de la réactivation:', error);
        alert(error.response?.data?.message || 'Erreur lors de la réactivation');
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedUser(null);
    loadUsers();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-800';
      case 'Manager':
        return 'bg-blue-100 text-blue-800';
      case 'Staff de ménage':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canManageUsers = currentUser?.role === 'Admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Utilisateurs</h1>
            <p className="text-gray-600 mt-2">
              Gestion des comptes utilisateurs
            </p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={loadUsers}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors duration-200"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            {canManageUsers && (
              <button
                onClick={handleCreate}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                <span className="hidden sm:inline">Nouvel utilisateur</span>
                <span className="sm:hidden">Nouveau</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les rôles</option>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Staff de ménage">Staff de ménage</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>

          <div className="flex items-center text-sm text-gray-600 sm:col-span-2 lg:col-span-1">
            <User className="h-4 w-4 mr-1" />
            {filteredUsers.length} utilisateur(s)
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="hidden xl:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Missions
                </th>
                {canManageUsers && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-500 lg:hidden">
                          {user.role}
                        </div>
                        <div className="hidden lg:block text-sm text-gray-500">
                          Créé le {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <Mail className="h-4 w-4 mr-1 flex-shrink-0" />
                      {user.email}
                    </div>
                    {user.phone && (
                      <div className="text-sm text-gray-500 flex items-center mt-1">
                        <Phone className="h-4 w-4 mr-1" />
                        {user.phone}
                      </div>
                    )}
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </span>
                    {user.lastLoginAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        Dernière connexion: {new Date(user.lastLoginAt).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </td>
                  <td className="hidden xl:table-cell px-6 py-4 whitespace-nowrap">
                    {user.missionStats ? (
                      <div className="text-sm">
                        <div className="text-gray-900">Total: {user.missionStats.total}</div>
                        <div className="text-xs text-gray-500">
                          En cours: {user.missionStats.enCours} | 
                          Terminées: {user.missionStats.termine}
                        </div>
                      </div>
                    ) : user.managedApartments ? (
                      <div className="text-sm">
                        <div className="text-gray-900">{user.managedApartments.length} appartement(s)</div>
                        {user.managedApartments.length > 0 && (
                          <div className="text-xs text-gray-500">
                            {user.managedApartments.slice(0, 2).map(apt => apt.name).join(', ')}
                            {user.managedApartments.length > 2 && ` +${user.managedApartments.length - 2}`}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  {canManageUsers && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {user.isActive ? (
                          <button
                            onClick={() => handleDeactivate(user._id, `${user.firstName} ${user.lastName}`)}
                            className="text-red-600 hover:text-red-900"
                            title="Désactiver"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(user._id, `${user.firstName} ${user.lastName}`)}
                            className="text-green-600 hover:text-green-900"
                            title="Réactiver"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length === 0 && !loading && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm || roleFilter || statusFilter 
              ? 'Aucun utilisateur trouvé pour ces critères' 
              : 'Aucun utilisateur trouvé'
            }
          </p>
          {canManageUsers && !searchTerm && !roleFilter && !statusFilter && (
            <button
              onClick={handleCreate}
              className="mt-4 w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Créer le premier utilisateur
            </button>
          )}
        </div>
      )}

      {showModal && (
        <UserModal
          user={selectedUser}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default UsersList;