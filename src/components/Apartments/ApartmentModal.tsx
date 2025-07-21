import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Upload, Trash2, Plus, Link } from 'lucide-react';

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
  icalUrls: Array<{
    _id: string;
    url: string;
    source: string;
    isActive: boolean;
  }>;
}

interface ApartmentModalProps {
  apartment: Apartment | null;
  onClose: () => void;
}

const ApartmentModal: React.FC<ApartmentModalProps> = ({ apartment, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    description: '',
    surface: 0,
    nombreChambres: 1,
    nombreSallesDeBains: 1,
    cleaningPrice: 0,
    instructions: '',
  });
  const [amenities, setAmenities] = useState<string[]>([]);
  const [defaultLaundryBag, setDefaultLaundryBag] = useState<Array<{label: string; qty: number}>>([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [icalUrls, setIcalUrls] = useState<Array<{url: string; source: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (apartment) {
      setFormData({
        name: apartment.name,
        address: apartment.address,
        description: apartment.description || '',
        surface: apartment.surface,
        nombreChambres: apartment.nombreChambres,
        nombreSallesDeBains: apartment.nombreSallesDeBains,
        cleaningPrice: apartment.cleaningPrice || 0,
        instructions: apartment.instructions || '',
      });
      setAmenities(apartment.amenities || []);
      setExistingPhotos(apartment.photos || []);
      setDefaultLaundryBag(apartment.defaultLaundryBag || []);
      setIcalUrls(apartment.icalUrls?.map(ical => ({
        url: ical.url,
        source: ical.source
      })) || []);
    }
  }, [apartment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      
      // Add form fields
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value.toString());
      });
      
      // Add amenities
      formDataToSend.append('amenities', JSON.stringify(amenities));
      
      // Add default laundry bag
      formDataToSend.append('defaultLaundryBag', JSON.stringify(defaultLaundryBag));
      
      // Add existing photos
      formDataToSend.append('existingPhotos', JSON.stringify(existingPhotos));
      
      // Add new photos
      photos.forEach(photo => {
        formDataToSend.append('photos', photo);
      });

      let response;
      if (apartment) {
        response = await axios.put(`/apartments/${apartment._id}`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        response = await axios.post('/apartments', formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Add iCal URLs
      if (icalUrls.length > 0) {
        for (const icalUrl of icalUrls) {
          await axios.post(`/apartments/${response.data._id}/ical`, icalUrl);
        }
      }

      onClose();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'surface' || name === 'nombreChambres' || name === 'nombreSallesDeBains' 
        ? parseFloat(value) || 0 
        : value,
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files);
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const addAmenity = () => {
    if (newAmenity.trim() && !amenities.includes(newAmenity.trim())) {
      setAmenities(prev => [...prev, newAmenity.trim()]);
      setNewAmenity('');
    }
  };

  const removeAmenity = (index: number) => {
    setAmenities(prev => prev.filter((_, i) => i !== index));
  };

  const addIcalUrl = () => {
    setIcalUrls(prev => [...prev, { url: '', source: '' }]);
  };

  const updateIcalUrl = (index: number, field: string, value: string) => {
    setIcalUrls(prev => prev.map((ical, i) => 
      i === index ? { ...ical, [field]: value } : ical
    ));
  };

  const removeIcalUrl = (index: number) => {
    setIcalUrls(prev => prev.filter((_, i) => i !== index));
  };

  const addLaundryItem = () => {
    setDefaultLaundryBag(prev => [...prev, { label: '', qty: 1 }]);
  };

  const updateLaundryItem = (index: number, field: string, value: string | number) => {
    setDefaultLaundryBag(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeLaundryItem = (index: number) => {
    setDefaultLaundryBag(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {apartment ? 'Modifier l\'appartement' : 'Nouvel appartement'}
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
                Nom de l'appartement
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Surface (m²)
              </label>
              <input
                type="number"
                name="surface"
                value={formData.surface}
                onChange={handleInputChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de chambres
              </label>
              <input
                type="number"
                name="nombreChambres"
                value={formData.nombreChambres}
                onChange={handleInputChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de salles de bains
              </label>
              <input
                type="number"
                name="nombreSallesDeBains"
                value={formData.nombreSallesDeBains}
                onChange={handleInputChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Équipements
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                placeholder="Ajouter un équipement"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addAmenity}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {amenities.map((amenity, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {amenity}
                  <button
                    type="button"
                    onClick={() => removeAmenity(index)}
                    className="ml-1 text-red-600 hover:text-red-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos
            </label>
            
            {/* Existing Photos */}
            {existingPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                {existingPhotos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={`http://localhost:5000${photo}`}
                      alt="Photo existante"
                      className="w-full h-24 object-cover rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingPhoto(index)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New Photos */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt="Nouvelle photo"
                      className="w-full h-24 object-cover rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  Cliquez pour ajouter des photos
                </p>
              </label>
            </div>
          </div>

          {/* iCal URLs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URLs iCal (Synchronisation des réservations)
            </label>
            <div className="space-y-3">
              {icalUrls.map((ical, index) => (
                <div key={index} className="flex space-x-2">
                  <input
                    type="url"
                    value={ical.url}
                    onChange={(e) => updateIcalUrl(index, 'url', e.target.value)}
                    placeholder="URL iCal"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={ical.source}
                    onChange={(e) => updateIcalUrl(index, 'source', e.target.value)}
                    placeholder="Source (ex: Airbnb)"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeIcalUrl(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addIcalUrl}
              className="mt-2 inline-flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md"
            >
              <Link className="h-4 w-4 mr-1" />
              Ajouter une URL iCal
            </button>
          </div>

          {/* Default Laundry Bag */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sac de linge par défaut
            </label>
            <div className="space-y-3">
              {defaultLaundryBag.map((item, index) => (
                <div key={index} className="flex space-x-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateLaundryItem(index, 'label', e.target.value)}
                    placeholder="Article (ex: Draps, Serviettes...)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => updateLaundryItem(index, 'qty', parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeLaundryItem(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLaundryItem}
              className="mt-2 inline-flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter un article
            </button>
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

export default ApartmentModal;