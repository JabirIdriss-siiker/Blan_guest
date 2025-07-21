// backend/src/app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Import routes et services
const authRoutes       = require('./routes/auth');
const apartmentRoutes  = require('./routes/apartments');
const missionRoutes    = require('./routes/missions');
const userRoutes       = require('./routes/users');
const icalRoutes       = require('./routes/ical');
const clientRoutes     = require('./routes/crm/clients');
const contactRoutes    = require('./routes/crm/contacts');
const leadRoutes       = require('./routes/crm/leads');
const laundryRoutes    = require('./routes/laundry');
const invoiceRoutes    = require('./routes/invoices');
const { syncAllApartments }      = require('./services/icalSyncService');
const { processUpcomingBookings, processRecentlyEndedBookings } = require('./services/missionAutomationService');
dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',      authRoutes);
app.use('/api/apartments', apartmentRoutes);
app.use('/api/missions',   missionRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/ical',       icalRoutes);
app.use('/api/crm/clients', clientRoutes);
app.use('/api/crm/contacts', contactRoutes);
app.use('/api/crm/leads', leadRoutes);
app.use('/api/laundry', laundryRoutes);
app.use('/api/invoices', invoiceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

// Scheduler
function startMissionScheduler() {
  // 1) Sync iCal toutes les heures
  setInterval(async () => {
    try {
      await syncAllApartments();
    } catch (err) {
      console.error('Erreur sync iCal:', err);
    }
  }, 60 * 60 * 1000);

  // 2) Missions à venir (5j) toutes les 2h
  setInterval(async () => {
    try {
      console.log('📅 Planif. missions (5 jours)...');
      await processUpcomingBookings();
    } catch (err) {
      console.error('Erreur planif. missions (5 jours):', err);
    }
  }, 2 * 60 * 60 * 1000);

  // 3) Missions récentes (<24h) chaque 30min
  setInterval(async () => {
    try {
      console.log('🕒 Planif. missions (récentes)...');
      await processRecentlyEndedBookings();
    } catch (err) {
      console.error('Erreur planif. missions (récentes):', err);
    }
  }, 30 * 60 * 1000);

  // Exécution initiale après 30s
  setTimeout(async () => {
    try {
      await syncAllApartments();
      
      await processUpcomingBookings();
      await processRecentlyEndedBookings();
    } catch (err) {
      console.error('Erreur exécution initiale scheduler:', err);
    }
  }, 30000);
}

// Démarrage asynchrone
async function startServer() {
  try {
    // 1) Connexion à MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cleaning-app';
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // timeout plus tôt si pas accessible
    });
    console.log('✅ Connecté à MongoDB');

    // 2) Démarrage du serveur
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Serveur en cours d'exécution sur le port ${PORT}`);
      // 3) Lancement du scheduler
      startMissionScheduler();
    });
  } catch (error) {
    console.error('❌ Impossible de démarrer le serveur :', error);
    process.exit(1);
  }
}

startServer();
