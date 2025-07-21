import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Calendar, MapPin, User, Plus, Trash2, FileText } from 'lucide-react';

interface Apartment {
  _id: string;
  name: string;
  address: string;
  defaultLaundryBag: Array<{
    label: string;
    qty: number;
  }>;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

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
  notes?: string;
}

interface LaundryTaskModalProps {
  task: LaundryTask | null;
  onClose: () => void;
}

const LaundryTaskModal: React.FC<LaundryTaskModalProps> = ({ task, onClose }) => {
  const [formData, setFormData] = useState({
    apartment: '',
    scheduledAt: '',
    assignedTo: '',
    notes: '',
  });
  const [items, setItems] = useState<Array<{ label: string; qty: number }>>([
    { label: '', qty: 1 }
  ]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (task) {
      setFormData({
        apartment: task.apartment._id,
        scheduledAt: task.scheduledAt.split('T')[0] + 'T' + task.scheduledAt.split('T')[1].slice(0, 5),
        assignedTo: task.assignedTo._id,
        notes: task.notes || '',
      });
      setItems(task.items.length > 0 ? task.items : [{ label: '', qty: 1 }]);
    }
  }, [task]);

  const loadData = async () => {
    try {
      const [apartmentsRes, staffRes] = await Promise.all([
        axios.get('/apartments'),
        axios.get('/users'),
      ]);
      setApartments(apartmentsRes.data);
      setStaff(staffRes.data.filter((user: User & { role: string }) => 
        user.role === 'Blanchisserie' || user.role === "Staff de ménage"
      ));
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const validItems = items.filter(item => item.label.trim() !== '');
      
      if (validItems.length === 0) {
        setError('Au moins un article doit être spécifié');
        setLoading(false);
        return;
      }

      const payload = {
        ...formData,
        items: validItems,
      };

      if (task) {
        await axios.put(`/laundry/${task._id}`, payload);
      } else {
        await axios.post('/laundry', payload);
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

  const handleApartmentChange = (apartmentId: string) => {
    setFormData(prev => ({ ...prev, apartment: apartmentId }));
    
    // Auto-fill items from apartment's default laundry bag
    const selectedApartment = apartments.find(apt => apt._id === apartmentId);
    if (selectedApartment && selectedApartment.defaultLaundryBag && selectedApartment.defaultLaundryBag.length > 0) {
      setItems(selectedApartment.defaultLaundryBag);
    } else {
      setItems([{ label: '', qty: 1 }]);
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { label: '', qty: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {task ? 'Modifier la tâche de blanchisserie' : 'Nouvelle tâche de blanchisserie'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appartement *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  name="apartment"
                  value={formData.apartment}
                  onChange={(e) => handleApartmentChange(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un appartement</option>
                  {apartments.map(apartment => (
                    <option key={apartment._id} value={apartment._id}>
                      {apartment.name} - {apartment.address}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date et heure prévues *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  value={formData.scheduledAt}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigné à *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  name="assignedTo"
                  value={formData.assignedTo}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un membre du personnel</option>
                  {staff.map(member => (
                    <option key={member._id} value={member._id}>
                      {member.firstName} {member.lastName} - {member.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Articles à préparer *
            </label>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => handleItemChange(index, 'label', e.target.value)}
                    placeholder="Article (ex: Draps, Serviettes...)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => handleItemChange(index, 'qty', parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md"
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un article
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Instructions spéciales ou notes..."
            />
          </div>

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

export default LaundryTaskModal;