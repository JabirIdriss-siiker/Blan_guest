const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['Prospect', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
    default: 'Prospect',
  },
  source: {
    type: String,
    enum: ['Website', 'Referral', 'Cold Call', 'Email', 'Social Media', 'Advertisement', 'Other'],
    default: 'Other',
  },
  value: {
    type: Number,
    default: 0,
  },
  probability: {
    type: Number,
    min: 0,
    max: 100,
    default: 10,
  },
  expectedCloseDate: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
  activities: [{
    type: {
      type: String,
      enum: ['Call', 'Email', 'Meeting', 'Note'],
      required: true,
    },
    description: String,
    date: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

leadSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Lead', leadSchema);