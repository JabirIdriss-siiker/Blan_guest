import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Home, Calendar, Users, Settings, Building, Activity, LogOut, UserCheck, Shirt, Menu, X, FileText } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getNavItems = () => {
    const items = [
      { id: 'dashboard', name: 'Tableau de bord', icon: Home },
      { id: 'missions', name: 'Missions', icon: Calendar },
    ];

    if (user?.role === 'Admin' || user?.role === 'Manager') {
      items.push(
        { id: 'apartments', name: 'Appartements', icon: Building },
        { id: 'crm', name: 'CRM', icon: UserCheck },
        { id: 'laundry', name: 'Blanchisserie', icon: Shirt },
        { id: 'invoices', name: 'Factures', icon: FileText },
        { id: 'users', name: 'Utilisateurs', icon: Users },
        { id: 'activity', name: 'Activité', icon: Activity },
        { id: 'settings', name: 'Paramètres', icon: Settings }
      );
    } else if (user?.role === 'Blanchisserie') {
      items.push(
        { id: 'laundry', name: 'Blanchisserie', icon: Shirt }
      );
    } else if (user?.role === 'Staff de ménage') {
      items.push(
        { id: 'invoices', name: 'Mes Factures', icon: FileText }
      );
    }

    return items;
  };

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-white rounded-lg shadow-lg border"
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6 text-gray-600" />
          ) : (
            <Menu className="h-6 w-6 text-gray-600" />
          )}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40
        flex flex-col w-64 bg-white shadow-lg h-screen border-r
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">
              CleanManager
            </span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 mt-4 overflow-y-auto">
          <div className="px-2 space-y-1">
            {getNavItems().map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  activeTab === item.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 flex-shrink-0 ${
                    activeTab === item.id ? 'text-blue-500' : 'text-gray-400'
                  }`}
                />
                {item.name}
              </button>
            ))}
          </div>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t">
          <div className="mb-3 px-3 py-2 bg-gray-50 rounded-md">
            <div className="text-sm font-medium text-gray-900">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-xs text-gray-500">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors duration-200"
          >
            <LogOut className="mr-3 h-5 w-5 text-gray-400" />
            Déconnexion
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;