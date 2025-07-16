const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Apartment = require('../models/Apartment');
const Booking = require('../models/Booking');
const Mission = require('../models/Mission');
const { auth, authorize } = require('../middleware/auth');

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
router.get('/', auth, async (req, res) => {
  try {
    const apartments = await Apartment.find({ isActive: true })
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
router.get('/:id', auth, async (req, res) => {
  try {
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
      instructions: instructions?.trim() || '',
      createdBy: req.user.id,
    });

    await apartment.save();
    await apartment.populate('createdBy', 'firstName lastName');

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

module.exports = router;