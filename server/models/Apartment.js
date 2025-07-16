const mongoose = require('mongoose');

const apartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  surface: {
    type: Number,
    required: true,
  },
  nombreChambres: {
    type: Number,
    required: true,
  },
  nombreSallesDeBains: {
    type: Number,
    required: true,
  },
  cleaningPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  photos: [{
    type: String,
  }],
  icalUrls: [{
    url: String,
    source: String, // Airbnb, Booking.com, etc.
    isActive: {
      type: Boolean,
      default: true,
    },
  }],
  amenities: [{
    type: String,
  }],
  instructions: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

apartmentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Apartment', apartmentSchema);