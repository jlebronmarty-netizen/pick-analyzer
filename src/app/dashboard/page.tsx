import { ReactNode } from 'react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import DashboardSection from '@/components/dashboard/DashboardSection'
import DashboardQuickStats from '@/components/dashboard/DashboardQuickStats'

import DashboardHeroPanel from '@/components/dashboard/DashboardHeroPanel'
import AICommandCenterPanel from '@/components/dashboard/AICommandCenterPanel'
import DailyReportPanel from '@/components/dashboard/DailyReportPanel'
import TopPicksPanel from '@/components/dashboard/TopPicksPanel'
import PlayOfTheDayPanel from '@/components/dashboard/PlayOfTheDayPanel'
import PredictionEngineV4Panel from '@/components/dashboard/PredictionEngineV4Panel'
import SportPredictionSdkPanel from '@/components/dashboard/SportPredictionSdkPanel'
import PredictionSafetyPanel from '@/components/dashboard/PredictionSafetyPanel'
import SettlementCorePanel from '@/components/dashboard/SettlementCorePanel'
import BetSlipOptimizerPanel from '@/components/dashboard/BetSlipOptimizerPanel'
import MonteCarloSimulatorPanel from '@/components/dashboard/MonteCarloSimulatorPanel'
import SharpMoneyIntelligencePanel from '@/components/dashboard/SharpMoneyIntelligencePanel'
import LiveBettingEnginePanel from '@/components/dashboard/LiveBettingEnginePanel'
import PortfolioElitePanel from '@/components/dashboard/PortfolioElitePanel'
import PatternDiscoveryPanel from '@/components/dashboard/PatternDiscoveryPanel'
import AdaptiveWeightsPanel from '@/components/dashboard/AdaptiveWeightsPanel'
import ModelVersionsPanel from '@/components/dashboard/ModelVersionsPanel'
import ModelRollbackPanel from '@/components/dashboard/ModelRollbackPanel'
import AutoModelTuningPanel from '@/components/dashboard/AutoModelTuningPanel'
import RuntimeObservabilityPanel from '@/components/dashboard/RuntimeObservabilityPanel'
import SyncReliabilityPanel from '@/components/dashboard/SyncReliabilityPanel'
import ModelMetricsFrameworkPanel from '@/components/dashboard/ModelMetricsFrameworkPanel'
import MultiSportEnginePanel from '@/components/dashboard/MultiSportEnginePanel'
import ProviderIntelligencePanel from '@/components/dashboard/ProviderIntelligencePanel'
import HistoricalImportEnginePanel from '@/components/dashboard/HistoricalImportEnginePanel'
import ProviderAdapterSdkPanel from '@/components/dashboard/ProviderAdapterSdkPanel'
import SportsDataIoContractPanel from '@/components/dashboard/SportsDataIoContractPanel'
import FeatureStoreCorePanel from '@/components/dashboard/FeatureStoreCorePanel'
import MultiSportFeatureRegistryPanel from '@/components/dashboard/MultiSportFeatureRegistryPanel'
import MlbFeatureStoreIntegrationPanel from '@/components/dashboard/MlbFeatureStoreIntegrationPanel'
import MlbPredictionEnginePanel from '@/components/dashboard/MlbPredictionEnginePanel'
import NflFeatureStoreIntegrationPanel from '@/components/dashboard/NflFeatureStoreIntegrationPanel'
import NflPredictionEnginePanel from '@/components/dashboard/NflPredictionEnginePanel'
import SoccerFeatureStoreIntegrationPanel from '@/components/dashboard/SoccerFeatureStoreIntegrationPanel'
import SoccerPredictionEnginePanel from '@/components/dashboard/SoccerPredictionEnginePanel'
import NhlFeatureStoreIntegrationPanel from '@/components/dashboard/NhlFeatureStoreIntegrationPanel'
import NhlPredictionEnginePanel from '@/components/dashboard/NhlPredictionEnginePanel'
import TennisFeatureStoreIntegrationPanel from '@/components/dashboard/TennisFeatureStoreIntegrationPanel'
import TennisPredictionEnginePanel from '@/components/dashboard/TennisPredictionEnginePanel'
import UfcFeatureStoreIntegrationPanel from '@/components/dashboard/UfcFeatureStoreIntegrationPanel'
import UfcPredictionEnginePanel from '@/components/dashboard/UfcPredictionEnginePanel'
import GlobalDataQualityPanel from '@/components/dashboard/GlobalDataQualityPanel'
import AISportsBrainPanel from '@/components/dashboard/AISportsBrainPanel'
import ClosingLineIntelligencePanel from '@/components/dashboard/ClosingLineIntelligencePanel'
import PortfolioAIV2Panel from '@/components/dashboard/PortfolioAIV2Panel'
import AICoachPanel from '@/components/dashboard/AICoachPanel'
import NbaAdapterPanel from '@/components/dashboard/NbaAdapterPanel'
import NbaDataSyncPanel from '@/components/dashboard/NbaDataSyncPanel'
import NbaPredictionEnginePanel from '@/components/dashboard/NbaPredictionEnginePanel'
import NbaBacktestingCalibrationPanel from '@/components/dashboard/NbaBacktestingCalibrationPanel'
import NbaDataQualityPanel from '@/components/dashboard/NbaDataQualityPanel'
import NbaFeatureStoreIntegrationPanel from '@/components/dashboard/NbaFeatureStoreIntegrationPanel'
import NbaMultiBookComparisonPanel from '@/components/dashboard/NbaMultiBookComparisonPanel'
import NbaSteamMovePanel from '@/components/dashboard/NbaSteamMovePanel'

function DashboardPanelGroup({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <details className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black text-white">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              {description}
            </p>
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
            Expand
          </span>
        </div>
      </summary>

      <div className="mt-5 space-y-5">{children}</div>
    </details>
  )
}

export default function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardSection
        id="overview"
        eyebrow="Overview"
        title="Command Center"
        description="Main AI recommendation, model status and best current opportunity."
      >
        <DashboardQuickStats />
        <DashboardHeroPanel />
      </DashboardSection>

      <DashboardSection
        id="today"
        eyebrow="Today"
        title="MLB Day 1 Workspace"
        description="Current recommendation state, daily report, preview readiness and official pick gates."
      >
        <DailyReportPanel />
        <PlayOfTheDayPanel />
        <TopPicksPanel />
        <BetSlipOptimizerPanel />
        <AICommandCenterPanel />
      </DashboardSection>

      <DashboardSection
        id="model-lab"
        eyebrow="Model Lab"
        title="Historical Validation"
        description="Quarantined MLB replay, feature quality, prediction contracts, calibration and settlement evidence."
      >
        <MlbPredictionEnginePanel />
        <MlbFeatureStoreIntegrationPanel />
        <PredictionEngineV4Panel />
        <SportPredictionSdkPanel />
        <PredictionSafetyPanel />
        <SettlementCorePanel />
        <ModelMetricsFrameworkPanel />

        <DashboardPanelGroup
          title="Advanced model tools"
          description="Risk simulation, portfolio construction, market intelligence, coaching and learning modules stay available but are not the default Day 1 path."
        >
          <MonteCarloSimulatorPanel />
          <PortfolioAIV2Panel />
          <PortfolioElitePanel />
          <SharpMoneyIntelligencePanel />
          <ClosingLineIntelligencePanel />
          <LiveBettingEnginePanel />
          <AISportsBrainPanel />
          <AICoachPanel />
          <PatternDiscoveryPanel />
          <AdaptiveWeightsPanel />
        </DashboardPanelGroup>
      </DashboardSection>

      <DashboardSection
        id="data-operations"
        eyebrow="Data"
        title="Data & Operations"
        description="Provider status, sync jobs, historical imports, runtime health, checkpoints and data quality."
      >
        <HistoricalImportEnginePanel />
        <RuntimeObservabilityPanel />
        <SyncReliabilityPanel />
        <GlobalDataQualityPanel />
        <ProviderIntelligencePanel />
        <MultiSportEnginePanel />
      </DashboardSection>

      <DashboardSection
        id="advanced"
        eyebrow="Advanced"
        title="Developer & Inactive Domains"
        description="Detailed contracts, migrations, NBA readiness and non-MLB sport modules."
      >
        <DashboardPanelGroup
          title="Provider contracts and feature registries"
          description="Static contracts and deterministic validation surfaces for future provider work."
        >
          <ProviderAdapterSdkPanel />
          <SportsDataIoContractPanel />
          <FeatureStoreCorePanel />
          <MultiSportFeatureRegistryPanel />
        </DashboardPanelGroup>

        <DashboardPanelGroup
          title="NBA operational readiness"
          description="NBA integration evidence remains available without dominating the MLB Day 1 dashboard."
        >
          <NbaAdapterPanel />
          <NbaDataSyncPanel />
          <NbaDataQualityPanel />
          <NbaFeatureStoreIntegrationPanel />
          <NbaMultiBookComparisonPanel />
          <NbaSteamMovePanel />
          <NbaPredictionEnginePanel />
          <NbaBacktestingCalibrationPanel />
        </DashboardPanelGroup>

        <DashboardPanelGroup
          title="Inactive sport engines"
          description="Provider-independent modules for other sports stay collapsed until real data validation is active."
        >
          <NflFeatureStoreIntegrationPanel />
          <NflPredictionEnginePanel />
          <SoccerFeatureStoreIntegrationPanel />
          <SoccerPredictionEnginePanel />
          <NhlFeatureStoreIntegrationPanel />
          <NhlPredictionEnginePanel />
          <TennisFeatureStoreIntegrationPanel />
          <TennisPredictionEnginePanel />
          <UfcFeatureStoreIntegrationPanel />
          <UfcPredictionEnginePanel />
        </DashboardPanelGroup>

        <DashboardPanelGroup
          title="Model administration"
          description="Versioning, rollback and tuning controls remain accessible for maintenance."
        >
          <ModelVersionsPanel />
          <ModelRollbackPanel />
          <AutoModelTuningPanel />
        </DashboardPanelGroup>
      </DashboardSection>
    </DashboardShell>
  )
}
