const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema({
  apartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Apartment',
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  dateDebut: {
    type: Date,
    required: true,
  },
  dateFin: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['En attente', 'En cours', 'Terminé', 'Problème'],
    default: 'En attente',
  },
  priority: {
    type: String,
    enum: ['Faible', 'Normale', 'Élevée', 'Urgente'],
    default: 'Normale',
  },
  checklist: [{
    task: String,
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
  }],
  instructions: {
    type: String,
    trim: true,
  },
  photosAvant: [{
    type: String,
  }],
  photosApres: [{
    type: String,
  }],
  documents: [{
    filename: String,
    originalName: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  notes: {
    type: String,
    trim: true,
  },
  timeStarted: Date,
  timeCompleted: Date,
  estimatedDuration: Number, // in minutes
  actualDuration: Number, // in minutes
  cleaningPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  isInvoiced: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    autoGenerated: {
      type: Boolean,
      default: false,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    bookingSource: String,
    guestName: String,
    operationId: String,
    advanceDays: Number,
    manualOverride: {
      type: Boolean,
      default: false,
    },
    createdVia: {
      type: String,
      enum: ['automatic', 'manual'],
      default: 'manual'
    },
    cancelledForMaintenance: {
      type: Boolean,
      default: false,
    },
    cancelledAt: Date,
  },
});

missionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Enhanced indexes for better duplicate prevention and performance
// Unique index for automatic missions per apartment per day
missionSchema.index(
  { 
    apartment: 1, 
    // Use date part only for consistent day-based deduplication
    'dateDebut': 1,
    'metadata.autoGenerated': 1
  }, 
  { 
    unique: true,
    partialFilterExpression: { 'metadata.autoGenerated': true },
    name: 'unique_auto_mission_per_apartment_day',
    background: true
  }
);

// Additional performance indexes
missionSchema.index({ 
  assignedTo: 1, 
  dateDebut: 1, 
  status: 1 
}, { 
  name: 'assignedTo_date_status',
  background: true 
});

missionSchema.index({ 
  apartment: 1, 
  status: 1, 
  dateDebut: 1 
}, { 
  name: 'apartment_status_date',
  background: true 
});

// Index for maintenance cleanup queries
missionSchema.index({
  apartment: 1,
  'metadata.autoGenerated': 1,
  dateDebut: 1,
  status: 1
}, {
  name: 'maintenance_cleanup',
  background: true
});
// Hook pour vérifier les permissions des Managers
missionSchema.pre('save', async function (next) {
  // Seulement pour les nouvelles missions ou si l'appartement change
  if (this.isNew || this.isModified('apartment')) {
    try {
      // Récupérer l'utilisateur qui crée/modifie la mission
      const User = require('./User');
      const creator = await User.findById(this.createdBy);
      
      if (creator && creator.role === 'Manager') {
        // Vérifier que l'appartement est dans la liste des appartements gérés
        const managedApartmentIds = creator.managedApartments?.map(id => id.toString()) || [];
        
        if (!managedApartmentIds.includes(this.apartment.toString())) {
          const error = new Error('Accès refusé : cet appartement n\'est pas dans votre périmètre de gestion');
          error.name = 'ValidationError';
          return next(error);
        }
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Mission', missionSchema);