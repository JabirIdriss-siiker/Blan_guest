// server/services/icalSyncService.js
const ical = require('node-ical');
const ApartmentImport = require('../models/Apartment');
const BookingImport = require('../models/Booking');

const Apartment = ApartmentImport.default || ApartmentImport;
const Booking = BookingImport.default || BookingImport;

let pLimit;
(async () => {
  const mod = await import('p-limit');
  pLimit = mod.default;
})();

const CHUNK_SIZE = 500;
const DEBOUNCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Logger
const logger = {
  info: (msg, meta = {}) => console.log(`ℹ️ [iCalSync] ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`⚠️ [iCalSync] ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`❌ [iCalSync] ${msg}`, meta),
  debug: (msg, meta = {}) => console.log(`🔍 [iCalSync] ${msg}`, meta),
};

// Debounce map to avoid re-syncing the same feed too rapidly
const syncState = new Map();

function shouldSkipSync(apartmentId, source) {
  const key = `${apartmentId.toString()}_${source}`;
  const last = syncState.get(key);
  if (!last) return false;
  if (Date.now() - last < DEBOUNCE_WINDOW_MS) {
    logger.debug('Skipping iCal sync due to debounce', { apartmentId: apartmentId.toString(), source });
    return true;
  }
  return false;
}

function markSyncCompleted(apartmentId, source) {
  const key = `${apartmentId.toString()}_${source}`;
  syncState.set(key, Date.now());
}

async function fetchICalEvents(url) {
  try {
    return await ical.async.fromURL(url);
  } catch (err) {
    throw new Error(`Failed to fetch iCal from ${url}: ${err.message}`);
  }
}

async function syncAllApartments() {
  logger.info('Starting iCal sync for all apartments');
  if (!pLimit) {
    await new Promise(r => setTimeout(r, 100));
    if (!pLimit) {
      logger.error('p-limit not loaded; aborting sync');
      return;
    }
  }
  const limit = pLimit(5);
  const now = new Date();

  const apartments = await Apartment.find({ isActive: true }, 'name icalUrls').lean();
  const tasks = [];

  for (const apt of apartments) {
    if (!Array.isArray(apt.icalUrls)) continue;

    for (const cfg of apt.icalUrls) {
      if (!cfg || !cfg.isActive) continue;
      if (shouldSkipSync(apt._id, cfg.source)) continue;

      tasks.push(limit(async () => {
        logger.debug('Syncing iCal for apartment', {
          apartmentName: apt.name,
          source: cfg.source,
          url: cfg.url?.slice(0, 80) + (cfg.url && cfg.url.length > 80 ? '...' : '')
        });

        let events;
        try {
          events = await fetchICalEvents(cfg.url);
          logger.debug('Fetched raw events', { apartmentName: apt.name, source: cfg.source, count: Object.keys(events).length });
        } catch (err) {
          logger.error('Failed to fetch iCal events', { apartmentName: apt.name, source: cfg.source, error: err.message });
          return [];
        }

        const ops = [];
        for (const ev of Object.values(events)) {
          if (ev.type !== 'VEVENT' || !ev.start || !ev.end) continue;

          const dateDebut = new Date(ev.start);
          const dateFin = new Date(ev.end);

          // Only future or just-ended (for cleanup) — we let mission service decide creation
          if (dateFin < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
            // too old, ignore beyond some retention window
            continue;
          }

          const filter = {
            apartment: apt._id,
            externalId: ev.uid,
            source: cfg.source
          };
          const update = {
            $set: {
              apartment: apt._id,
              dateDebut,
              dateFin,
              guestName: ev.summary || 'Réservation',
              source: cfg.source,
              syncedAt: now,
              lastModified: ev.lastmodified ? new Date(ev.lastmodified) : now
            },
            $setOnInsert: {
              externalId: ev.uid,
              status: 'Confirmé',
              createdAt: now
            }
          };

          ops.push({ updateOne: { filter, update, upsert: true } });

          // If booking just ended very recently, trigger immediate cleanup missions
          if (dateFin <= now && dateFin >= new Date(now.getTime() - 5 * 60 * 1000)) {
            logger.info('Detected booking just ended, triggering recent-ended pipeline', {
              apartment: apt.name,
              externalId: ev.uid
            });
            // fire-and-forget
            try {
              const { processRecentlyEndedBookings } = require('./missionAutomationService');
              processRecentlyEndedBookings().catch(e => {
                logger.error('Error processing recently ended after checkout', { error: e.message });
              });
            } catch (e) {
              logger.error('Cannot invoke recent-ended pipeline', { error: e.message });
            }
          }
        }

        logger.debug('Prepared bulk ops for apartment', {
          apartmentName: apt.name,
          source: cfg.source,
          opsCount: ops.length
        });

        markSyncCompleted(apt._id, cfg.source);
        return ops;
      }));
    }
  }

  const results = await Promise.all(tasks);
  const bulkOps = results.flat();

  if (!bulkOps.length) {
    logger.info('No iCal changes to persist');
    return { totalUpserted: 0, totalModified: 0, totalOperations: 0 };
  }

  let totalUpserted = 0;
  let totalModified = 0;

  // Bulk write in chunks
  for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
    const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
    try {
      const res = await Booking.bulkWrite(chunk, { ordered: false });
      totalUpserted += res.upsertedCount || 0;
      totalModified += res.modifiedCount || 0;
      logger.debug('Bulk write batch result', {
        batch: Math.floor(i / CHUNK_SIZE) + 1,
        upserted: res.upsertedCount,
        modified: res.modifiedCount
      });
    } catch (err) {
      logger.error('BulkWrite error', { batch: Math.floor(i / CHUNK_SIZE) + 1, error: err.message });
    }
  }

  logger.info('iCal synchronization complete', {
    totalUpserted,
    totalModified,
    totalOperations: totalUpserted + totalModified
  });

  // Trigger automatic mission creation based on fresh booking state
  try {
    const { processUpcomingBookings, processRecentlyEndedBookings } = require('./missionAutomationService');
    processUpcomingBookings().catch(e => {
      logger.error('Error creating upcoming missions after iCal sync', { error: e.message });
    });
    processRecentlyEndedBookings().catch(e => {
      logger.error('Error creating recent-ended missions after iCal sync', { error: e.message });
    });
  } catch (e) {
    logger.error('Could not invoke mission automation after sync', { error: e.message });
  }

  return {
    totalUpserted,
    totalModified,
    totalOperations: totalUpserted + totalModified
  };
}

module.exports = { syncAllApartments };
