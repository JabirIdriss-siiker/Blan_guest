const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Mission = require('../models/Mission');
const Apartment = require('../models/Apartment');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { auth, authorize } = require('../middleware/auth');
const { sendMissionNotification } = require('../services/emailService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/missions');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// GET /api/missions - Get all missions with filters
router.get('/', auth, async (req, res) => {
  try {
    const { status, apartment, assignedTo, priority, dateFrom, dateTo } = req.query;
    const filter = {};

    // Apply filters
    if (status) filter.status = status;
    if (apartment) filter.apartment = apartment;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (priority) filter.priority = priority;

    // Date range filter
    if (dateFrom || dateTo) {
      filter.dateDebut = {};
      if (dateFrom) filter.dateDebut.$gte = new Date(dateFrom);
      if (dateTo) filter.dateDebut.$lte = new Date(dateTo);
    }

    // If user is staff, only show their missions
    if (req.user.role === 'Staff de ménage') {
      filter.assignedTo = req.user.id;
    }

    const missions = await Mission.find(filter)
      .populate('apartment', 'name address photos')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(missions);
  } catch (error) {
    console.error('Error fetching missions:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des missions' });
  }
});

// GET /api/missions/:id - Get mission by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id)
      .populate('apartment')
      .populate('assignedTo', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName');

    if (!mission) {
      return res.status(404).json({ message: 'Mission non trouvée' });
    }

    // Check if user has access to this mission
    if (req.user.role === 'Staff de ménage' && mission.assignedTo._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    res.json(mission);
  } catch (error) {
    console.error('Error fetching mission:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la mission' });
  }
});

// POST /api/missions - Create new mission
router.post('/', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const {
      apartment,
      assignedTo,
      title,
      description,
      dateDebut,
      dateFin,
      priority,
      checklist,
      instructions,
      estimatedDuration,
      cleaningPrice,
    } = req.body;

    // Validate required fields
    if (!apartment || !assignedTo || !title || !dateDebut || !dateFin) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }

    // Validate dates
    const startDate = new Date(dateDebut);
    const endDate = new Date(dateFin);
    if (startDate >= endDate) {
      return res.status(400).json({ message: 'La date de fin doit être après la date de début' });
    }

    // Check if apartment exists
    const apartmentExists = await Apartment.findById(apartment);
    if (!apartmentExists || !apartmentExists.isActive) {
      return res.status(400).json({ message: 'Appartement non trouvé' });
    }

    // Check if assigned user exists and is staff
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser || !assignedUser.isActive) {
      return res.status(400).json({ message: 'Utilisateur assigné non trouvé' });
    }

    const mission = new Mission({
      apartment,
      assignedTo,
      createdBy: req.user.id,
      title: title.trim(),
      description: description?.trim() || '',
      dateDebut: startDate,
      dateFin: endDate,
      priority: priority || 'Normale',
      checklist: checklist || [],
      instructions: instructions?.trim() || '',
      estimatedDuration: estimatedDuration || 60,
      cleaningPrice: parseFloat(cleaningPrice) || 0,
    });

    await mission.save();
    await mission.populate('apartment', 'name address');
    await mission.populate('assignedTo', 'firstName lastName email');
    await mission.populate('createdBy', 'firstName lastName');

    // Send notification email
    try {
      await sendMissionNotification(mission);
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email:', emailError);
    }

    // Log activity
    await new ActivityLog({
      user: req.user.id,
      action: 'Mission créée',
      entityType: 'Mission',
      entityId: mission._id,
      details: `Mission "${title}" assignée à ${mission.assignedTo.firstName} ${mission.assignedTo.lastName}`,
    }).save();

    res.status(201).json(mission);
  } catch (error) {
    console.error('Error creating mission:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la création de la mission' });
  }
});

// PUT /api/missions/:id - Update mission
router.put('/:id', auth, async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);
    
    if (!mission) {
      return res.status(404).json({ message: 'Mission non trouvée' });
    }

    // Check permissions
    const canEdit = req.user.role === 'Admin' || 
                   req.user.role === 'Manager' || 
                   (req.user.role === 'Staff de ménage' && mission.assignedTo.toString() === req.user.id);

    if (!canEdit) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const updateData = { ...req.body };
    
    // Handle status changes
    if (updateData.status) {
      if (updateData.status === 'En cours' && !mission.timeStarted) {
        updateData.timeStarted = new Date();
      } else if (updateData.status === 'Terminé' && !mission.timeCompleted) {
        updateData.timeCompleted = new Date();
        if (mission.timeStarted) {
          updateData.actualDuration = Math.round((new Date() - mission.timeStarted) / 60000);
        }
      }
    }

    // Handle dates
    /*  if (updateData.dateDebut) {
      updateData.dateDebut = new Date(updateData.dateDebut);
      if (updateData.dateFin && updateData.dateDebut >= new Date(updateData.dateFin)) {
        return res.status(400).json({ message: 'La date de fin doit être après la date de début' });
      }
    }
    if (updateData.dateFin) {
      updateData.dateFin = new Date(updateData.dateFin);
      if (updateData.dateDebut && new Date(updateData.dateDebut) >= updateData.dateFin) {
        return res.status(400).json({ message: 'La date de fin doit être après la date de début' });
      }
    }*/

    const updatedMission = await Mission.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('apartment', 'name address')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');

    // Log activity
    await new ActivityLog({
      user: req.user.id,
      action: 'Mission mise à jour',
      entityType: 'Mission',
      entityId: mission._id,
      details: `Mission "${updatedMission.title}" mise à jour`,
      metadata: updateData,
    }).save();

    res.json(updatedMission);
  } catch (error) {
    console.error('Error updating mission:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la mission' });
  }
});

