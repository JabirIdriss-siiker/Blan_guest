const express = require('express');
const Invoice = require('../models/Invoice');
const Mission = require('../models/Mission');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/invoices - Get all invoices (with filters)
router.get('/', auth, async (req, res) => {
  try {
    const { status, staff, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    const filter = {};

    // If user is staff, only show their invoices
    if (req.user.role === 'Staff de ménage') {
      filter.staff = req.user.id;
    } else if (staff) {
      filter.staff = staff;
    }

    if (status) filter.status = status;

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Invoice.countDocuments(filter);

    const invoices = await Invoice.find(filter)
      .populate('staff', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .populate('missions.mission', 'title apartment dateDebut dateFin')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des factures' });
  }
});

// GET /api/invoices/stats - Get invoice statistics
router.get('/stats', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const result = {
      total: 0,
      totalAmount: 0,
      brouillon: 0,
      envoyee: 0,
      payee: 0,
      annulee: 0,
    };

    stats.forEach(stat => {
      result.total += stat.count;
      result.totalAmount += stat.totalAmount;
      switch (stat._id) {
        case 'Brouillon':
          result.brouillon = stat.count;
          break;
        case 'Envoyée':
          result.envoyee = stat.count;
          break;
        case 'Payée':
          result.payee = stat.count;
          break;
        case 'Annulée':
          result.annulee = stat.count;
          break;
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
  }
});

// GET /api/invoices/staff-earnings - Get staff earnings summary
router.get('/staff-earnings', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};

    // If user is staff, only show their data
    if (req.user.role === 'Staff de ménage') {
      filter.staff = req.user.id;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const earnings = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$staff',
          totalEarnings: { $sum: '$totalAmount' },
          totalInvoices: { $sum: 1 },
          totalMissions: { $sum: { $size: '$missions' } },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Payée'] }, '$totalAmount', 0]
            }
          },
          pendingAmount: {
            $sum: {
              $cond: [{ $ne: ['$status', 'Payée'] }, '$totalAmount', 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'staff'
        }
      },
      { $unwind: '$staff' },
      {
        $project: {
          staff: {
            _id: '$staff._id',
            firstName: '$staff.firstName',
            lastName: '$staff.lastName',
            email: '$staff.email'
          },
          totalEarnings: 1,
          totalInvoices: 1,
          totalMissions: 1,
          paidAmount: 1,
          pendingAmount: 1
        }
      },
      { $sort: { totalEarnings: -1 } }
    ]);

    res.json(earnings);
  } catch (error) {
    console.error('Error fetching staff earnings:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des gains' });
  }
});

// GET /api/invoices/:id - Get invoice by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('staff', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName')
      .populate('missions.mission', 'title apartment dateDebut dateFin');

    if (!invoice) {
      return res.status(404).json({ message: 'Facture non trouvée' });
    }

    // Check if user has access to this invoice
    if (req.user.role === 'Staff de ménage' && invoice.staff._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la facture' });
  }
});

// POST /api/invoices - Create new invoice
router.post('/', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { staff, startDate, endDate, notes } = req.body;

    if (!staff || !startDate || !endDate) {
      return res.status(400).json({ message: 'Personnel, date de début et date de fin sont requis' });
    }

    // Check if staff exists
    const staffUser = await User.findById(staff);
    if (!staffUser || !staffUser.isActive || staffUser.role !== 'Staff de ménage') {
      return res.status(400).json({ message: 'Personnel non trouvé' });
    }

    // Find completed missions in the date range
    const missions = await Mission.find({
      assignedTo: staff,
      status: 'Terminé',
      timeCompleted: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).populate('apartment', 'name address');

    if (missions.length === 0) {
      return res.status(400).json({ message: 'Aucune mission terminée trouvée pour cette période' });
    }

    // Check if any missions are already invoiced
    const existingInvoices = await Invoice.find({
      'missions.mission': { $in: missions.map(m => m._id) }
    });

    if (existingInvoices.length > 0) {
      return res.status(400).json({ message: 'Certaines missions sont déjà facturées' });
    }

    // Create invoice missions array
    const invoiceMissions = missions.map(mission => ({
      mission: mission._id,
      title: mission.title,
      apartment: `${mission.apartment.name} - ${mission.apartment.address}`,
      dateCompleted: mission.timeCompleted,
      price: mission.cleaningPrice || 0,
    }));

    const totalAmount = invoiceMissions.reduce((sum, item) => sum + item.price, 0);

    const invoice = new Invoice({
      staff,
      missions: invoiceMissions,
      period: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      totalAmount,
      notes: notes?.trim() || '',
      createdBy: req.user.id,
    });

    await invoice.save();
    await invoice.populate('staff', 'firstName lastName email');
    await invoice.populate('createdBy', 'firstName lastName');

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la création de la facture' });
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { status, notes } = req.body;

    const updateData = {};
    if (status) {
      updateData.status = status;
      if (status === 'Envoyée' && !req.body.sentAt) {
        updateData.sentAt = new Date();
      } else if (status === 'Payée' && !req.body.paidAt) {
        updateData.paidAt = new Date();
      }
    }
    if (notes !== undefined) updateData.notes = notes.trim();

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('staff', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');

    if (!invoice) {
      return res.status(404).json({ message: 'Facture non trouvée' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Données invalides', errors: error.errors });
    }
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la facture' });
  }
});

// DELETE /api/invoices/:id - Delete invoice (only drafts)
router.delete('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ message: 'Facture non trouvée' });
    }

    if (invoice.status !== 'Brouillon') {
      return res.status(400).json({ message: 'Seules les factures en brouillon peuvent être supprimées' });
    }

    await Invoice.findByIdAndDelete(req.params.id);

    res.json({ message: 'Facture supprimée avec succès' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la facture' });
  }
});

module.exports = router;