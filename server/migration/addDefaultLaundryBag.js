// Migration script to add defaultLaundryBag to existing apartments
require('dotenv').config();
const mongoose = require('mongoose');
const Apartment = require('../models/Apartment');

async function addDefaultLaundryBagToApartments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔄 Migration: Ajout du defaultLaundryBag aux appartements existants...');

    // Update all apartments that don't have defaultLaundryBag field
    const result = await Apartment.updateMany(
      { defaultLaundryBag: { $exists: false } },
      { $set: { defaultLaundryBag: [] } }
    );

    console.log(`✅ Migration terminée: ${result.modifiedCount} appartements mis à jour`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

addDefaultLaundryBagToApartments();