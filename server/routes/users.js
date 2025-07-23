const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Mission = require('../models/Mission');
const Apartment = require('../models/Apartment');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - Get all users (Admin/Manager only)
router.get('/', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { role, isActive } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    // Add mission counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        if (user.role === 'Staff de ménage') {
          const missionCounts = await Mission.aggregate([
            { $match: { assignedTo: user._id } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ]);

          const stats = {
            total: 0,
            enAttente: 0,
            enCours: 0,
            termine: 0,
            probleme: 0
          };

          missionCounts.forEach(item => {
            stats.total += item.count;
            switch (item._id) {
              case 'En attente':
                stats.enAttente = item.count;
                break;
              case 'En cours':
                stats.enCours = item.count;
                break;
              case 'Terminé':
                stats.termine = item.count;
                break;
              case 'Problème':
                stats.probleme = item.count;
                break;
            }
          });

          return {
            ...user.toObject(),
            missionStats: stats
          };
        } else if (user.role === 'Manager') {
          // Ajouter les appartements gérés pour les Managers
          const managedApartments = await Apartment.find({
            _id: { $in: user.managedApartments || [] },
            isActive: true
          }).select('name address');
          
          return {
            ...user.toObject(),
            managedApartments
          };
        }
        return user.toObject();
      })
    );

    res.json(usersWithStats);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// GET /api/users/staff - Get staff members only
router.get('/staff', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const staff = await User.find({ 
      role: 'Staff de ménage', 
      isActive: true 
    })
      .select('-password')
      .sort({ firstName: 1 });

    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du personnel' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Check if user can access this profile
    const canAccess = req.user.role === 'Admin' || 
                     req.user.role === 'Manager' || 
                     req.user.id === req.params.id;

    if (!canAccess) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    // Add mission stats for staff members
    if (user.role === 'Staff de ménage') {
      const missionCounts = await Mission.aggregate([
        { $match: { assignedTo: user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const recentMissions = await Mission.find({ assignedTo: user._id })
        .populate('apartment', 'name address')
        .sort({ createdAt: -1 })
        .limit(5);

      const stats = {
        total: 0,
        enAttente: 0,
        enCours: 0,
        termine: 0,
        probleme: 0
      };

      missionCounts.forEach(item => {
        stats.total += item.count;
        switch (item._id) {
          case 'En attente':
            stats.enAttente = item.count;
            break;
          case 'En cours':
            stats.enCours = item.count;
            break;
          case 'Terminé':
            stats.termine = item.count;
            break;
          case 'Problème':
            stats.probleme = item.count;
            break;
        }
      });

      res.json({
        ...user.toObject(),
        missionStats: stats,
        recentMissions
      });
    } else {
      // Ajouter les appartements gérés pour les Managers
      if (user.role === 'Manager') {
        const managedApartments = await Apartment.find({
          _id: { $in: user.managedApartments || [] },
          isActive: true
        }).select('name address');
        
        res.json({
          ...user.toObject(),
          managedApartments
        });
      } else {
        res.json(user);
      }
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'utilisateur' });
  }
});

// POST /api/users - Create new user (Admin only)
router.post('/', auth, authorize('Admin'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Validate role
    const validRoles = ['Admin', 'Staff de ménage', 'Manager','Blanchisserie'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }

    const user = new User({
      email: email.toLowerCase().trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      phone: phone?.trim() || '',
    });

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role, password } = req.body;
    
    // Check permissions
    const canEdit = req.user.role === 'Admin' || 
                   (req.user.id === req.params.id && !role); // Users can edit their own profile but not role

    if (!canEdit) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const updateData = {};
    
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (email) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: req.params.id } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé' });
      }
      updateData.email = email.toLowerCase().trim();
    }
    if (phone !== undefined) updateData.phone = phone.trim();
    
    // Only admins can change roles
    if (req.user.role === 'Admin' && role) {
      const validRoles = ['Admin', 'Staff de ménage', 'Manager', 'Blanchisserie'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Rôle invalide' });
      }
      updateData.role = role;
    }

    // Only admins can manage apartment assignments for Managers
    if (req.user.role === 'Admin' && req.body.managedApartments !== undefined) {
      updateData.managedApartments = req.body.managedApartments;
    }

    // Handle password update
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
      }
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'utilisateur' });
  }
});

// DELETE /api/users/:id - Deactivate user (Admin only)
router.delete('/:id', auth, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Don't allow deactivating the last admin
    if (user.role === 'Admin') {
      const adminCount = await User.countDocuments({ role: 'Admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Impossible de désactiver le dernier administrateur' });
      }
    }

    // Check for active missions if it's a staff member
    if (user.role === 'Staff de ménage') {
      const activeMissions = await Mission.countDocuments({
        assignedTo: user._id,
        status: { $in: ['En attente', 'En cours'] }
      });

      if (activeMissions > 0) {
        return res.status(400).json({ 
          message: 'Impossible de désactiver un utilisateur avec des missions actives' 
        });
      }
    }

    user.isActive = false;
    await user.save();

    res.json({ message: 'Utilisateur désactivé avec succès' });
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ message: 'Erreur lors de la désactivation de l\'utilisateur' });
  }
});

// PUT /api/users/:id/activate - Reactivate user (Admin only)
router.put('/:id/activate', auth, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json({ message: 'Utilisateur réactivé avec succès', user });
  } catch (error) {
    console.error('Error reactivating user:', error);
    res.status(500).json({ message: 'Erreur lors de la réactivation de l\'utilisateur' });
  }
});

module.exports = router;