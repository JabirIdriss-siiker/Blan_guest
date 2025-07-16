import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Target, Edit, Trash2, RefreshCw, User, Building, Euro } from 'lucide-react';
import LeadModal from './LeadModal';

interface Lead {
  _id: string;
  title: string;
  status: 'Prospect' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';
  source: string;
  value: number;
  probability: number;
  expectedCloseDate: string;
  notes: string;
  client: {
    _id: string;
    name: string;
    company: string;
    email: string;
  };
  assignedTo: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  createdBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

const LeadsList: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    loadLeads();
  }, [pagination.page, searchTerm, statusFilter, sourceFilter]);

  const loadLeads = async () => {
    try {
      setError('');
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);

      const response = await axios.get(`/crm/leads?${params}`);
      setLeads(response.data.leads);
      setPagination(response.data.pagination);
    } catch (error: any) {
      console.error('Erreur lors du chargement des leads:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement des leads');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedLead(null);
    setShowModal(true);
  };

  const handleDelete = async (leadId: string, leadTitle: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le lead "${leadTitle}" ?`)) {
      try {
        await axios.delete(`/crm/leads/${leadId}`);
        await loadLeads();
      } catch (error: any) {
        console.error('Erreur lors de la suppression:', error);
        alert(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedLead(null);
    loadLeads();
  };

  const getStatusColor = (status: Lead['status']) => {
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

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher des leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex space-x-3 ml-4">
            <button
              onClick={loadLeads}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors duration-200"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              onClick={handleCreate}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nouveau lead
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="Prospect">Prospect</option>
            <option value="Qualified">Qualifié</option>
            <option value="Proposal">Proposition</option>
            <option value="Negotiation">Négociation</option>
            <option value="Won">Gagné</option>
            <option value="Lost">Perdu</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes les sources</option>
            <option value="Website">Site web</option>
            <option value="Referral">Référence</option>
            <option value="Cold Call">Appel à froid</option>
            <option value="Email">Email</option>
            <option value="Social Media">Réseaux sociaux</option>
            <option value="Advertisement">Publicité</option>
            <option value="Other">Autre</option>
          </select>

          <div className="flex items-center text-sm text-gray-600">
            <Target className="h-4 w-4 mr-1" />
            {pagination.total} lead(s)
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Leads List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lead
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valeur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigné à
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leads.map((lead) => (
                <tr key={lead._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {lead.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        Source: {lead.source}
                      </div>
                      {lead.probability > 0 && (
                        <div className="text-sm text-gray-500">
                          Probabilité: {lead.probability}%
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 flex items-center">
                        <User className="h-4 w-4 mr-2 text-gray-400" />
                        {lead.client.name}
                      </div>
                      {lead.client.company && (
                        <div className="text-sm text-gray-500 flex items-center">
                          <Building className="h-4 w-4 mr-2 text-gray-400" />
                          {lead.client.company}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lead.value > 0 ? (
                      <div className="text-sm text-gray-900 flex items-center">
                        <Euro className="h-4 w-4 mr-1 text-gray-400" />
                        {lead.value.toLocaleString('fr-FR')}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lead.assignedTo ? (
                      <div className="text-sm text-gray-900">
                        {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Non assigné</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(lead)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Modifier"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(lead._id, lead.title)}
                        className="text-red-600 hover:text-red-900"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {leads.length === 0 && !loading && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm || statusFilter || sourceFilter 
              ? 'Aucun lead trouvé pour ces critères' 
              : 'Aucun lead trouvé'
            }
          </p>
          {!searchTerm && !statusFilter && !sourceFilter && (
            <button
              onClick={handleCreate}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Créer le premier lead
            </button>
          )}
        </div>
      )}

      {showModal && (
        <LeadModal
          lead={selectedLead}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default LeadsList;