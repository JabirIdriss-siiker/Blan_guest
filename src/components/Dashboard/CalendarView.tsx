import React, { useState, useEffect, useRef } from 'react';
import FullCalendar, {
  EventInput,
  EventDropArg,
  EventClickArg
} from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';

interface Mission {
  _id: string;
  title: string;
  apartment: { 
    name: string;
    address: string;
  };
  dateDebut: string;
  dateFin: string;
  status: 'En attente' | 'En cours' | 'Terminé' | 'Problème';
  assignedTo: {
    firstName: string;
    lastName: string;
  };
}

const statusColors: Record<string, { bg: string; border: string }> = {
  'En attente': { bg: '#64748b', border: '#475569' }, // slate-500, slate-600
  'En cours': { bg: '#475569', border: '#334155' },   // slate-600, slate-700
  'Terminé': { bg: '#334155', border: '#1e293b' },    // slate-700, slate-800
  'Problème': { bg: '#dc2626', border: '#b91c1c' }    // red-600, red-700
};

const CalendarView: React.FC = () => {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    try {
      setError('');
      const response = await axios.get<Mission[]>('/missions');
      
      const calendarEvents: EventInput[] = response.data.map(mission => ({
        id: mission._id,
        title: `${mission.apartment.address} – ${mission.status}`,
        start: mission.dateDebut,
        end: mission.dateFin,
        backgroundColor: statusColors[mission.status]?.bg || '#64748b',
        borderColor: statusColors[mission.status]?.border || '#475569',
        extendedProps: {
          mission: mission
        }
      }));

      setEvents(calendarEvents);
    } catch (error: any) {
      console.error('Erreur lors du chargement des missions:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement des missions');
    } finally {
      setLoading(false);
    }
  };

  const handleEventDrop = async (info: EventDropArg) => {
    const missionId = info.event.id;
    const newStart = info.event.start?.toISOString();
    const newEnd = info.event.end?.toISOString();

    if (!newStart || !newEnd) {
      info.revert();
      return;
    }

    try {
      await axios.put(`/missions/${missionId}`, {
        dateDebut: newStart,
        dateFin: newEnd
      });
      
      console.log(`Mission ${missionId} reprogrammée avec succès`);
    } catch (error: any) {
      console.error('Erreur lors de la reprogrammation:', error);
      info.revert();
      alert(error.response?.data?.message || 'Erreur lors de la reprogrammation de la mission');
    }
  };

  const handleEventClick = (info: EventClickArg) => {
    const mission = info.event.extendedProps.mission as Mission;
    
    // Create a simple info popup
    const details = [
      `Mission: ${mission.title}`,
      `Appartement: ${mission.apartment.name}`,
      `Adresse: ${mission.apartment.address}`,
      `Statut: ${mission.status}`,
      `Assigné à: ${mission.assignedTo.firstName} ${mission.assignedTo.lastName}`,
      `Début: ${new Date(mission.dateDebut).toLocaleString('fr-FR')}`,
      `Fin: ${new Date(mission.dateFin).toLocaleString('fr-FR')}`
    ].join('\n');

    alert(details);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={loadMissions}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listWeek'
        }}
        editable={true}
        droppable={true}
        events={events}
        eventDrop={handleEventDrop}
        eventClick={handleEventClick}
        height="auto"
        locale="fr"
        buttonText={{
          today: "Aujourd'hui",
          month: 'Mois',
          week: 'Semaine',
          list: 'Liste'
        }}
        dayHeaderFormat={{ weekday: 'short' }}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }}
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }}
        allDaySlot={false}
        eventDisplay="block"
        dayMaxEvents={3}
        moreLinkText="plus"
        eventMouseEnter={(info) => {
          info.el.style.cursor = 'pointer';
        }}
        eventDidMount={(info) => {
          // Add tooltip on hover
          const mission = info.event.extendedProps.mission as Mission;
          info.el.title = `${mission.title}\nStatut: ${mission.status}\nAssigné à: ${mission.assignedTo.firstName} ${mission.assignedTo.lastName}`;
        }}
      />
    </div>
  );
};

export default CalendarView;