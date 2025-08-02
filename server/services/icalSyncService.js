const ical = require('node-ical');
const ApartmentImport = require('../models/Apartment');
const BookingImport = require('../models/Booking');
const { processRecentlyEndedBookings, processAdvancedUpcomingBookings } = require('./missionAutomationService');

const Apartment = ApartmentImport.default || ApartmentImport;
const Booking = BookingImport.default || BookingImport;

let pLimit;
(async () => {
  const mod = await import('p-limit');
  pLimit = mod.default;
})();

const CHUNK_SIZE = 500;
const DEBOUNCE_WINDOW_MS = 5 * 60 * 1000; // éviter resync trop rapide par source
const STABILITY_WINDOW_MS = 5 * 60 * 1000; // fenêtre pour stabiliser un changement

// Logger
const logger = {
  info: (msg, meta = {}) => console.log(`ℹ️ [iCalSync] ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`⚠️ [iCalSync] ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`❌ [iCalSync] ${msg}`, meta),
  debug: (msg, meta = {}) => console.log(`🔍 [iCalSync] ${msg}`, meta),
};

// Debounce sync par apartment+source
const syncState = new Map();

// État consolidé par appartement pour gérer flapping / fusion
const apartmentStateCache = new Map();
/*
state shape:
{
  activeBooking: { start: Date, end: Date, source: string, uid: string, summary?: string } | null,
  candidate: same | null,
  candidateSince: number,
  lastActiveBooking: same | null  // pour détection de libération
}
*/

