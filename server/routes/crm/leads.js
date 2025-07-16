const express = require('express');
const Lead = require('../../models/Lead');
const Client = require('../../models/Client');
const User = require('../../models/User');
const { auth, authorize } = require('../../middleware/auth');

const router = express.Router();

// GET /api/crm/leads - Get all leads
router.get('/', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { search, status, source, assignedTo, page = 1, limit = 10 } = req.query;
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) filter.status = status;
    if (source) filter.source = source;
    if (assignedTo) filter.assignedTo = assignedTo;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Lead.countDocuments(filter);

    const leads = await Lead.find(filter)
      .populate('client', 'name company email')
      .populate('assignedTo', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des leads' });
  }
});

// GET /api/crm/leads/pipeline - Get leads grouped by status for kanban view
router.get('/pipeline', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { assignedTo } = req.query;
    const filter = { isActive: true };

    if (assignedTo) filter.assignedTo = assignedTo;

    const leads = await Lead.find(filter)
      .populate('client', 'name company email')
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Group leads by status
    const pipeline = {
      Prospect: [],
      Qualified: [],
      Proposal: [],
      Negotiation: [],
      Won: [],
      Lost: [],
    };

    leads.forEach(lead => {
      if (pipeline[lead.status]) {
        pipeline[lead.status].push(lead);
      }
    });

    res.json(pipeline);
  } catch (error) {
    console.error('Error fetching pipeline:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du pipeline' });
  }
});

// GET /api/crm/leads/:id - Get lead by ID
router.get('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('client', 'name company email address phone')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .populate('activities.createdBy', 'firstName lastName');

    if (!lead || !lead.isActive) {
      return res.status(404).json({ message: 'Lead non trouvé' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du lead' });
  }
});

// POST /api/crm/leads - Create new lead
router.post('/', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const {
      client,
      title,
      status,
      source,
      value,
      probability,
      expectedCloseDate,
      notes,
      assignedTo,
    } = req.body;

    if (!client || !title) {
      return res.status(400).json({ message: 'Le client et le titre sont requis' });
    }

    // Verify client exists
    const clientExists = await Client.findById(client);
    if (!clientExists || !clientExists.isActive) {
      return res.status(400).json({ message: 'Client non trouvé' });
    }

    // Verify assigned user exists if provided
    if (assignedTo) {
      const userExists = await User.findById(assignedTo);
      if (!userExists || !userExists.isActive) {
        return res.status(400).json({ message: 'Utilisateur assigné non trouvé' });
      }
    }

    const lead = new Lead({
      client,
      title: title.trim(),
      status: status || 'Prospect',
      source: source || 'Other',
      value: value || 0,
      probability: probability || 10,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
      notes: notes?.trim() || '',
      assignedTo: assignedTo || null,
      createdBy: req.user.id,
    });

    await lead.save();
    await lead.populate('client', 'name company email');
    await lead.populate('assignedTo', 'firstName lastName');
    await lead.populate('createdBy', 'firstName lastName');

    res.status(201).json(lead);
  } catch (error) {
    console.error('Error creating lead:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la création du lead' });
  }
});

// PUT /api/crm/leads/:id - Update lead
router.put('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const {
      title,
      status,
      source,
      value,
      probability,
      expectedCloseDate,
      notes,
      assignedTo,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Le titre est requis' });
    }

    // Verify assigned user exists if provided
    if (assignedTo) {
      const userExists = await User.findById(assignedTo);
      if (!userExists || !userExists.isActive) {
        return res.status(400).json({ message: 'Utilisateur assigné non trouvé' });
      }
    }

    const updateData = {
      title: title.trim(),
      status: status || 'Prospect',
      source: source || 'Other',
      value: value || 0,
      probability: probability || 10,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
      notes: notes?.trim() || '',
      assignedTo: assignedTo || null,
    };

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('client', 'name company email')
      .populate('assignedTo', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    if (!lead || !lead.isActive) {
      return res.status(404).json({ message: 'Lead non trouvé' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error updating lead:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la mise à jour du lead' });
  }
});

// PUT /api/crm/leads/:id/status - Update lead status (for kanban drag & drop)
router.put('/:id/status', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Le statut est requis' });
    }

    const validStatuses = ['Prospect', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    )
      .populate('client', 'name company email')
      .populate('assignedTo', 'firstName lastName');

    if (!lead || !lead.isActive) {
      return res.status(404).json({ message: 'Lead non trouvé' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error updating lead status:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut' });
  }
});

// POST /api/crm/leads/:id/activities - Add activity to lead
router.post('/:id/activities', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { type, description } = req.body;

    if (!type || !description) {
      return res.status(400).json({ message: 'Le type et la description sont requis' });
    }

    const validTypes = ['Call', 'Email', 'Meeting', 'Note'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Type d\'activité invalide' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead || !lead.isActive) {
      return res.status(404).json({ message: 'Lead non trouvé' });
    }

    lead.activities.push({
      type,
      description: description.trim(),
      createdBy: req.user.id,
    });

    await lead.save();
    await lead.populate('activities.createdBy', 'firstName lastName');

    res.json(lead.activities[lead.activities.length - 1]);
  } catch (error) {
    console.error('Error adding activity:', error);
    res.status(500).json({ message: 'Erreur lors de l\'ajout de l\'activité' });
  }
});

// DELETE /api/crm/leads/:id - Soft delete lead
router.delete('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead || !lead.isActive) {
      return res.status(404).json({ message: 'Lead non trouvé' });
    }

    await Lead.findByIdAndUpdate(req.params.id, { isActive: false });

    res.json({ message: 'Lead supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du lead' });
  }
});

module.exports = router;