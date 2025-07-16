// backend/src/services/icalSyncService.js
const ical       = require('node-ical');
const pLimit     = require('p-limit');
const Apartment  = require('../models/Apartment');
const Booking    = require('../models/Booking');

// Limit concurrent fetches to 5
const limit = pLimit(5);
// Chunk size for bulk writes
const CHUNK_SIZE = 500;

async function fetchICalEvents(url) {
  try {
    return await ical.async.fromURL(url);
  } catch (err) {
    throw new Error(err.message);
  }
}

async function syncAllApartments() {
  console.log('🌀 Synchronisation iCal pour tous les appartements…');

  // Only fetch needed fields, lean to plain JS
  const apartments = await Apartment.find(
    { isActive: true },
    'name icalUrls'
  ).lean();
  const now = new Date();

  // Prepare tasks for parallel fetch
  const tasks = [];
  for (const apt of apartments) {
    for (const cfg of apt.icalUrls) {
      if (!cfg.isActive) continue;
      tasks.push(limit(async () => {
        console.log(`  ↪️  ${apt.name} – ${cfg.source}`);
        let events;
        try {
          events = await fetchICalEvents(cfg.url);
        } catch (err) {
          console.error(`    ❌ Erreur fetch iCal (${cfg.source}):`, err.message);
          return [];
        }
        const ops = [];
        for (const ev of Object.values(events)) {
          if (ev.type !== 'VEVENT' || !ev.start || !ev.end) continue;
          const dateDebut = new Date(ev.start);
          const dateFin   = new Date(ev.end);
          if (dateFin < now) continue;
          const filter = { apartment: apt._id, externalId: ev.uid, source: cfg.source };
          const update = {
            $set: {
              apartment:  apt._id,
              dateDebut,
              dateFin,
              guestName: ev.summary || 'Réservation',
              source:    cfg.source,
              syncedAt:  now
            },
            $setOnInsert: {
              externalId: ev.uid,
              status:     'Confirmé'
            }
          };
          ops.push({ updateOne: { filter, update, upsert: true } });
        }
        return ops;
      }));
    }
  }

  // Execute all fetch tasks
  const results = await Promise.all(tasks);
  // Flatten
  const bulkOps = results.flat();

  if (!bulkOps.length) {
    console.log('ℹ️ Aucun événement à synchroniser');
    return;
  }

  // Write in chunks
  console.log(`🚀 Exécution du bulkWrite en ${Math.ceil(bulkOps.length/CHUNK_SIZE)} batch(es)...`);
  for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
    const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
    try {
      const result = await Booking.bulkWrite(chunk, { ordered: false });
      console.log(`  ✅ Batch ${i/CHUNK_SIZE + 1}: ${result.upsertedCount + result.modifiedCount} opérations`);
    } catch (err) {
      console.error(`  ⚠️ Erreur bulkWrite dans batch ${i/CHUNK_SIZE + 1}:`, err);
    }
  }

  console.log('✅ Synchronisation iCal terminée.');
}

module.exports = { syncAllApartments };
