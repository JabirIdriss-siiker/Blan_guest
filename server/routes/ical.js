const express = require('express');
const ical = require('node-ical');
const Apartment = require('../models/Apartment');
const Booking = require('../models/Booking');
const { createAutomaticMission } = require('../services/missionAutomationService');
const { runDiagnostics, getCacheStatus, clearCache } = require('../services/missionAutomationService');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Sync iCal data for a single apartment
router.post('/sync/:apartmentId', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.apartmentId);
    if (!apartment) {
      return res.status(404).json({ message: 'Appartement non trouvé' });
    }

    const syncResults = [];

    for (const icalConfig of apartment.icalUrls) {
      if (!icalConfig.isActive) continue;

      console.log(`🔄 Synchronisation iCal: ${icalConfig.url} (source: ${icalConfig.source})`);
      let events;
      try {
        events = await ical.async.fromURL(icalConfig.url);
        console.log(`✅ ${Object.keys(events).length} items récupérés depuis ${icalConfig.source}`);
      } catch (err) {
        console.error(`❌ Erreur fetch iCal (${icalConfig.source}):`, err.message);
        syncResults.push({ source: icalConfig.source, success: false, error: err.message });
        continue;
      }

      let bookingsAdded = 0;
      let bookingsUpdated = 0;

      for (const event of Object.values(events)) {
        if (event.type !== 'VEVENT' || !event.start || !event.end) continue;

        // Log raw event
        console.log(
          `📅 EVENT detected: UID=${event.uid}, start=${event.start.toISOString()}, end=${event.end.toISOString()}, summary="${event.summary}"`
        );

        const externalId = event.uid;
        const dateDebut = new Date(event.start);
        const dateFin   = new Date(event.end);

        // Skip past events
        const now = new Date();
        if (dateFin < now) {
          console.log(`  ↩️ Événement ${externalId} déjà passé (fin ${dateFin.toISOString()})`);
          continue;
        }

        const existingBooking = await Booking.findOne({
          apartment: apartment._id,
          externalId,
          source: icalConfig.source,
        });

        if (existingBooking) {
          // Update existing booking
          existingBooking.dateDebut = dateDebut;
          existingBooking.dateFin   = dateFin;
          existingBooking.guestName = event.summary || 'Réservation';
          existingBooking.syncedAt  = now;
          await existingBooking.save();
          bookingsUpdated++;
          console.log(`  ✏️ Booking mis à jour: ${externalId}`);
        } else {
          // Create new booking
          const booking = new Booking({
            apartment:   apartment._id,
            dateDebut,
            dateFin,
            guestName:   event.summary || 'Réservation',
            source:      icalConfig.source,
            externalId,
            status:      'Confirmé',
            syncedAt:    now
          });
          await booking.save();
          bookingsAdded++;
          console.log(`  ➕ Nouveau booking créé: ${externalId}`);

          // Note: Les missions automatiques sont créées via les routes dédiées
          // pour éviter les conflits de concurrence lors de la sync iCal
        }
      }

      syncResults.push({
        source:        icalConfig.source,
        success:       true,
        bookingsAdded,
        bookingsUpdated,
      });
    }

    res.json({
      message: 'Synchronisation terminée',
      results: syncResults,
    });
  } catch (error) {
    console.error('❌ Erreur route /sync/:apartmentId :', error);
    res.status(500).json({ message: 'Erreur lors de la synchronisation iCal' });
  }
});

