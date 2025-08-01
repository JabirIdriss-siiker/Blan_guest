const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  apartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Apartment',
    required: true,
  },
  dateDebut: {
    type: Date,
    required: true,
  },
  dateFin: {
    type: Date,
    required: true,
  },
  guestName: {
    type: String,
    trim: true,
  },
  source: {
    type: String,
    required: true, // Airbnb, Booking.com, etc.
  },
  externalId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Confirmé', 'Annulé', 'En attente'],
    default: 'Confirmé',
  },
  syncedAt: {
    type: Date,
    default: Date.now,
  },
  lastModified: {
    type: Date,
    default: Date.now,
  },
  stateChanges: [{
    from: String,
    to: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    source: String,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Enhanced indexes for better query performance
bookingSchema.index({ 
  apartment: 1, 
  dateFin: 1, 
  status: 1 
}, { 
  name: 'apartment_dateFin_status',
  background: true 
});

bookingSchema.index({ 
  apartment: 1, 
  externalId: 1, 
  source: 1 
}, { 
  unique: true,
  name: 'apartment_externalId_source',
  background: true 
});

bookingSchema.index({ 
  dateFin: 1, 
  status: 1 
}, { 
  name: 'dateFin_status',
  background: true 
});

// Pre-save hook to track state changes
bookingSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.stateChanges.push({
      from: this.constructor.findOne({ _id: this._id }).status,
      to: this.status,
      timestamp: new Date(),
      source: 'system'
    });
  }
  next();
});
module.exports = mongoose.model('Booking', bookingSchema);