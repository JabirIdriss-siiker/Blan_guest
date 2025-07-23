const User = require('../models/User');

// Middleware pour limiter l'accès des Managers à leurs appartements assignés
const limitToManagedApartments = async (req, res, next) => {
  try {
    // Seuls les Managers sont restreints
    if (req.user.role !== 'Manager') {
      return next();
    }

    // Récupérer les appartements gérés par ce Manager
    const user = await User.findById(req.user.id).select('managedApartments');
    
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }

    // Si managedApartments est vide, le Manager n'a accès à rien
    if (!user.managedApartments || user.managedApartments.length === 0) {
      req.managedApartments = [];
    } else {
      req.managedApartments = user.managedApartments.map(id => id.toString());
    }

    next();
  } catch (error) {
    console.error('Erreur middleware apartmentFilter:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};

// Fonction helper pour vérifier si un Manager peut accéder à un appartement
const canAccessApartment = (req, apartmentId) => {
  if (req.user.role === 'Admin') return true;
  if (req.user.role === 'Staff de ménage') return true;
  if (req.user.role === 'Blanchisserie') return true;
  
  if (req.user.role === 'Manager') {
    if (!req.managedApartments) return false;
    return req.managedApartments.includes(apartmentId.toString());
  }
  
  return false;
};

// Fonction helper pour appliquer le filtre d'appartements
const applyApartmentFilter = (req, baseFilter = {}) => {
  if (req.user.role === 'Manager' && req.managedApartments) {
    if (req.managedApartments.length === 0) {
      // Manager sans appartements assignés = aucun accès
      return { ...baseFilter, apartment: { $in: [] } };
    }
    return { ...baseFilter, apartment: { $in: req.managedApartments } };
  }
  return baseFilter;
};

module.exports = {
  limitToManagedApartments,
  canAccessApartment,
  applyApartmentFilter,
};