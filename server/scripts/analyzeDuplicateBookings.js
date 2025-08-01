// Script d'analyse des doublons de réservations
require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Mission = require('../models/Mission');
const Apartment = require('../models/Apartment');

async function analyzeDuplicateBookings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔍 Analyse des doublons de réservations...\n');

    // Récupérer tous les appartements actifs
    const apartments = await Apartment.find({ isActive: true }).lean();
    
    for (const apartment of apartments) {
      console.log(`📍 Appartement: ${apartment.name} (${apartment._id})`);
      
      // Récupérer toutes les réservations pour cet appartement
      const bookings = await Booking.find({
        apartment: apartment._id,
        status: 'Confirmé'
      }).sort({ dateDebut: 1 }).lean();

      if (bookings.length === 0) {
        console.log('  ↳ Aucune réservation\n');
        continue;
      }

      // Grouper par jour (UTC, ignore les heures)
      const bookingsByDay = new Map();
      
      for (const booking of bookings) {
        const dayKey = booking.dateDebut.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!bookingsByDay.has(dayKey)) {
          bookingsByDay.set(dayKey, []);
        }
        bookingsByDay.get(dayKey).push(booking);
      }

      // Analyser les doublons
      let duplicatesFound = false;
      for (const [day, dayBookings] of bookingsByDay) {
        if (dayBookings.length > 1) {
          duplicatesFound = true;
          console.log(`  ⚠️  ${day}: ${dayBookings.length} réservations`);
          
          for (const booking of dayBookings) {
            console.log(`    - ${booking.externalId} (${booking.source}): ${booking.dateDebut.toISOString()} → ${booking.dateFin.toISOString()}`);
          }
        }
      }

      if (!duplicatesFound) {
        console.log('  ✅ Aucun doublon détecté');
      }

      // Vérifier les missions automatiques pour cet appartement
      const autoMissions = await Mission.find({
        apartment: apartment._id,
        'metadata.autoGenerated': true
      }).sort({ dateDebut: 1 }).lean();

      if (autoMissions.length > 0) {
        console.log(`  🔧 ${autoMissions.length} missions automatiques trouvées`);
        
        // Grouper les missions par jour
        const missionsByDay = new Map();
        for (const mission of autoMissions) {
          const dayKey = mission.dateDebut.toISOString().split('T')[0];
          if (!missionsByDay.has(dayKey)) {
            missionsByDay.set(dayKey, []);
          }
          missionsByDay.get(dayKey).push(mission);
        }

        // Détecter les doublons de missions
        for (const [day, dayMissions] of missionsByDay) {
          if (dayMissions.length > 1) {
            console.log(`  🚨 ${day}: ${dayMissions.length} missions automatiques (DOUBLON!)`);
            for (const mission of dayMissions) {
              console.log(`    - Mission ${mission._id}: ${mission.title} (${mission.dateDebut.toISOString()})`);
            }
          }
        }
      }

      console.log(''); // Ligne vide pour séparer les appartements
    }

    console.log('✅ Analyse terminée');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
    process.exit(1);
  }
}

// Fonction pour nettoyer les missions en double (optionnel)
async function cleanDuplicateMissions() {
  try {
    console.log('🧹 Nettoyage des missions en double...\n');

    const apartments = await Apartment.find({ isActive: true }).lean();
    let totalCleaned = 0;

    for (const apartment of apartments) {
      console.log(`📍 Nettoyage pour: ${apartment.name}`);

      // Récupérer toutes les missions auto pour cet appartement
      const autoMissions = await Mission.find({
        apartment: apartment._id,
        'metadata.autoGenerated': true
      }).sort({ dateDebut: 1 });

      // Grouper par jour
      const missionsByDay = new Map();
      for (const mission of autoMissions) {
        const dayKey = mission.dateDebut.toISOString().split('T')[0];
        if (!missionsByDay.has(dayKey)) {
          missionsByDay.set(dayKey, []);
        }
        missionsByDay.get(dayKey).push(mission);
      }

      // Pour chaque jour avec des doublons, garder seulement la première mission
      for (const [day, dayMissions] of missionsByDay) {
        if (dayMissions.length > 1) {
          console.log(`  🗑️  ${day}: suppression de ${dayMissions.length - 1} mission(s) en double`);
          
          // Garder la première mission (la plus ancienne)
          const toKeep = dayMissions[0];
          const toDelete = dayMissions.slice(1);

          for (const mission of toDelete) {
            await Mission.findByIdAndDelete(mission._id);
            totalCleaned++;
            console.log(`    ✗ Supprimée: ${mission._id}`);
          }
          console.log(`    ✓ Conservée: ${toKeep._id}`);
        }
      }
    }

    console.log(`\n✅ Nettoyage terminé: ${totalCleaned} missions supprimées`);
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  }
}

// Exécution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--clean')) {
    // Mode nettoyage
    (async () => {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      await cleanDuplicateMissions();
      await mongoose.disconnect();
      process.exit(0);
    })();
  } else {
    // Mode analyse par défaut
    analyzeDuplicateBookings();
  }
}

module.exports = { analyzeDuplicateBookings, cleanDuplicateMissions };