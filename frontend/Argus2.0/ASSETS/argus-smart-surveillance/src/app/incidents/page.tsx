import IncidentHistory from '../../components/IncidentHistory';
import { Incident } from '../../types';
import { motion } from 'motion/react';

interface IncidentsPageProps {
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
}

export default function IncidentsPage({ incidents, onSelectIncident }: IncidentsPageProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col"
    >
      <IncidentHistory 
        incidents={incidents} 
        onSelect={onSelectIncident} 
      />
    </motion.div>
  );
}