function shouldSkipSync(apartmentId, source) {
  const key = `${apartmentId.toString()}_${source}`;
  const last = syncState.get(key);
  if (!last) return false;
  if (Date.now() - last < DEBOUNCE_WINDOW_MS) {
    logger.debug('Skipping sync due to debounce', { apartmentId: apartmentId.toString(), source });
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

/**
 * Réconcilie et stabilise l'état iCal pour un appartement donné.
 * @param {ObjectId} apartmentId
 * @param {{ start: Date, end: Date, source: string, uid: string, summary?: string } | null} bookingInterval
 * @returns consolidated activeBooking (ou null si libéré stable)
 */
function reconcileBookingState(apartmentId, bookingInterval) {
  const key = apartmentId.toString();
  const now = Date.now();
  let state = apartmentStateCache.get(key);
  if (!state) {
    state = {
      activeBooking: null,
      candidate: null,
      candidateSince: 0,
      lastActiveBooking: null
    };
    apartmentStateCache.set(key, state);
  }

  const sameInterval = (a, b) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return (
      a.start.getTime() === b.start.getTime() &&
      a.end.getTime() === b.end.getTime() &&
      a.source === b.source
    );
  };

  // Si identique à l'actif actuel, on réinitialise candidate
  if (sameInterval(state.activeBooking, bookingInterval)) {
    state.candidate = null;
    return state.activeBooking;
  }

  // Si la candidate a changé, reset timer
  if (!sameInterval(state.candidate, bookingInterval)) {
    state.candidate = bookingInterval;
    state.candidateSince = now;
    return state.activeBooking; // attente de stabilisation
  }

  // Promotion si stable assez longtemps
  if (state.candidate && now - state.candidateSince >= STABILITY_WINDOW_MS) {
    state.lastActiveBooking = state.activeBooking;
    state.activeBooking = state.candidate;
    state.candidate = null;
    state.candidateSince = 0;
    return state.activeBooking;
  }

  // Pas encore stable : retourne l'actif en place
  return state.activeBooking;
}

async function syncAllApartments() {
  logger.info('Début de la synchronisation iCal pour tous les appartements');
  if (!pLimit) {
    await new Promise(r => setTimeout(r, 100));
    if (!pLimit) {
      logger.error('p-limit pas prêt, abandon de la sync');
      return;
    }
  }
  const limit = pLimit(5);
  const now = new Date();

  const apartments = await Apartment.find({ isActive: true }, 'name icalUrls').lean();
  const tasks = [];

  for (const apt of apartments) {
    if (!Array.isArray(apt.icalUrls)) continue;

    // Pour chaque appartement, on collecte les intervalles par source en parallèle
    const perSourcePromises = apt.icalUrls
      .filter(cfg => cfg && cfg.isActive)
      .map(cfg => limit(async () => {
        if (shouldSkipSync(apt._id, cfg.source)) {
          return null;
        }

        logger.debug('Fetch iCal pour', { apartmentName: apt.name, source: cfg.source });
        let events;
        try {
          events = await fetchICalEvents(cfg.url);
        } catch (err) {
          logger.error('Erreur fetch iCal', { apartmentName: apt.name, source: cfg.source, error: err.message });
          return null;
        }

        // Déterminer l'intervalle significatif le plus récent dans cette source
        let latestInterval = null;
        for (const ev of Object.values(events)) {
          if (ev.type !== 'VEVENT' || !ev.start || !ev.end) continue;
          const dateDebut = new Date(ev.start);
          const dateFin = new Date(ev.end);
          if (dateFin < now) continue; // ignore passé

          if (
            !latestInterval ||
            dateFin.getTime() > latestInterval.end.getTime() ||
            (dateFin.getTime() === latestInterval.end.getTime() && dateDebut.getTime() > latestInterval.start.getTime())
          ) {
            latestInterval = {
              start: dateDebut,
              end: dateFin,
              source: cfg.source,
              uid: ev.uid,
              summary: ev.summary
            };
          }
        }

        markSyncCompleted(apt._id, cfg.source);
        return latestInterval;
      }));

    tasks.push(
      (async () => {
        const intervals = (await Promise.all(perSourcePromises)).filter(Boolean);
        if (!intervals.length) {
          // Peut être situation de libération si auparavant actif et maintenant rien de stable
          const consolidatedEmpty = reconcileBookingState(apt._id, null);
          const prevState = apartmentStateCache.get(apt._id.toString());
          const prevActive = prevState ? prevState.lastActiveBooking : null;
          if (!consolidatedEmpty && prevActive) {
            logger.info('Appart libéré stable détecté (aucune source active)', {
              apartmentId: apt._id.toString(),
              previous: prevActive
            });
            // déclenchement recent-ended
            setImmediate(() => {
              processRecentlyEndedBookings().catch(e => {
                logger.error('Erreur pipeline recent-ended après libération', { error: e.message });
              });
            });
          }
          return [];
        }

        // Choisir, parmi toutes les sources, l'intervalle "dominant" (priorité à la fin la plus tardive, puis début)
        let chosen = null;
        for (const interval of intervals) {
          if (
            !chosen ||
            interval.end.getTime() > chosen.end.getTime() ||
            (interval.end.getTime() === chosen.end.getTime() && interval.start.getTime() > chosen.start.getTime())
          ) {
            chosen = interval;
          }
        }

        const prevState = apartmentStateCache.get(apt._id.toString());
        const prevActive = prevState ? prevState.activeBooking : null;

        const consolidated = reconcileBookingState(apt._id, chosen);

        const ops = [];

        if (consolidated) {
          // Upsert booking consolidé
          const filter = {
            apartment: apt._id,
            externalId: consolidated.uid || `${apt._id.toString()}_${consolidated.start.toISOString()}`,
            source: consolidated.source
          };
          const update = {
            $set: {
              apartment: apt._id,
              dateDebut: consolidated.start,
              dateFin: consolidated.end,
              guestName: consolidated.summary || 'Réservation consolidée',
              source: consolidated.source,
              syncedAt: now,
              lastModified: now,
              status: 'Confirmé'
            },
            $setOnInsert: {
              externalId: filter.externalId,
              createdAt: now
            }
          };
          ops.push({ updateOne: { filter, update, upsert: true } });
        } else {
          // consolidated === null signifie libération stable si prevActive existait
          if (prevActive) {
            logger.info('Appart libéré stable détecté via consolidation', {
              apartmentId: apt._id.toString(),
              previous: prevActive
            });
            setImmediate(() => {
              processRecentlyEndedBookings().catch(e => {
                logger.error('Erreur pipeline recent-ended après libération', { error: e.message });
              });
            });
          }
        }

        return ops;
      })()
    );
  }

  const results = await Promise.all(tasks);
  const bulkOps = results.flat(2); // double flatten (car chaque tâche peut retourner array ou promise)

  if (!bulkOps.length) {
    logger.info('Aucun changement iCal à persister');
    return { totalUpserted: 0, totalModified: 0, totalOperations: 0 };
  }

  let totalUpserted = 0;
  let totalModified = 0;

  for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
    const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
    try {
      const res = await Booking.bulkWrite(chunk, { ordered: false });
      totalUpserted += res.upsertedCount || 0;
      totalModified += res.modifiedCount || 0;
      logger.debug('Résultat batch bulkWrite', {
        batch: Math.floor(i / CHUNK_SIZE) + 1,
        upserted: res.upsertedCount,
        modified: res.modifiedCount
      });
    } catch (err) {
      logger.error('Erreur bulkWrite', {
        batch: Math.floor(i / CHUNK_SIZE) + 1,
        error: err.message
      });
    }
  }

  logger.info('Synchronisation iCal terminée', {
    totalUpserted,
    totalModified,
    totalOperations: totalUpserted + totalModified
  });

  // Déclenchement des pipelines de mission
  try {
    await processAdvancedUpcomingBookings();
  } catch (e) {
    logger.error('Erreur création missions à venir après sync', { error: e.message });
  }
  try {
    await processRecentlyEndedBookings();
  } catch (e) {
    logger.error('Erreur création missions récentes après sync', { error: e.message });
  }

  return {
    totalUpserted,
    totalModified,
    totalOperations: totalUpserted + totalModified
  };
}

module.exports = { syncAllApartments };
