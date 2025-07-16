const express = require('express');
const Contact = require('../../models/Contact');
const Client = require('../../models/Client');
const { auth, authorize } = require('../../middleware/auth');

const router = express.Router();

// GET /api/crm/contacts - Get all contacts
router.get('/', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { search, clientId, page = 1, limit = 10 } = req.query;
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } },
      ];
    }

    if (clientId) {
      filter.client = clientId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Contact.countDocuments(filter);

    const contacts = await Contact.find(filter)
      .populate('client', 'name company email')
      .populate('createdBy', 'firstName lastName')
      .sort({ isPrimary: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des contacts' });
  }
});

// GET /api/crm/contacts/:id - Get contact by ID
router.get('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('client', 'name company email address')
      .populate('createdBy', 'firstName lastName');

    if (!contact || !contact.isActive) {
      return res.status(404).json({ message: 'Contact non trouvé' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du contact' });
  }
});

// POST /api/crm/contacts - Create new contact
router.post('/', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { client, name, role, email, phone, isPrimary, notes } = req.body;

    if (!client || !name) {
      return res.status(400).json({ message: 'Le client et le nom sont requis' });
    }

    // Verify client exists
    const clientExists = await Client.findById(client);
    if (!clientExists || !clientExists.isActive) {
      return res.status(400).json({ message: 'Client non trouvé' });
    }

    // If setting as primary, unset other primary contacts for this client
    if (isPrimary) {
      await Contact.updateMany(
        { client, isPrimary: true },
        { isPrimary: false }
      );
    }

    const contact = new Contact({
      client,
      name: name.trim(),
      role: role?.trim() || '',
      email: email?.toLowerCase().trim() || '',
      phone: phone?.trim() || '',
      isPrimary: isPrimary || false,
      notes: notes?.trim() || '',
      createdBy: req.user.id,
    });

    await contact.save();
    await contact.populate('client', 'name company email');
    await contact.populate('createdBy', 'firstName lastName');

    res.status(201).json(contact);
  } catch (error) {
    console.error('Error creating contact:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la création du contact' });
  }
});

// PUT /api/crm/contacts/:id - Update contact
router.put('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { name, role, email, phone, isPrimary, notes } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Le nom est requis' });
    }

    const contact = await Contact.findById(req.params.id);
    if (!contact || !contact.isActive) {
      return res.status(404).json({ message: 'Contact non trouvé' });
    }

    // If setting as primary, unset other primary contacts for this client
    if (isPrimary && !contact.isPrimary) {
      await Contact.updateMany(
        { client: contact.client, isPrimary: true, _id: { $ne: req.params.id } },
        { isPrimary: false }
      );
    }

    const updateData = {
      name: name.trim(),
      role: role?.trim() || '',
      email: email?.toLowerCase().trim() || '',
      phone: phone?.trim() || '',
      isPrimary: isPrimary || false,
      notes: notes?.trim() || '',
    };

    const updatedContact = await Contact.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('client', 'name company email')
      .populate('createdBy', 'firstName lastName');

    res.json(updatedContact);
  } catch (error) {
    console.error('Error updating contact:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la mise à jour du contact' });
  }
});

// DELETE /api/crm/contacts/:id - Soft delete contact
router.delete('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact || !contact.isActive) {
      return res.status(404).json({ message: 'Contact non trouvé' });
    }

    await Contact.findByIdAndUpdate(req.params.id, { isActive: false });

    res.json({ message: 'Contact supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du contact' });
  }
});

module.exports = router;