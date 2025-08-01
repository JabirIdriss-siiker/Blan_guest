const LaundryTask = require('../models/LaundryTask');
const User = require('../models/User');
const Mission = require('../models/Mission');
const Apartment = require('../models/Apartment');

// Cache for laundry staff to avoid repeated queries
let laundryStaffCache = null;
let cacheExpiry = 0;

// Get available laundry staff with round-robin assignment
async function getAvailableLaundryStaff() {
  const now = Date.now();
  
  // Use cache for 5 minutes
  if (!laundryStaffCache || now > cacheExpiry) {
    laundryStaffCache = await User.find({ 
       role: { $in: ['Blanchisserie', 'Staff de ménage'] }, 
      isActive: true 
    }).lean();
    cacheExpiry = now + 5 * 60 * 1000; // 5 minutes
  }
  
  if (laundryStaffCache.length === 0) {
    throw new Error('Aucun personnel de blanchisserie disponible');
  }
  
  // Simple round-robin based on current time
  const index = Math.floor(now / 1000) % laundryStaffCache.length;
  return laundryStaffCache[index];
}

// Create laundry task for a mission
async function createLaundryTaskForMission(mission, apartment, createdBy) {
  console.log(`🧺 Création tâche blanchisserie pour mission ${mission._id}`);

  // Skip if no default laundry bag configured
  if (!apartment.defaultLaundryBag || apartment.defaultLaundryBag.length === 0) {
    console.log(`  ↩️ Pas de sac blanchisserie par défaut pour ${apartment.name}`);
    return null;
  }

  // Schedule laundry task for the day before mission starts
  const missionStart = new Date(mission.dateDebut);
  const laundryDate = new Date(missionStart);
  laundryDate.setDate(laundryDate.getDate() - 1);
  laundryDate.setHours(10, 0, 0, 0); // 10:00 AM

  // Check for existing task (prevent duplicates)
  const existingTask = await LaundryTask.findOne({
    apartment: apartment._id,
    scheduledAt: laundryDate,
    autoGenerated: true,
  });

  if (existingTask) {
    console.log(`  ↩️ Tâche blanchisserie existe déjà pour ${apartment.name} le ${laundryDate.toISOString()}`);
    return existingTask;
  }

  // Get available staff
  const assignedStaff = await getAvailableLaundryStaff();

  // Create laundry task
  const laundryTask = new LaundryTask({
    apartment: apartment._id,
    scheduledAt: laundryDate,
    items: apartment.defaultLaundryBag.map(item => ({
      label: item.label,
      qty: item.qty,
    })),
    assignedTo: assignedStaff._id,
    autoGenerated: true,
    notes: `Préparation automatique pour mission: ${mission.title}`,
    createdBy: createdBy._id,
  });

  await laundryTask.save();
  console.log(`✅ Tâche blanchisserie créée [${laundryTask._id}] assignée à ${assignedStaff.firstName} ${assignedStaff.lastName}`);
  
  return laundryTask;
}

// Create laundry tasks for new missions
async function createLaundryTasksForNewMissions() {
  console.log('🧺 Création des tâches de blanchisserie pour les nouvelles missions...');

  try {
    // Get recent auto-generated missions (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMissions = await Mission.find({
      'metadata.autoGenerated': true,
      createdAt: { $gte: yesterday },
    }).populate('apartment').lean();

    console.log(`  → ${recentMissions.length} missions récentes trouvées`);

    if (recentMissions.length === 0) return [];

    // Get admin user for createdBy
    const admin = await User.findOne({ role: 'Admin' }).sort({ createdAt: 1 }).lean();
    if (!admin) {
      throw new Error('Aucun administrateur trouvé');
    }

    // Process missions in batches
    const results = [];
    const batchSize = 5;

    for (let i = 0; i < recentMissions.length; i += batchSize) {
      const batch = recentMissions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (mission) => {
        try {
          if (!mission.apartment) {
            console.log(`  ⚠️ Mission ${mission._id} sans appartement`);
            return { missionId: mission._id, success: false, error: 'Appartement manquant' };
          }

          const laundryTask = await createLaundryTaskForMission(mission, mission.apartment, admin);
          return { 
            missionId: mission._id, 
            laundryTaskId: laundryTask?._id, 
            success: true,
            created: !!laundryTask 
          };
        } catch (err) {
          console.error(`  ✖️ Erreur mission ${mission._id}:`, err.message);
          return { missionId: mission._id, success: false, error: err.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successful = results.filter(r => r.success && r.created).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Tâches blanchisserie: ${successful} créées, ${failed} échecs`);
    return results;

  } catch (error) {
    console.error('❌ Erreur création tâches blanchisserie:', error);
    throw error;
  }
}

// Clear cache (useful for tests)
function clearCache() {
  laundryStaffCache = null;
  cacheExpiry = 0;
}

module.exports = {
  createLaundryTaskForMission,
  createLaundryTasksForNewMissions,
  getAvailableLaundryStaff,
  clearCache,
};