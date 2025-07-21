import React from 'react';
import { X, User, Calendar, FileText, Euro, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  status: string;
  notes?: string;
  createdBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  sentAt?: string;
  paidAt?: string;
}

interface InvoiceDetailModalProps {
  invoice: Invoice;
  onClose: () => void;
}

const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, onClose }) => {
  const getStatusColor = (status: string) => {
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b print:hidden">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Détails de la facture
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200"
              >
                Imprimer
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 print:p-8">
          {/* Invoice Header */}
          <div className="mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">FACTURE</h1>
                <p className="text-xl text-gray-600">{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                  {invoice.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Staff Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Personnel
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900">
                    {invoice.staff.firstName} {invoice.staff.lastName}
                  </p>
                  <p className="text-gray-600">{invoice.staff.email}</p>
                </div>
              </div>

              {/* Period Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Période
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-900">
                    Du {format(new Date(invoice.period.startDate), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                  <p className="text-gray-900">
                    Au {format(new Date(invoice.period.endDate), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Missions Table */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Missions ({invoice.missions.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Mission
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Appartement
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Prix
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.missions.map((mission, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm text-gray-900 border-b">
                        {mission.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 border-b">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                          {mission.apartment}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 border-b">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-gray-400" />
                          {format(new Date(mission.dateCompleted), 'dd MMM yyyy', { locale: fr })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right border-b font-medium">
                        {mission.price.toFixed(2)}€
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-900 text-right border-t">
                      Total:
                    </td>
                    <td className="px-4 py-3 text-lg font-bold text-gray-900 text-right border-t">
                      <div className="flex items-center justify-end">
                        <Euro className="h-5 w-5 mr-1" />
                        {invoice.totalAmount.toFixed(2)}€
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">{invoice.notes}</p>
              </div>
            </div>
          )}

          {/* Invoice Dates */}
          <div className="border-t pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <strong>Créée le:</strong> {format(new Date(invoice.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                <br />
                <strong>Par:</strong> {invoice.createdBy.firstName} {invoice.createdBy.lastName}
              </div>
              {invoice.sentAt && (
                <div>
                  <strong>Envoyée le:</strong> {format(new Date(invoice.sentAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </div>
              )}
              {invoice.paidAt && (
                <div>
                  <strong>Payée le:</strong> {format(new Date(invoice.paidAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailModal;