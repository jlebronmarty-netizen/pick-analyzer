import DashboardShell from '@/components/dashboard/DashboardShell';
import NbaBoardAccess from '@/components/dashboard/NbaBoardAccess';
import NbaModelStatus from './model-status';
import NbaModelReport from './model-report';
export default function Layout({children}){
 return <DashboardShell>
  <section aria-label="Acceso al análisis NBA" className="mlb-ui mx-auto max-w-7xl rounded-2xl border border-slate-700 bg-slate-950 p-5 text-slate-200">
   <p className="text-sm text-slate-300">NBA · Archivo de cuotas e historial SHADOW</p>
   <NbaBoardAccess/>
  </section>
  <NbaModelStatus/><NbaModelReport/>{children}
 </DashboardShell>;
}
