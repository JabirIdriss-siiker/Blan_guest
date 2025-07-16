// scripts/testIcal.js
const ical = require('node-ical');
const ICAL_URL = 'https://www.airbnb.fr/calendar/ical/1347827447875416650.ics?s=2e1cbcc7d7d515004efa6a6851160351';

async function testIcal() {
  try {
    console.log(`🔄 Récupération du flux iCal depuis : ${ICAL_URL}\n`);
    const data = await ical.async.fromURL(ICAL_URL);

    const events = Object.values(data)
      .filter(item => item.type === 'VEVENT' && item.start && item.end)
      .map(item => ({
        uid:     item.uid,
        start:   item.start.toISOString().slice(0,10),
        end:     item.end.toISOString().slice(0,10),
        summary: item.summary || '—'
      }));

    if (events.length === 0) {
      console.log('⚠️ Aucun événement VEVENT trouvé dans le flux.');
    } else {
      console.log(`✅ ${events.length} événements trouvés :\n`);
      for (const ev of events) {
        console.log(
          `• UID: ${ev.uid}\n  Du ${ev.start} au ${ev.end}\n  "${ev.summary}"\n`
        );
      }
    }
  } catch (err) {
    console.error('❌ Erreur lors du parsing iCal :', err.message);
  }
}

testIcal();
