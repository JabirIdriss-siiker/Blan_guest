import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Home, Calendar, Users, Settings, Building, Activity, LogOut, UserCheck } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { user, logout } = useAuth();  // on récupère logout ici

  const getNavItems = () => {
    const items = [
      { id: 'dashboard', name: 'Tableau de bord', icon: Home },
      { id: 'missions', name: 'Missions', icon: Calendar },
    ];

    if (user?.role === 'Admin' || user?.role === 'Manager') {
      items.push(
        { id: 'apartments', name: 'Appartements', icon: Building },
        { id: 'crm', name: 'CRM', icon: UserCheck },
        { id: 'users', name: 'Utilisateurs', icon: Users },
        { id: 'activity', name: 'Activité', icon: Activity },
        { id: 'settings', name: 'Paramètres', icon: Settings }
      );
    }

    return items;
  };

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg h-screen border-r">
      <div className="p-4 border-b">
        <div className="flex items-center">
          <Calendar className="h-8 w-8 text-blue-600" />
          <span className="ml-2 text-xl font-bold text-gray-900">
            CleanManager
          </span>
        </div>
      </div>
      
      <nav className="flex-1 mt-4 overflow-y-auto">
        <div className="px-2 space-y-1">
          {getNavItems().map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                activeTab === item.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 ${
                  activeTab === item.id ? 'text-blue-500' : 'text-gray-400'
                }`}
              />
              {item.name}
            </button>
          ))}
        </div>
      </nav>

      {/* Section Déconnexion */}
      <div className="p-4 border-t">
        <button
          onClick={logout}
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors duration-200"
        >
          <LogOut className="mr-3 h-5 w-5 text-gray-400" />
          Déconnexion
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
