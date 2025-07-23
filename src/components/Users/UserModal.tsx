import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, User, Mail, Phone, Shield, Eye, EyeOff, Building } from 'lucide-react';

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'Admin' | 'Staff de ménage' | 'Manager' | 'Blanchisserie';
  phone?: string;
  isActive: boolean;
  managedApartments?: Array<{
    _id: string;
    name: string;
    address: string;
  }>;
}

interface Apartment {
  _id: string;
  name: string;
  address: string;
}

interface UserModalProps {
  user: User | null;
  onClose: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, onClose }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'Staff de ménage' as const,
    phone: '',
  });
  const [managedApartments, setManagedApartments] = useState<string[]>([]);
  const [availableApartments, setAvailableApartments] = useState<Apartment[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadApartments();
    if (user) {
      setFormData({
        email: user.email,
        password: '',
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone || '',
      });
      setManagedApartments(user.managedApartments?.map(apt => apt._id) || []);
    } else {
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'Staff de ménage',
        phone: '',
      });
      setManagedApartments([]);
    }
  }, [user]);

  const loadApartments = async () => {
    try {
      const response = await axios.get('/apartments');
      setAvailableApartments(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des appartements:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = { 
        ...formData,
        ...(formData.role === 'Manager' && { managedApartments })
      };
      
      // Don't send empty password for updates
      if (user && !payload.password) {
        delete payload.password;
      }

      if (user) {
        await axios.put(`/users/${user._id}`, payload);
      } else {
        if (!payload.password) {
          setError('Le mot de passe est requis pour un nouvel utilisateur');
          setLoading(false);
          return;
        }
        await axios.post('/users', payload);
      }

      onClose();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApartmentToggle = (apartmentId: string) => {
    setManagedApartments(prev => 
      prev.includes(apartmentId)
        ? prev.filter(id => id !== apartmentId)
        : [...prev, apartmentId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prénom
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Prénom"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@exemple.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {user ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'}
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required={!user}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={user ? 'Laisser vide pour ne pas changer' : 'Mot de passe'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Téléphone (optionnel)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+33 1 23 45 67 89"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rôle
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Staff de ménage">Staff de ménage</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
              <option value="Blanchisserie">Blanchisserie</option>
            </select>
          </div>

          {/* Appartements gérés - Seulement pour les Managers */}
          {formData.role === 'Manager' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="h-4 w-4 inline mr-1" />
                Appartements gérés
              </label>
              <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                {availableApartments.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun appartement disponible</p>
                ) : (
                  <div className="space-y-2">
                    {availableApartments.map((apartment) => (
                      <label key={apartment._id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={managedApartments.includes(apartment._id)}
                          onChange={() => handleApartmentToggle(apartment._id)}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {apartment.name} - {apartment.address}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Sélectionnez les appartements que ce Manager peut gérer. 
                Laisser vide pour aucun accès.
              </p>
            </div>
          )}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;