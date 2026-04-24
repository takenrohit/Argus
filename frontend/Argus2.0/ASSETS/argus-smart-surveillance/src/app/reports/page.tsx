import ReportsPanel from '../../components/ReportsPanel';
import { Incident } from '../../types';
import { motion } from 'motion/react';

interface ReportsPageProps {
  incidents: Incident[];
  onSelect: (incident: Incident) => void;
}

export default function ReportsPage({ incidents, onSelect }: ReportsPageProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col"
    >
      <ReportsPanel incidents={incidents} onSelect={onSelect} />
    </motion.div>
  );
}
