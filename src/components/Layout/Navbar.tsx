import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, User, Home, Calendar, Users, Settings } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  const getNavItems = () => {
    const items = [
      { name: 'Tableau de bord', href: '/dashboard', icon: Home },
      { name: 'Missions', href: '/missions', icon: Calendar },
    ];

    if (user?.role === 'Admin' || user?.role === 'Manager') {
      items.push(
        { name: 'Appartements', href: '/apartments', icon: Home },
        { name: 'Utilisateurs', href: '/users', icon: Users },
        { name: 'Paramètres', href: '/settings', icon: Settings }
      );
    }

    return items;
  };

  return (
    <nav className="bg-white shadow-lg border-b">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                CleanManager
              </span>
            </div>
            
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {getNavItems().map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors duration-200"
                >
                  <item.icon className="h-4 w-4 mr-1" />
                  {item.name}
                </a>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-700">
              <User className="h-4 w-4 mr-1" />
              <span>{user?.firstName} {user?.lastName}</span>
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {user?.role}
              </span>
            </div>
            
            <button
              onClick={logout}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;