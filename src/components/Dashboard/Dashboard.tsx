import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Home, CheckCircle, AlertCircle, Clock, Users, Zap, List, Shirt } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { fr } from 'date-fns/locale';
import CalendarView from './CalendarView';

interface Mission {
  _id: string;
  title: string;
  apartment: {
    _id: string;
    name: string;
    address: string;
    description : string;
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
}

interface Apartment {
  _id: string;
  name: string;
  address: string;
  description : string;
  bookings: Array<{
    dateDebut: string;
    dateFin: string;
    guestName: string;
    source: string;
  }>;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoMissionsLoading, setAutoMissionsLoading] = useState(false);
  const [autoLaundryLoading, setAutoLaundryLoading] = useState(false);
  const [stats, setStats] = useState({
    totalMissions: 0,
    missionsEnCours: 0,
    missionsTerminees: 0,
    missionsProbleme: 0,
    totalApartments: 0,
    apartmentsOccupes: 0,
    laundryTasks: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [missionsRes, apartmentsRes] = await Promise.all([
        axios.get('/missions'),
        user?.role !== 'Staff de ménage' ? axios.get('/apartments') : Promise.resolve({ data: [] }),
      ]);

      setMissions(missionsRes.data);
      setApartments(apartmentsRes.data);

      // Calculate stats
      const totalMissions = missionsRes.data.length;
      const missionsEnCours = missionsRes.data.filter((m: Mission) => m.status === 'En cours').length;
      const missionsTerminees = missionsRes.data.filter((m: Mission) => m.status === 'Terminé').length;
      const missionsProbleme = missionsRes.data.filter((m: Mission) => m.status === 'Problème').length;

      const totalApartments = apartmentsRes.data.length;
      const apartmentsOccupes = apartmentsRes.data.filter((apt: Apartment) => {
        const today = new Date();
        return apt.bookings.some(booking => {
          const start = new Date(booking.dateDebut);
          const end = new Date(booking.dateFin);
          return today >= start && today <= end;
        });
      }).length;

      setStats({
        totalMissions,
        missionsEnCours,
        missionsTerminees,
        missionsProbleme,
        totalApartments,
        apartmentsOccupes,
        laundryTasks: 0, // Will be loaded separately if needed
      });
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAutomaticLaundry = async () => {
    try {
      setAutoLaundryLoading(true);
      const response = await axios.post('/laundry/auto');
      
      const { summary } = response.data;
      alert(`Tâches de blanchisserie automatiques:\n- ${summary.successful} tâches créées avec succès\n- ${summary.failed} échecs\n- ${summary.skipped} ignorées (déjà existantes)`);
      
      await loadDashboardData();
    } catch (error: any) {
      console.error('Erreur lors de la création des tâches de blanchisserie:', error);
      alert(error.response?.data?.message || 'Erreur lors de la création des tâches de blanchisserie');
    } finally {
      setAutoLaundryLoading(false);
    }
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

  const getUpcomingMissions = () => {
    const today = new Date();
    const upcoming = missions.filter(mission => {
      const missionDate = new Date(mission.dateDebut);
      return missionDate >= today && mission.status !== 'Terminé';
    });
    return upcoming.sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime());
  };

  const getDateLabel = (date: string) => {
    const missionDate = new Date(date);
    if (isToday(missionDate)) return 'Aujourd\'hui';
    if (isTomorrow(missionDate)) return 'Demain';
    return format(missionDate, 'dd MMM yyyy', { locale: fr });
  };

  const handleCreateAutomaticMissions = async () => {
    try {
      setAutoMissionsLoading(true);
      const response = await axios.post('/ical/create-missions');
      
      const { summary } = response.data;
      alert(`Missions automatiques créées:\n- ${summary.successfulMissions} missions créées avec succès\n- ${summary.failedMissions} échecs`);
      
      await loadDashboardData();
    } catch (error: any) {
      console.error('Erreur lors de la création des missions automatiques:', error);
      alert(error.response?.data?.message || 'Erreur lors de la création des missions automatiques');
    } finally {
      setAutoMissionsLoading(false);
    }
  };

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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Tableau de bord
        </h1>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 space-y-3 sm:space-y-0">
          <p className="text-gray-600">
            Bienvenue, {user?.firstName}! Voici un aperçu de vos activités.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="h-4 w-4 mr-1 inline" />
                Liste
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                  viewMode === 'calendar'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="h-4 w-4 mr-1 inline" />
                Calendrier
              </button>
            </div>

            {(user?.role === 'Admin' || user?.role === 'Manager') && (
              <button
                onClick={handleCreateAutomaticMissions}
                disabled={autoMissionsLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
                title="Créer des missions pour les réservations se terminant dans les 5 prochains jours"
              >
                <Zap className={`h-4 w-4 mr-2 ${autoMissionsLoading ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{autoMissionsLoading ? 'Création...' : 'Missions Auto (5j)'}</span>
                <span className="sm:hidden">{autoMissionsLoading ? 'Création...' : 'Missions Auto'}</span>
              </button>
            )}
           {(user?.role === 'Admin' || user?.role === 'Manager') && (
             <button
               onClick={handleCreateAutomaticLaundry}
               disabled={autoLaundryLoading}
               className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors duration-200"
               title="Créer des tâches de blanchisserie pour les nouvelles missions"
             >
               <Shirt className={`h-4 w-4 mr-2 ${autoLaundryLoading ? 'animate-pulse' : ''}`} />
               <span className="hidden sm:inline">{autoLaundryLoading ? 'Création...' : 'Blanchisserie Auto'}</span>
               <span className="sm:hidden">{autoLaundryLoading ? 'Création...' : 'Blanchisserie'}</span>
             </button>
           )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Missions</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.totalMissions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">En cours</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.missionsEnCours}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Terminées</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.missionsTerminees}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Problèmes</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.missionsProbleme}</p>
            </div>
          </div>
        </div>

        {(user?.role === 'Admin' || user?.role === 'Manager') && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <Shirt className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Tâches Blanchisserie</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.laundryTasks}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Admin/Manager Stats */}
      {(user?.role === 'Admin' || user?.role === 'Manager') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <Home className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Total Appartements</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.totalApartments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-full">
                <Users className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Appartements Occupés</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.apartmentsOccupes}</p>
              </div>
            </div>
          </div>
        </div>
        
      )}   

      {/* Missions View */}
      {viewMode === 'calendar' ? (
        <CalendarView />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 sm:p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              Missions à venir
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            {getUpcomingMissions().length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucune mission à venir
              </p>
            ) : (
              <div className="space-y-4">
                {getUpcomingMissions().slice(0, 5).map((mission) => (
                  <div
                    key={mission._id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 space-y-3 sm:space-y-0"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{mission.title}</h3>
                      <p className="text-sm text-gray-600">
                        {mission.apartment.name} - {mission.apartment.address} - {mission.apartment.description}
                      </p>
                      <div className="flex flex-wrap items-center mt-2 gap-2 sm:gap-4">
                        <span className="text-sm text-gray-500">
                          {getDateLabel(mission.dateDebut)}
                        </span>
                        <span className={`text-sm font-medium ${getPriorityColor(mission.priority)}`}>
                          {mission.priority}
                        </span>
                        {user?.role !== 'Staff de ménage' && (
                          <span className="text-sm text-gray-500">
                            Assigné à: {mission.assignedTo.firstName} {mission.assignedTo.lastName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="sm:ml-4 self-start sm:self-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(mission.status)}`}>
                        {mission.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;