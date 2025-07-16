import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, User, Mail, Phone, Building, MapPin, FileText, UserCheck, Target } from 'lucide-react';

interface Client {
  _id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  notes: string;
  contacts: Array<{
    _id: string;
    name: string;
    role: string;
    email: string;
    phone: string;
    isPrimary: boolean;
  }>;
  leads: Array<{
    _id: string;
    title: string;
    status: string;
    value: number;
    assignedTo: {
      firstName: string;
      lastName: string;
    };
  }>;
  createdBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
}

const ClientDetailModal: React.FC<ClientDetailModalProps> = ({ client: initialClient, onClose }) => {
  const [client, setClient] = useState<Client>(initialClient);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClientDetails();
  }, [initialClient._id]);

  const loadClientDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/crm/clients/${initialClient._id}`);
      setClient(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: Client['address']) => {
    if (!address) return '';
    const parts = [address.street, address.city, address.state, address.zipCode, address.country];
    return parts.filter(Boolean).join(', ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Prospect':
        return 'bg-gray-100 text-gray-800';
      case 'Qualified':
        return 'bg-blue-100 text-blue-800';
      case 'Proposal':
        return 'bg-yellow-100 text-yellow-800';
      case 'Negotiation':
        return 'bg-orange-100 text-orange-800';
      case 'Won':
        return 'bg-green-100 text-green-800';
      case 'Lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Détails du client
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Client Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Informations client
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Nom</label>
                      <p className="text-sm text-gray-900">{client.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Email</label>
                      <p className="text-sm text-gray-900 flex items-center">
                        <Mail className="h-4 w-4 mr-1" />
                        {client.email}
                      </p>
                    </div>
                    {client.phone && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Téléphone</label>
                        <p className="text-sm text-gray-900 flex items-center">
                          <Phone className="h-4 w-4 mr-1" />
                          {client.phone}
                        </p>
                      </div>
                    )}
                    {client.company && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Entreprise</label>
                        <p className="text-sm text-gray-900 flex items-center">
                          <Building className="h-4 w-4 mr-1" />
                          {client.company}
                        </p>
                      </div>
                    )}
                    {formatAddress(client.address) && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-500">Adresse</label>
                        <p className="text-sm text-gray-900 flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {formatAddress(client.address)}
                        </p>
                      </div>
                    )}
                    {client.notes && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-500">Notes</label>
                        <p className="text-sm text-gray-900">{client.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contacts */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <UserCheck className="h-5 w-5 mr-2" />
                  Contacts ({client.contacts?.length || 0})
                </h3>
                {client.contacts && client.contacts.length > 0 ? (
                  <div className="space-y-3">
                    {client.contacts.map((contact) => (
                      <div key={contact._id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center">
                              <h4 className="font-medium text-gray-900">{contact.name}</h4>
                              {contact.isPrimary && (
                                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  Principal
                                </span>
                              )}
                            </div>
                            {contact.role && (
                              <p className="text-sm text-gray-600">{contact.role}</p>
                            )}
                            <div className="mt-2 space-y-1">
                              {contact.email && (
                                <p className="text-sm text-gray-600 flex items-center">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {contact.email}
                                </p>
                              )}
                              {contact.phone && (
                                <p className="text-sm text-gray-600 flex items-center">
                                  <Phone className="h-3 w-3 mr-1" />
                                  {contact.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Aucun contact</p>
                )}
              </div>

              {/* Leads */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Leads ({client.leads?.length || 0})
                </h3>
                {client.leads && client.leads.length > 0 ? (
                  <div className="space-y-3">
                    {client.leads.map((lead) => (
                      <div key={lead._id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-900">{lead.title}</h4>
                            <div className="mt-2 flex items-center space-x-4">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                                {lead.status}
                              </span>
                              {lead.value > 0 && (
                                <span className="text-sm text-gray-600">
                                  {lead.value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                </span>
                              )}
                              {lead.assignedTo && (
                                <span className="text-sm text-gray-600">
                                  Assigné à: {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Aucun lead</p>
                )}
              </div>

              {/* Meta Info */}
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500">
                  Créé par {client.createdBy.firstName} {client.createdBy.lastName} le{' '}
                  {new Date(client.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDetailModal;