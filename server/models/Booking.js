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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Booking', bookingSchema);