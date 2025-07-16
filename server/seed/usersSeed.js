// server/seed/apartmentsSeed.js
require('dotenv').config();
const mongoose  = require('mongoose');
const Apartment = require('../models/Apartment');
const User      = require('../models/User');

async function seedApts() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser:    true,
    useUnifiedTopology: true
  });

  // Récupère l'Admin créé dans usersSeed.js
  const admin = await User.findOne({ email: 'admin@demo.com' });
  if (!admin) {
    console.error('❌ Aucun utilisateur Admin trouvé (email: admin@demo.com)');
    process.exit(1);
  }

  const demo = {
    name: 'Test Apartment',
    address: '123 Demo St, Paris',
    description: 'Appart de test pour iCal',
    surface: 30,
    nombreChambres:      1,
    nombreSallesDeBains: 1,
    icalUrls: [
      {
        url:      'https://www.airbnb.fr/calendar/ical/1347827447875416650.ics?s=2e1cbcc7d7d515004efa6a6851160351',
        source:   'Airbnb',
        isActive: true
      }
    ],
    isActive:  true,
    createdBy: admin._id       // on utilise l'ID dynamique
  };

  await Apartment.create(demo);
  console.log('✅ Appartement de test ajouté');
  await mongoose.disconnect();
  process.exit(0);
}

seedApts().catch(err => {
  console.error(err);
  process.exit(1);
});
