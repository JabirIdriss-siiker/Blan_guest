import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Calendar, MapPin, User, AlertCircle, Clock, CheckSquare } from 'lucide-react';

interface Apartment {
  _id: string;
  name: string;
  address: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Mission {
  _id: string;
  title: string;
  description: string;
  apartment: Apartment;
  assignedTo: User;
  dateDebut: string;
  dateFin: string;
  status: 'En attente' | 'En cours' | 'Terminé' | 'Problème';
  priority: 'Faible' | 'Normale' | 'Élevée' | 'Urgente';
  instructions: string;
  checklist: Array<{
    _id: string;
    task: string;
    completed: boolean;
  }>;
  estimatedDuration: number;
}

interface MissionModalProps {
  mission: Mission | null;
  onClose: () => void;
}

const MissionModal: React.FC<MissionModalProps> = ({ mission, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    apartment: '',
    assignedTo: '',
    dateDebut: '',
    dateFin: '',
    priority: 'Normale' as const,
    instructions: '',
    estimatedDuration: 60,
    cleaningPrice: 0,
  });
  const [checklist, setChecklist] = useState<string[]>(['']);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (mission) {
      setFormData({
        title: mission.title,
        description: mission.description,
        apartment: mission.apartment._id,
        assignedTo: mission.assignedTo._id,
        dateDebut: mission.dateDebut.split('T')[0],
        dateFin: mission.dateFin.split('T')[0],
        priority: mission.priority,
        instructions: mission.instructions || '',
        estimatedDuration: mission.estimatedDuration || 60,
        cleaningPrice: mission.cleaningPrice || 0,
      });
      setChecklist(mission.checklist?.map(item => item.task) || ['']);
    }
  }, [mission]);

  const loadData = async () => {
    try {
      const [apartmentsRes, staffRes] = await Promise.all([
        axios.get('/apartments'),
        axios.get('/users/staff'),
      ]);
      setApartments(apartmentsRes.data);
      setStaff(staffRes.data);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const checklistItems = checklist.filter(item => item.trim() !== '').map(task => ({ task }));
      
      const payload = {
        ...formData,
        checklist: checklistItems,
      };

      if (mission) {
        await axios.put(`/missions/${mission._id}`, payload);
      } else {
        await axios.post('/missions', payload);
      }

      onClose();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleChecklistChange = (index: number, value: string) => {
    const newChecklist = [...checklist];
    newChecklist[index] = value;
    setChecklist(newChecklist);
  };

  const addChecklistItem = () => {
    setChecklist([...checklist, '']);
  };

  const removeChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {mission ? 'Modifier la mission' : 'Nouvelle mission'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titre de la mission
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priorité
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Faible">Faible</option>
                <option value="Normale">Normale</option>
                <option value="Élevée">Élevée</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appartement
              </label>
              <select
                name="apartment"
                value={formData.apartment}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner un appartement</option>
                {apartments.map(apartment => (
                  <option key={apartment._id} value={apartment._id}>
                    {apartment.name} - {apartment.address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigné à
              </label>
              <select
                name="assignedTo"
                value={formData.assignedTo}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner un membre du personnel</option>
                {staff.map(member => (
                  <option key={member._id} value={member._id}>
                    {member.firstName} {member.lastName} - {member.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de début
              </label>
              <input
                type="date"
                name="dateDebut"
                value={formData.dateDebut}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de fin
              </label>
              <input
                type="date"
                name="dateFin"
                value={formData.dateFin}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Durée estimée (minutes)
              </label>
              <input
                type="number"
                name="estimatedDuration"
                value={formData.estimatedDuration}
                onChange={handleInputChange}
                min="15"
                step="15"
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix de nettoyage (€)
              </label>
              <input
                type="number"
                name="cleaningPrice"
                value={formData.cleaningPrice}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instructions spéciales
            </label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Liste de vérification
            </label>
            <div className="space-y-2">
              {checklist.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <CheckSquare className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => handleChecklistChange(index, e.target.value)}
                    placeholder="Tâche à accomplir"
                    className="flex-1 px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {checklist.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addChecklistItem}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Ajouter une tâche
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 sm:pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MissionModal;