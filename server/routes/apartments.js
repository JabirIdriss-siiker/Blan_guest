const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Apartment = require('../models/Apartment');
const Booking = require('../models/Booking');
const Mission = require('../models/Mission');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const { limitToManagedApartments, canAccessApartment } = require('../middleware/apartmentFilter');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/apartments');
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'));
    }
  },
});

// GET /api/apartments - Get all apartments
router.get('/', auth, limitToManagedApartments, async (req, res) => {
  try {
    let filter = { isActive: true };
    
    // Appliquer le filtre pour les Managers
    if (req.user.role === 'Manager' && req.managedApartments) {
      if (req.managedApartments.length === 0) {
        return res.json([]); // Manager sans appartements assignés
      }
      filter._id = { $in: req.managedApartments };
    }
    
    const apartments = await Apartment.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Get booking data for each apartment
    const apartmentsWithBookings = await Promise.all(
      apartments.map(async (apartment) => {
        const bookings = await Booking.find({
          apartment: apartment._id,
          status: 'Confirmé',
          dateFin: { $gte: new Date() },
        }).sort({ dateDebut: 1 });

        return {
          ...apartment.toObject(),
          bookings,
        };
      })
    );

    res.json(apartmentsWithBookings);
  } catch (error) {
    console.error('Error fetching apartments:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des appartements' });
  }
});

// GET /api/apartments/:id - Get apartment by ID
router.get('/:id', auth, limitToManagedApartments, async (req, res) => {
  try {
    // Vérifier l'accès pour les Managers
    if (!canAccessApartment(req, req.params.id)) {
      return res.status(403).json({ message: 'Accès refusé à cet appartement' });
    }
    
    const apartment = await Apartment.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!apartment || !apartment.isActive) {
      return res.status(404).json({ message: 'Appartement non trouvé' });
    }

    const bookings = await Booking.find({
      apartment: apartment._id,
      status: 'Confirmé',
    }).sort({ dateDebut: 1 });

    const missions = await Mission.find({
      apartment: apartment._id,
    })
      .populate('assignedTo', 'firstName lastName')
      .sort({ dateDebut: -1 })
      .limit(10);

    res.json({
      ...apartment.toObject(),
      bookings,
      missions,
    });
  } catch (error) {
    console.error('Error fetching apartment:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'appartement' });
  }
});

// POST /api/apartments - Create new apartment
router.post('/', auth, authorize('Admin', 'Manager'), upload.array('photos', 10), async (req, res) => {
  try {
    const {
      name,
      address,
      description,
      surface,
      nombreChambres,
      nombreSallesDeBains,
      cleaningPrice,
      amenities,
      instructions,
      defaultLaundryBag,
    } = req.body;

    // Validate required fields
    if (!name || !address || !surface || !nombreChambres || !nombreSallesDeBains) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }

    const photos = req.files ? req.files.map(file => `/uploads/apartments/${file.filename}`) : [];

    const apartment = new Apartment({
      name: name.trim(),
      address: address.trim(),
      description: description?.trim() || '',
      surface: parseFloat(surface),
      nombreChambres: parseInt(nombreChambres),
      nombreSallesDeBains: parseInt(nombreSallesDeBains),
      cleaningPrice: parseFloat(cleaningPrice) || 0,
      photos,
      amenities: amenities ? JSON.parse(amenities) : [],
      defaultLaundryBag: defaultLaundryBag ? JSON.parse(defaultLaundryBag) : [],
      instructions: instructions?.trim() || '',
      createdBy: req.user.id,
    });

    await apartment.save();
    await apartment.populate('createdBy', 'firstName lastName');
    if (req.user.role === 'Manager') {
      await User.findByIdAndUpdate(
        req.user.id,
        { $addToSet: { managedApartments: apartment._id } }
      );
    }
    res.status(201).json(apartment);
  } catch (error) {
    console.error('Error creating apartment:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la création de l\'appartement' });
  }
});

// PUT /api/apartments/:id - Update apartment
router.put('/:id', auth, authorize('Admin', 'Manager'), upload.array('photos', 10), async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    
    if (!apartment || !apartment.isActive) {
      return res.status(404).json({ message: 'Appartement non trouvé' });
    }

    const {
      name,
      address,
      description,
      surface,
      nombreChambres,
      nombreSallesDeBains,
      cleaningPrice,
      amenities,
      instructions,
      defaultLaundryBag,
      existingPhotos,
    } = req.body;

    // Validate required fields
    if (!name || !address || !surface || !nombreChambres || !nombreSallesDeBains) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }

    let photos = existingPhotos ? JSON.parse(existingPhotos) : [];
    
    if (req.files && req.files.length > 0) {
      const newPhotos = req.files.map(file => `/uploads/apartments/${file.filename}`);
      photos = [...photos, ...newPhotos];
    }

    const updateData = {
      name: name.trim(),
      address: address.trim(),
      description: description?.trim() || '',
      surface: parseFloat(surface),
      nombreChambres: parseInt(nombreChambres),
      nombreSallesDeBains: parseInt(nombreSallesDeBains),
      cleaningPrice: parseFloat(cleaningPrice) || 0,
      photos,
      amenities: amenities ? JSON.parse(amenities) : [],
      defaultLaundryBag: defaultLaundryBag ? JSON.parse(defaultLaundryBag) : [],
      instructions: instructions?.trim() || '',
    };

    const updatedApartment = await Apartment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');

    res.json(updatedApartment);
  } catch (error) {
    console.error('Error updating apartment:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'appartement' });
  }
});