// Sync all apartments
router.post('/sync-all', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const apartments = await Apartment.find({ isActive: true });
    const allResults = [];

    for (const apartment of apartments) {
      console.log(`\n🏠 Synchronisation globale pour l'appartement ${apartment._id}`);
      const syncResults = [];

      for (const icalConfig of apartment.icalUrls) {
        if (!icalConfig.isActive) continue;

        console.log(`  🔄 Fetch iCal: ${icalConfig.url}`);
        let events;
        try {
          events = await ical.async.fromURL(icalConfig.url);
          console.log(`  ✅ ${Object.keys(events).length} items récupérés`);
        } catch (err) {
          console.error(`  ❌ Erreur fetch iCal(${icalConfig.source}):`, err.message);
          syncResults.push({ source: icalConfig.source, success: false, error: err.message });
          continue;
        }

        let bookingsAdded = 0;
        let bookingsUpdated = 0;
        const now = new Date();
        const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

        for (const event of Object.values(events)) {
          if (event.type !== 'VEVENT' || !event.start || !event.end) continue;

          console.log(
            `  📅 EVENT: UID=${event.uid}, ${event.start.toISOString()} → ${event.end.toISOString()}`
          );

          const externalId = event.uid;
          const dateDebut = new Date(event.start);
          const dateFin   = new Date(event.end);

          if (dateFin < now) {
            console.log(`    ↩️ Ignoré, déjà passé`);
            continue;
          }

          const existingBooking = await Booking.findOne({
            apartment: apartment._id,
            externalId,
            source: icalConfig.source,
          });

          if (existingBooking) {
            existingBooking.dateDebut = dateDebut;
            existingBooking.dateFin   = dateFin;
            existingBooking.guestName = event.summary || 'Réservation';
            existingBooking.syncedAt  = now;
            await existingBooking.save();
            bookingsUpdated++;
            console.log(`    ✏️ Mis à jour`);
          } else {
            const booking = new Booking({
              apartment: apartment._id,
              dateDebut,
              dateFin,
              guestName: event.summary || 'Réservation',
              source: icalConfig.source,
              externalId,
              status: 'Confirmé',
              syncedAt: now
            });
            await booking.save();
            bookingsAdded++;
            console.log(`    ➕ Créé nouveau booking`);

            // Note: Les missions automatiques sont créées via les routes dédiées
            // pour éviter les conflits de concurrence lors de la sync globale
          }
        }

        syncResults.push({
          source:        icalConfig.source,
          success:       true,
          bookingsAdded,
          bookingsUpdated,
        });
      }

      allResults.push({
        apartment: apartment.name || apartment._id,
        results:   syncResults,
      });
    }

    res.json({
      message:    'Synchronisation globale terminée',
      apartments: allResults,
    });
  } catch (error) {
    console.error('❌ Erreur route /sync-all :', error);
    res.status(500).json({ message: 'Erreur lors de la synchronisation globale' });
  }
});

// Manual trigger for automatic missions
router.post('/create-missions', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const {
      processUpcomingBookings,
      processRecentlyEndedBookings
    } = require('../services/missionAutomationService');

    // Process with enhanced overlap detection
    const upcomingResults = await processUpcomingBookings();
    const recentResults = await processRecentlyEndedBookings();

    res.json({
      message: 'Traitement des missions automatiques terminé',
      summary: {
        upcomingProcessed: upcomingResults.length,
        recentProcessed: recentResults.length,
        successful: [...upcomingResults, ...recentResults].filter(r => r.success).length,
        failed: [...upcomingResults, ...recentResults].filter(r => !r.success).length,
        successfulMissions: [...upcomingResults, ...recentResults].filter(r => r.success && r.created).length,
        duplicatesDetected: [...upcomingResults, ...recentResults].filter(r => r.success && !r.created).length
      },
      details: {
        upcomingResults,
        recentResults
      }
    });
  } catch (error) {
    console.error('❌ Erreur route /create-missions :', error);
    res.status(500).json({ message: 'Erreur lors du traitement des missions automatiques' });
  }
});

// Enhanced diagnostics endpoint
router.get('/diagnostics', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const diagnostics = await runDiagnostics();
    res.json(diagnostics);
  } catch (error) {
    console.error('❌ Erreur route /diagnostics :', error);
    res.status(500).json({ message: 'Erreur lors de l\'exécution des diagnostics' });
  }
});

// Cache management endpoint
router.post('/clear-cache', auth, authorize('Admin'), async (req, res) => {
  try {
    clearCache();
    res.json({ 
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erreur route /clear-cache :', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du cache' });
  }
});

// Cache status endpoint
router.get('/cache-status', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const status = getCacheStatus();
    res.json(status);
  } catch (error) {
    console.error('❌ Erreur route /cache-status :', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du statut du cache' });
  }
});

// Maintenance period management
router.post('/maintenance/:apartmentId', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Dates de début et fin requises' });
    }
    
    const { cleanupMissionsForMaintenancePeriod } = require('../services/missionAutomationService');
    
    const cancelledCount = await cleanupMissionsForMaintenancePeriod(
      req.params.apartmentId,
      new Date(startDate),
      new Date(endDate)
    );
    
    res.json({
      message: 'Période de maintenance configurée',
      cancelledMissions: cancelledCount
    });
  } catch (error) {
    console.error('❌ Erreur route /maintenance :', error);
    res.status(500).json({ message: 'Erreur lors de la configuration de la maintenance' });
  }
});
module.exports = router;