// DELETE /api/missions/:id - Delete mission
router.delete('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);
    
    if (!mission) {
      return res.status(404).json({ message: 'Mission non trouvée' });
    }

    // Don't allow deletion of completed missions
    if (mission.status === 'Terminé') {
      return res.status(400).json({ message: 'Impossible de supprimer une mission terminée' });
    }

    await Mission.findByIdAndDelete(req.params.id);

    // Log activity
    await new ActivityLog({
      user: req.user.id,
      action: 'Mission supprimée',
      entityType: 'Mission',
      entityId: mission._id,
      details: `Mission "${mission.title}" supprimée`,
    }).save();

    res.json({ message: 'Mission supprimée avec succès' });
  } catch (error) {
    console.error('Error deleting mission:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la mission' });
  }
});

// POST /api/missions/:id/photos - Upload photos for mission
router.post('/:id/photos', auth, upload.array('photos', 10), async (req, res) => {
  try {
    const { type } = req.body; // 'avant' or 'apres'
    const mission = await Mission.findById(req.params.id);
    
    if (!mission) {
      return res.status(404).json({ message: 'Mission non trouvée' });
    }

    // Check permissions
    const canUpload = req.user.role === 'Admin' || 
                     req.user.role === 'Manager' || 
                     (req.user.role === 'Staff de ménage' && mission.assignedTo.toString() === req.user.id);

    if (!canUpload) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Aucune photo fournie' });
    }

    const photos = req.files.map(file => `/uploads/missions/${file.filename}`);

    if (type === 'avant') {
      mission.photosAvant = [...mission.photosAvant, ...photos];
    } else if (type === 'apres') {
      mission.photosApres = [...mission.photosApres, ...photos];
    } else {
      return res.status(400).json({ message: 'Type de photo invalide' });
    }

    await mission.save();

    res.json(mission);
  } catch (error) {
    console.error('Error uploading photos:', error);
    res.status(500).json({ message: 'Erreur lors du téléchargement des photos' });
  }
});

// POST /api/missions/:id/documents - Upload documents for mission
router.post('/:id/documents', auth, upload.array('documents', 5), async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);
    
    if (!mission) {
      return res.status(404).json({ message: 'Mission non trouvée' });
    }

    // Check permissions
    const canUpload = req.user.role === 'Admin' || 
                     req.user.role === 'Manager' || 
                     (req.user.role === 'Staff de ménage' && mission.assignedTo.toString() === req.user.id);

    if (!canUpload) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Aucun document fourni' });
    }

    const documents = req.files.map(file => ({
      filename: `/uploads/missions/${file.filename}`,
      originalName: file.originalname,
    }));

    mission.documents = [...mission.documents, ...documents];
    await mission.save();

    res.json(mission);
  } catch (error) {
    console.error('Error uploading documents:', error);
    res.status(500).json({ message: 'Erreur lors du téléchargement des documents' });
  }
});

// PUT /api/missions/:id/checklist/:itemId - Update checklist item
router.put('/:id/checklist/:itemId', auth, async (req, res) => {
  try {
    const { completed } = req.body;
    const mission = await Mission.findById(req.params.id);
    
    if (!mission) {
      return res.status(404).json({ message: 'Mission non trouvée' });
    }

    // Check permissions
    const canUpdate = req.user.role === 'Admin' || 
                     req.user.role === 'Manager' || 
                     (req.user.role === 'Staff de ménage' && mission.assignedTo.toString() === req.user.id);

    if (!canUpdate) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const checklistItem = mission.checklist.id(req.params.itemId);
    if (!checklistItem) {
      return res.status(404).json({ message: 'Élément de checklist non trouvé' });
    }

    checklistItem.completed = completed;
    if (completed) {
      checklistItem.completedAt = new Date();
    } else {
      checklistItem.completedAt = undefined;
    }

    await mission.save();

    res.json(mission);
  } catch (error) {
    console.error('Error updating checklist:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la checklist' });
  }
});

module.exports = router;