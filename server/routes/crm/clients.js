const express = require('express');
const Client = require('../../models/Client');
const Contact = require('../../models/Contact');
const Lead = require('../../models/Lead');
const { auth, authorize } = require('../../middleware/auth');

const router = express.Router();

// GET /api/crm/clients - Get all clients
router.get('/', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Client.countDocuments(filter);
    
    const clients = await Client.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Add contact and lead counts
    const clientsWithCounts = await Promise.all(
      clients.map(async (client) => {
        const [contactCount, leadCount] = await Promise.all([
          Contact.countDocuments({ client: client._id, isActive: true }),
          Lead.countDocuments({ client: client._id, isActive: true }),
        ]);

        return {
          ...client.toObject(),
          contactCount,
          leadCount,
        };
      })
    );

    res.json({
      clients: clientsWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des clients' });
  }
});

// GET /api/crm/clients/:id - Get client by ID
router.get('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!client || !client.isActive) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }

    const [contacts, leads] = await Promise.all([
      Contact.find({ client: client._id, isActive: true })
        .populate('createdBy', 'firstName lastName')
        .sort({ isPrimary: -1, createdAt: -1 }),
      Lead.find({ client: client._id, isActive: true })
        .populate('assignedTo', 'firstName lastName')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 }),
    ]);

    res.json({
      ...client.toObject(),
      contacts,
      leads,
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du client' });
  }
});

// POST /api/crm/clients - Create new client
router.post('/', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { name, email, phone, company, address, notes } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Le nom et l\'email sont requis' });
    }

    // Check if email already exists
    const existingClient = await Client.findOne({ email: email.toLowerCase() });
    if (existingClient) {
      return res.status(400).json({ message: 'Un client avec cet email existe déjà' });
    }

    const client = new Client({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      company: company?.trim() || '',
      address: address || {},
      notes: notes?.trim() || '',
      createdBy: req.user.id,
    });

    await client.save();
    await client.populate('createdBy', 'firstName lastName');

    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la création du client' });
  }
});

// PUT /api/crm/clients/:id - Update client
router.put('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { name, email, phone, company, address, notes } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Le nom et l\'email sont requis' });
    }

    // Check if email is already taken by another client
    const existingClient = await Client.findOne({
      email: email.toLowerCase(),
      _id: { $ne: req.params.id },
    });
    if (existingClient) {
      return res.status(400).json({ message: 'Un autre client utilise déjà cet email' });
    }

    const updateData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      company: company?.trim() || '',
      address: address || {},
      notes: notes?.trim() || '',
    };

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');

    if (!client || !client.isActive) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la mise à jour du client' });
  }
});

// DELETE /api/crm/clients/:id - Soft delete client
router.delete('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client || !client.isActive) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }

    // Check for active leads
    const activeLeads = await Lead.countDocuments({
      client: client._id,
      isActive: true,
      status: { $nin: ['Won', 'Lost'] },
    });

    if (activeLeads > 0) {
      return res.status(400).json({
        message: 'Impossible de supprimer un client avec des leads actifs',
      });
    }

    // Soft delete client and related contacts
    await Promise.all([
      Client.findByIdAndUpdate(req.params.id, { isActive: false }),
      Contact.updateMany({ client: client._id }, { isActive: false }),
      Lead.updateMany({ client: client._id }, { isActive: false }),
    ]);

    res.json({ message: 'Client supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du client' });
  }
});

module.exports = router;