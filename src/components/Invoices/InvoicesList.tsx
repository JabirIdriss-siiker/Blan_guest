import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Search, FileText, User, Calendar, Euro, Edit, Trash2, RefreshCw, Eye, Send, Check } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import InvoiceModal from './InvoiceModal';
import InvoiceDetailModal from './InvoiceDetailModal';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  staff: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  missions: Array<{
    mission: string;
    title: string;
    apartment: string;
    dateCompleted: string;
    price: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
  totalAmount: number;
  status: 'Brouillon' | 'Envoyée' | 'Payée' | 'Annulée';
  notes?: string;
  createdBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  sentAt?: string;
  paidAt?: string;
}

const InvoicesList: React.FC = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    loadInvoices();
  }, [pagination.page, statusFilter, staffFilter]);

  const loadInvoices = async () => {
    try {
      setError('');
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (statusFilter) params.append('status', statusFilter);
      if (staffFilter) params.append('staff', staffFilter);

      const response = await axios.get(`/invoices?${params}`);
      setInvoices(response.data.invoices);
      setPagination(response.data.pagination);
    } catch (error: any) {
      console.error('Erreur lors du chargement des factures:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement des factures');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (invoiceId: string, newStatus: string) => {
    try {
      setUpdating(invoiceId);
      await axios.put(`/invoices/${invoiceId}`, { status: newStatus });
      await loadInvoices();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setUpdating(null);
    }
  };

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailModal(true);
  };

  const handleEdit = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedInvoice(null);
    setShowModal(true);
  };

  const handleDelete = async (invoiceId: string, invoiceNumber: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la facture "${invoiceNumber}" ?`)) {
      try {
        await axios.delete(`/invoices/${invoiceId}`);
        await loadInvoices();
      } catch (error: any) {
        console.error('Erreur lors de la suppression:', error);
        alert(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedInvoice(null);
    loadInvoices();
  };

  const handleDetailModalClose = () => {
    setShowDetailModal(false);
    setSelectedInvoice(null);
  };

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'Brouillon':
        return 'bg-gray-100 text-gray-800';
      case 'Envoyée':
        return 'bg-blue-100 text-blue-800';
      case 'Payée':
        return 'bg-green-100 text-green-800';
      case 'Annulée':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canManageInvoices = user?.role === 'Admin' || user?.role === 'Manager';

  const filteredInvoices = invoices.filter(invoice =>
    !searchTerm || 
    invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.staff.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.staff.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-4 sm:space-y-0">
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher des factures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 sm:ml-4">
            <button
              onClick={loadInvoices}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors duration-200"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            {canManageInvoices && (
              <button
                onClick={handleCreate}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                <span className="hidden sm:inline">Nouvelle facture</span>
                <span className="sm:hidden">Nouvelle</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="Brouillon">Brouillon</option>
            <option value="Envoyée">Envoyée</option>
            <option value="Payée">Payée</option>
            <option value="Annulée">Annulée</option>
          </select>

          <div className="flex items-center text-sm text-gray-600 sm:col-span-2">
            <FileText className="h-4 w-4 mr-1" />
            {pagination.total} facture(s)
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Invoices List */}
      <div className="space-y-4">
        {filteredInvoices.map((invoice) => (
          <div
            key={invoice._id}
            className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-4 space-y-4 lg:space-y-0">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {invoice.invoiceNumber}
                    </h3>
                    <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-2 flex-shrink-0" />
                      {invoice.staff.firstName} {invoice.staff.lastName}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                      {format(new Date(invoice.period.startDate), 'dd MMM', { locale: fr })} - 
                      {format(new Date(invoice.period.endDate), 'dd MMM yyyy', { locale: fr })}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                      {invoice.missions.length} mission(s)
                    </div>
                    
                    <div className="flex items-center text-sm font-medium text-gray-900">
                      <Euro className="h-4 w-4 mr-2 flex-shrink-0" />
                      {invoice.totalAmount.toFixed(2)}€
                    </div>

                    {invoice.sentAt && (
                      <div className="text-sm text-gray-500">
                        Envoyée le {format(new Date(invoice.sentAt), 'dd MMM yyyy', { locale: fr })}
                      </div>
                    )}

                    {invoice.paidAt && (
                      <div className="text-sm text-green-600">
                        Payée le {format(new Date(invoice.paidAt), 'dd MMM yyyy', { locale: fr })}
                      </div>
                    )}
                  </div>

                  {invoice.notes && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600">{invoice.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-row lg:flex-col items-start lg:items-end justify-between lg:justify-start space-x-2 lg:space-x-0 lg:space-y-2 lg:ml-4">
                  {canManageInvoices && (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {invoice.status === 'Brouillon' && (
                        <button
                          onClick={() => handleStatusUpdate(invoice._id, 'Envoyée')}
                          disabled={updating === invoice._id}
                          className="px-2 sm:px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                        >
                          <Send className="h-3 w-3 mr-1 inline" />
                          {updating === invoice._id ? 'Envoi...' : 'Envoyer'}
                        </button>
                      )}
                      {invoice.status === 'Envoyée' && (
                        <button
                          onClick={() => handleStatusUpdate(invoice._id, 'Payée')}
                          disabled={updating === invoice._id}
                          className="px-2 sm:px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
                        >
                          <Check className="h-3 w-3 mr-1 inline" />
                          {updating === invoice._id ? 'Marquage...' : 'Marquer Payée'}
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleView(invoice)}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
                      title="Voir les détails"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {canManageInvoices && (
                      <>
                        <button
                          onClick={() => handleEdit(invoice)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-200"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {invoice.status === 'Brouillon' && (
                          <button
                            onClick={() => handleDelete(invoice._id, invoice.invoiceNumber)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
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

      {filteredInvoices.length === 0 && !loading && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm || statusFilter 
              ? 'Aucune facture trouvée pour ces critères' 
              : 'Aucune facture trouvée'
            }
          </p>
          {canManageInvoices && !searchTerm && !statusFilter && (
            <button
              onClick={handleCreate}
              className="mt-4 w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Créer la première facture
            </button>
          )}
        </div>
      )}

      {showModal && (
        <InvoiceModal
          invoice={selectedInvoice}
          onClose={handleModalClose}
        />
      )}

      {showDetailModal && selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={handleDetailModalClose}
        />
      )}
    </div>
  );
};

export default InvoicesList;