// DELETE /api/apartments/:id - Soft delete apartment
router.delete('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    
    if (!apartment || !apartment.isActive) {
      return res.status(404).json({ message: 'Appartement non trouvé' });
    }

    // Check if apartment has active missions
    const activeMissions = await Mission.find({
      apartment: apartment._id,
      status: { $in: ['En attente', 'En cours'] }
    });



    apartment.isActive = false;
    await apartment.save();

    res.json({ message: 'Appartement supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting apartment:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'appartement' });
  }
});

// POST /api/apartments/:id/ical - Add iCal URL to apartment
router.post('/:id/ical', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { url, source } = req.body;
    
    if (!url || !source) {
      return res.status(400).json({ message: 'URL et source sont requis' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ message: 'Format d\'URL invalide' });
    }
    const apartment = await Apartment.findById(req.params.id);
    if (!apartment || !apartment.isActive) {
      return res.status(404).json({ message: 'Appartement non trouvé' });
    }

    // Check if URL already exists
    const existingUrl = apartment.icalUrls.find(ical => ical.url.trim() === url.trim());
    if (existingUrl) {
      return res.status(400).json({ message: 'Cette URL iCal existe déjà' });
    }

    // Use $addToSet to prevent duplicates at DB level
    const updatedApartment = await Apartment.findByIdAndUpdate(
      req.params.id,
      { 
        $addToSet: { 
          icalUrls: { 
            url: url.trim(), 
            source: source.trim(),
            isActive: true
          } 
        } 
      },
      { new: true }
    );

    res.json(updatedApartment);
  } catch (error) {
    console.error('Error adding iCal URL:', error);
    res.status(500).json({ message: 'Erreur lors de l\'ajout de l\'URL iCal' });
  }
});

// DELETE /api/apartments/:id/ical/:icalId - Remove iCal URL from apartment
router.delete('/:id/ical/:icalId', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    if (!apartment || !apartment.isActive) {
      return res.status(404).json({ message: 'Appartement non trouvé' });
    }

    apartment.icalUrls = apartment.icalUrls.filter(
      ical => ical._id.toString() !== req.params.icalId
    );
    await apartment.save();

    res.json(apartment);
  } catch (error) {
    console.error('Error removing iCal URL:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'URL iCal' });
  }
});

// POST /api/apartments/:id/assign-manager - Assign manager to apartment
router.post('/:id/assign-manager', auth, authorize('Admin'), async (req, res) => {
  try {
    const { managerId } = req.body;
    
    if (!managerId) {
      return res.status(400).json({ message: 'ID du manager requis' });
    }

    // Vérifier que l'utilisateur est un Manager
    const manager = await User.findById(managerId);
    if (!manager || manager.role !== 'Manager' || !manager.isActive) {
      return res.status(400).json({ message: 'Manager non trouvé ou inactif' });
    }

    // Vérifier que l'appartement existe
    const apartment = await Apartment.findById(req.params.id);
    if (!apartment || !apartment.isActive) {
      return res.status(404).json({ message: 'Appartement non trouvé' });
    }

    // Ajouter l'appartement à la liste des appartements gérés
    await User.findByIdAndUpdate(
      managerId,
      { $addToSet: { managedApartments: req.params.id } }
    );

    res.json({ message: 'Manager assigné à l\'appartement avec succès' });
  } catch (error) {
    console.error('Error assigning manager:', error);
    res.status(500).json({ message: 'Erreur lors de l\'assignation du manager' });
  }
});

// DELETE /api/apartments/:id/unassign-manager - Remove manager from apartment
router.delete('/:id/unassign-manager/:managerId', auth, authorize('Admin'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.params.managerId,
      { $pull: { managedApartments: req.params.id } }
    );

    res.json({ message: 'Manager retiré de l\'appartement avec succès' });
  } catch (error) {
    console.error('Error unassigning manager:', error);
    res.status(500).json({ message: 'Erreur lors du retrait du manager' });
  }
});

module.exports = router;