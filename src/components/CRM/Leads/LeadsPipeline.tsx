import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, User, Building, Euro, RefreshCw, Edit } from 'lucide-react';
import LeadModal from './LeadModal';

interface Lead {
  _id: string;
  title: string;
  status: 'Prospect' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';
  source: string;
  value: number;
  probability: number;
  client: {
    _id: string;
    name: string;
    company: string;
  };
  assignedTo: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

interface Pipeline {
  Prospect: Lead[];
  Qualified: Lead[];
  Proposal: Lead[];
  Negotiation: Lead[];
  Won: Lead[];
  Lost: Lead[];
}

const LeadsPipeline: React.FC = () => {
  const [pipeline, setPipeline] = useState<Pipeline>({
    Prospect: [],
    Qualified: [],
    Proposal: [],
    Negotiation: [],
    Won: [],
    Lost: [],
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPipeline();
  }, []);

  const loadPipeline = async () => {
    try {
      setError('');
      const response = await axios.get('/crm/leads/pipeline');
      setPipeline(response.data);
    } catch (error: any) {
      console.error('Erreur lors du chargement du pipeline:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement du pipeline');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await axios.put(`/crm/leads/${leadId}/status`, { status: newStatus });
      await loadPipeline();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour du statut');
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

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedLead(null);
    loadPipeline();
  };

  const getColumnColor = (status: string) => {
    switch (status) {
      case 'Prospect':
        return 'border-gray-300 bg-gray-50';
      case 'Qualified':
        return 'border-blue-300 bg-blue-50';
      case 'Proposal':
        return 'border-yellow-300 bg-yellow-50';
      case 'Negotiation':
        return 'border-orange-300 bg-orange-50';
      case 'Won':
        return 'border-green-300 bg-green-50';
      case 'Lost':
        return 'border-red-300 bg-red-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Prospect':
        return 'Prospects';
      case 'Qualified':
        return 'Qualifiés';
      case 'Proposal':
        return 'Propositions';
      case 'Negotiation':
        return 'Négociations';
      case 'Won':
        return 'Gagnés';
      case 'Lost':
        return 'Perdus';
      default:
        return status;
    }
  };

  const calculateColumnValue = (leads: Lead[]) => {
    return leads.reduce((total, lead) => total + lead.value, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
          <h2 className="text-xl font-semibold text-gray-900">Pipeline des ventes</h2>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={loadPipeline}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors duration-200"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              onClick={handleCreate}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nouveau lead
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Pipeline Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto">
        {Object.entries(pipeline).map(([status, leads]) => (
          <div
            key={status}
            className={`rounded-lg border-2 ${getColumnColor(status)} min-h-[400px] sm:min-h-[500px] min-w-[280px] xl:min-w-0`}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                {getStatusLabel(status)}
              </h3>
              <div className="text-sm text-gray-600 mt-1">
                {leads.length} lead(s)
              </div>
              {calculateColumnValue(leads) > 0 && (
                <div className="text-sm font-medium text-gray-900 mt-1">
                  {calculateColumnValue(leads).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </div>
              )}
            </div>

            {/* Column Content */}
            <div className="p-2 space-y-2">
              {leads.map((lead) => (
                <div
                  key={lead._id}
                  className="bg-white rounded-lg p-3 shadow-sm border hover:shadow-md transition-shadow duration-200 cursor-pointer"
                  onClick={() => handleEdit(lead)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-2">
                      {lead.title}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(lead);
                      }}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center text-xs text-gray-600">
                      <User className="h-3 w-3 mr-1" />
                      <span className="truncate">{lead.client.name}</span>
                    </div>

                    {lead.client.company && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Building className="h-3 w-3 mr-1" />
                        <span className="truncate">{lead.client.company}</span>
                      </div>
                    )}

                    {lead.value > 0 && (
                      <div className="flex items-center text-xs font-medium text-gray-900">
                        <Euro className="h-3 w-3 mr-1" />
                        {lead.value.toLocaleString('fr-FR')}
                      </div>
                    )}

                    {lead.assignedTo && (
                      <div className="text-xs text-gray-500">
                        Assigné à: {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                      </div>
                    )}

                    <div className="text-xs text-gray-500">
                      Source: {lead.source}
                    </div>

                    {lead.probability > 0 && lead.probability < 100 && (
                      <div className="text-xs text-gray-500">
                        Probabilité: {lead.probability}%
                      </div>
                    )}
                  </div>

                  {/* Status Change Buttons */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {status !== 'Won' && status !== 'Lost' && (
                      <>
                        {status !== 'Qualified' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(lead._id, 'Qualified');
                            }}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors duration-200 whitespace-nowrap"
                          >
                            Qualifier
                          </button>
                        )}
                        {status !== 'Proposal' && status !== 'Prospect' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(lead._id, 'Proposal');
                            }}
                            className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors duration-200 whitespace-nowrap"
                          >
                            Proposer
                          </button>
                        )}
                        {(status === 'Proposal' || status === 'Negotiation') && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(lead._id, 'Won');
                              }}
                              className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors duration-200 whitespace-nowrap"
                            >
                              Gagner
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(lead._id, 'Lost');
                              }}
                              className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors duration-200 whitespace-nowrap"
                            >
                              Perdre
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {leads.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Aucun lead
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <LeadModal
          lead={selectedLead}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default LeadsPipeline;