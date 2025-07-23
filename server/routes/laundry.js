const express = require('express');
const LaundryTask = require('../models/LaundryTask');
const Apartment = require('../models/Apartment');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const { createLaundryTasksForNewMissions } = require('../services/laundryService');
const { limitToManagedApartments, canAccessApartment, applyApartmentFilter } = require('../middleware/apartmentFilter');

const router = express.Router();

// GET /api/laundry - Get all laundry tasks with filters
router.get('/', auth, limitToManagedApartments, async (req, res) => {
  try {
    const { status, apartment, assignedTo, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    const filter = {};

    // Apply filters
    if (status) filter.status = status;
    if (apartment) filter.apartment = apartment;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Date range filter
    if (dateFrom || dateTo) {
      filter.scheduledAt = {};
      if (dateFrom) filter.scheduledAt.$gte = new Date(dateFrom);
      if (dateTo) filter.scheduledAt.$lte = new Date(dateTo);
    }

    // If user is Blanchisserie staff, only show their tasks
    if (req.user.role === 'Blanchisserie' || req.user.role ==="Staff de ménage") {
      filter.assignedTo = req.user.id;
    }

    // Appliquer le filtre d'appartements pour les Managers
    const finalFilter = applyApartmentFilter(req, filter);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await LaundryTask.countDocuments(finalFilter);

    const tasks = await LaundryTask.find(finalFilter)
      .populate('apartment', 'name address')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching laundry tasks:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des tâches de blanchisserie' });
  }
});

// GET /api/laundry/stats - Get laundry statistics
router.get('/stats', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const stats = await LaundryTask.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      aPreparer: 0,
      prepare: 0,
      probleme: 0,
    };

    stats.forEach(stat => {
      result.total += stat.count;
      switch (stat._id) {
        case 'À préparer':
          result.aPreparer = stat.count;
          break;
        case 'Préparé':
          result.prepare = stat.count;
          break;
        case 'Problème':
          result.probleme = stat.count;
          break;
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching laundry stats:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
  }
});

// GET /api/laundry/:id - Get laundry task by ID
router.get('/:id', auth, limitToManagedApartments, async (req, res) => {
  try {
    const task = await LaundryTask.findById(req.params.id)
      .populate('apartment')
      .populate('assignedTo', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName');

    if (!task) {
      return res.status(404).json({ message: 'Tâche de blanchisserie non trouvée' });
    }

    // Vérifier l'accès pour les Managers
    if (!canAccessApartment(req, task.apartment._id)) {
      return res.status(403).json({ message: 'Accès refusé à cette tâche' });
    }

    // Check if user has access to this task
    if (req.user.role === 'Blanchisserie' && task.assignedTo._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching laundry task:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la tâche' });
  }
});

// POST /api/laundry - Create new laundry task
router.post('/', auth, authorize('Admin', 'Manager'), limitToManagedApartments, async (req, res) => {
  try {
    const {
      apartment,
      scheduledAt,
      items,
      assignedTo,
      notes,
    } = req.body;

    // Validate required fields
    if (!apartment || !scheduledAt || !items || !assignedTo) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }

    // Vérifier que le Manager peut accéder à cet appartement
    if (!canAccessApartment(req, apartment)) {
      return res.status(403).json({ message: 'Accès refusé à cet appartement' });
    }

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Au moins un article doit être spécifié' });
    }

    // Check if apartment exists
    const apartmentExists = await Apartment.findById(apartment);
    if (!apartmentExists || !apartmentExists.isActive) {
      return res.status(400).json({ message: 'Appartement non trouvé' });
    }

    // Check if assigned user exists and is Blanchisserie staff
    const assignedUser = await User.findById(assignedTo);
   if (
  !assignedUser || !assignedUser.isActive || !['Blanchisserie', 'Staff de ménage'].includes(assignedUser.role)  ) 
  {
  return res.status(400).json({ message: 'Aucun personnel valide trouvé (blanchisserie ou ménage).' });
}

    const task = new LaundryTask({
      apartment,
      scheduledAt: new Date(scheduledAt),
      items: items.map(item => ({
        label: item.label.trim(),
        qty: parseInt(item.qty) || 1,
      })),
      assignedTo,
      notes: notes?.trim() || '',
      autoGenerated: false,
      createdBy: req.user.id,
    });

    await task.save();
    await task.populate('apartment', 'name address');
    await task.populate('assignedTo', 'firstName lastName email');
    await task.populate('createdBy', 'firstName lastName');

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating laundry task:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la création de la tâche' });
  }
});

// PUT /api/laundry/:id - Update laundry task
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await LaundryTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Tâche de blanchisserie non trouvée' });
    }

    // Check permissions
    const canEdit = req.user.role === 'Admin' || 
                   req.user.role === 'Manager' || 
                   (req.user.role === 'Blanchisserie' && task.assignedTo.toString() === req.user.id);

    if (!canEdit) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    let updateData = { ...req.body };

    // If user is Blanchisserie staff, only allow status updates
    if (req.user.role === 'Blanchisserie') {
      updateData = { status: req.body.status };
    }

    // Validate status change
    if (updateData.status && !['À préparer', 'Préparé', 'Problème'].includes(updateData.status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }

    const updatedTask = await LaundryTask.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('apartment', 'name address')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating laundry task:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la tâche' });
  }
});

// DELETE /api/laundry/:id - Delete laundry task
router.delete('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const task = await LaundryTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Tâche de blanchisserie non trouvée' });
    }

    await LaundryTask.findByIdAndDelete(req.params.id);

    res.json({ message: 'Tâche de blanchisserie supprimée avec succès' });
  } catch (error) {
    console.error('Error deleting laundry task:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la tâche' });
  }
});

// POST /api/laundry/auto - Manual trigger for automatic laundry task creation
router.post('/auto', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const results = await createLaundryTasksForNewMissions();
    
    const successful = results.filter(r => r.success && r.created).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = results.filter(r => r.success && !r.created).length;

    res.json({
      message: 'Traitement des tâches de blanchisserie automatiques terminé',
      summary: {
        processed: results.length,
        successful,
        failed,
        skipped,
      },
      details: results,
    });
  } catch (error) {
    console.error('Error creating automatic laundry tasks:', error);
    res.status(500).json({ message: 'Erreur lors de la création des tâches automatiques' });
  }
});

module.exports = router;