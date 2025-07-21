import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, MapPin, Home, Calendar, Edit, Trash2, Users, Wifi, RefreshCw, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ApartmentModal from './ApartmentModal';
import { useAuth } from '../../contexts/AuthContext';

interface Apartment {
  _id: string;
  name: string;
  address: string;
  description: string;
  surface: number;
  nombreChambres: number;
  nombreSallesDeBains: number;
  photos: string[];
  amenities: string[];
  instructions: string;
  bookings: Array<{
    dateDebut: string;
    dateFin: string;
    guestName: string;
    source: string;
  }>;
  createdBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

const ApartmentsList: React.FC = () => {
  const { user } = useAuth();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [filteredApartments, setFilteredApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [error, setError] = useState('');
  const [creatingMissions, setCreatingMissions] = useState(false);

  useEffect(() => {
    loadApartments();
  }, []);

  useEffect(() => {
    filterApartments();
  }, [apartments, searchTerm]);

  const loadApartments = async () => {
    try {
      setError('');
      const response = await axios.get('/apartments');
      setApartments(response.data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des appartements:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement des appartements');
    } finally {
      setLoading(false);
    }
  };

  const filterApartments = () => {
    let filtered = apartments;

    if (searchTerm) {
      filtered = filtered.filter(apartment =>
        apartment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apartment.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredApartments(filtered);
  };

  const handleEdit = (apartment: Apartment) => {
    setSelectedApartment(apartment);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedApartment(null);
    setShowModal(true);
  };

  const handleDelete = async (apartmentId: string, apartmentName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'appartement "${apartmentName}" ?`)) {
      try {
        await axios.delete(`/apartments/${apartmentId}`);
        await loadApartments();
      } catch (error: any) {
        console.error('Erreur lors de la suppression:', error);
        alert(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedApartment(null);
    loadApartments();
  };

  const handleCreateAutomaticMissions = async () => {
    try {
      setCreatingMissions(true);
      const response = await axios.post('/ical/create-missions');
      
      const { summary } = response.data;
      alert(`Missions automatiques créées:\n- ${summary.successfulMissions} missions créées avec succès\n- ${summary.failedMissions} échecs\n- ${summary.upcomingBookingsProcessed} réservations à venir (5j) traitées\n- ${summary.recentBookingsProcessed} réservations récentes traitées`);
      
      await loadApartments();
    } catch (error: any) {
      console.error('Erreur lors de la création des missions automatiques:', error);
      alert(error.response?.data?.message || 'Erreur lors de la création des missions automatiques');
    } finally {
      setCreatingMissions(false);
    }
  };

  const isCurrentlyOccupied = (bookings: Apartment['bookings']) => {
    const now = new Date();
    return bookings.some(booking => {
      const start = new Date(booking.dateDebut);
      const end = new Date(booking.dateFin);
      return now >= start && now <= end;
    });
  };

  const getNextBooking = (bookings: Apartment['bookings']) => {
    const now = new Date();
    const futureBookings = bookings.filter(booking => new Date(booking.dateDebut) > now);
    return futureBookings.sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())[0];
  };

  const canManageApartments = user?.role === 'Admin' || user?.role === 'Manager';

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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Appartements</h1>
            <p className="text-gray-600 mt-2">
              Gestion des propriétés locatives
            </p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={loadApartments}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors duration-200"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            {canManageApartments && (
              <button
                onClick={handleCreateAutomaticMissions}
                disabled={creatingMissions}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
              >
                <Zap className={`h-5 w-5 mr-2 ${creatingMissions ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{creatingMissions ? 'Création...' : 'Missions Auto'}</span>
                <span className="sm:hidden">{creatingMissions ? 'Création...' : 'Auto'}</span>
              </button>
            )}
            {canManageApartments && (
              <button
                onClick={handleCreate}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                <span className="hidden sm:inline">Nouvel appartement</span>
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

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un appartement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Apartments Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredApartments.map((apartment) => (
          <div
            key={apartment._id}
            className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
          >
            {apartment.photos.length > 0 && (
              <div className="relative h-48 overflow-hidden rounded-t-lg">
                <img
                  src={`http://localhost:5000${apartment.photos[0]}`}
                  alt={apartment.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <div className="absolute top-3 right-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    isCurrentlyOccupied(apartment.bookings)
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {isCurrentlyOccupied(apartment.bookings) ? 'Occupé' : 'Libre'}
                  </span>
                </div>
              </div>
            )}
            
            <div className="p-4 sm:p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {apartment.name}
              </h3>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate text-xs sm:text-sm">{apartment.address}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <Home className="h-4 w-4 mr-2 flex-shrink-0" />
                  {apartment.surface}m² • {apartment.nombreChambres} chambres • {apartment.nombreSallesDeBains} SDB
                </div>
                
                {apartment.cleaningPrice > 0 && (
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-medium">Prix nettoyage: {apartment.cleaningPrice}€</span>
                  </div>
                )}
                
                {apartment.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {apartment.amenities.slice(0, 3).map((amenity, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {amenity}
                      </span>
                    ))}
                    {apartment.amenities.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        +{apartment.amenities.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Booking Info */}
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <Calendar className="h-4 w-4 mr-2" />
                  Réservations
                </div>
                {apartment.bookings.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucune réservation</p>
                ) : (
                  <div className="space-y-1">
                    {isCurrentlyOccupied(apartment.bookings) && (
                      <div className="bg-red-50 p-2 rounded text-sm">
                        <p className="text-red-800 font-medium">Actuellement occupé</p>
                      </div>
                    )}
                    {(() => {
                      const nextBooking = getNextBooking(apartment.bookings);
                      return nextBooking ? (
                        <div className="bg-blue-50 p-2 rounded text-sm">
                          <p className="text-blue-800">
                            Prochaine: {format(new Date(nextBooking.dateDebut), 'dd MMM', { locale: fr })}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Aucune réservation future</p>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                <div className="text-xs text-gray-500">
                  Créé par {apartment.createdBy.firstName} {apartment.createdBy.lastName}
                </div>
                {canManageApartments && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(apartment)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-200"
                      title="Modifier"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(apartment._id, apartment.name)}
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
        ))}
      </div>

      {filteredApartments.length === 0 && !loading && (
        <div className="text-center py-12">
          <Home className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm ? 'Aucun appartement trouvé pour cette recherche' : 'Aucun appartement trouvé'}
          </p>
          {canManageApartments && !searchTerm && (
            <button
              onClick={handleCreate}
              className="mt-4 w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Créer le premier appartement
            </button>
          )}
        </div>
      )}

      {showModal && (
        <ApartmentModal
          apartment={selectedApartment}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default ApartmentsList;