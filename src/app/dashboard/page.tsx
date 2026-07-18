import { ReactNode } from 'react'
import DashboardShell from '@/components/dashboard/DashboardShell'
import DashboardSection from '@/components/dashboard/DashboardSection'
import DashboardQuickStats from '@/components/dashboard/DashboardQuickStats'
import DeveloperDetails from '@/components/dashboard/DeveloperDetails'

import DashboardHeroPanel from '@/components/dashboard/DashboardHeroPanel'
import ProductionTodayPanel from '@/components/dashboard/ProductionTodayPanel'
import ProductTodayPanel from '@/components/dashboard/ProductTodayPanel'
import AICommandCenterPanel from '@/components/dashboard/AICommandCenterPanel'
import DailyReportPanel from '@/components/dashboard/DailyReportPanel'
import MarketIntelligenceSummaryPanel from '@/components/dashboard/MarketIntelligenceSummaryPanel'
import RecommendationReadinessPanel from '@/components/dashboard/RecommendationReadinessPanel'
import OperatingDayPanel from '@/components/dashboard/OperatingDayPanel'
import NextSlateStatusPanel from '@/components/dashboard/NextSlateStatusPanel'
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
import MlbProspectivePreviewPanel from '@/components/dashboard/MlbProspectivePreviewPanel'
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
    <DeveloperDetails title={title} description={description}>
      {children}
    </DeveloperDetails>
  )
}

export default function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardSection
        id="today"
        eyebrow="Today"
        title="Should I Bet Today?"
        description="A concise AI briefing, current MLB board, daily timeline and system health."
      >
        <ProductTodayPanel />
      </DashboardSection>

      <DashboardSection
        id="overview"
        eyebrow="Developer Mode"
        title="Legacy Overview"
        description="Detailed historical widgets and internal views are available for maintenance."
      >
        <DashboardPanelGroup
          title="Developer Mode"
          description="Raw model, daily report and operating-day diagnostics."
        >
          <DashboardQuickStats />
          <DashboardHeroPanel />
          <ProductionTodayPanel />
          <DailyReportPanel />
          <NextSlateStatusPanel />
          <MarketIntelligenceSummaryPanel />
          <RecommendationReadinessPanel />
          <OperatingDayPanel />
          <MlbProspectivePreviewPanel />
          <PlayOfTheDayPanel />
          <TopPicksPanel />
          <BetSlipOptimizerPanel />
          <AICommandCenterPanel />
        </DashboardPanelGroup>
      </DashboardSection>

      <DashboardSection
        id="model-lab"
        eyebrow="Developer Mode"
        title="Model Lab"
        description="Advanced model evidence, contracts and simulations."
      >
        <DashboardPanelGroup
          title="Historical Replay"
          description="Quarantined completed-game replay for learning only; it is separate from production and current previews."
        >
          <MlbPredictionEnginePanel />
        </DashboardPanelGroup>

        <DashboardPanelGroup
          title="Current Preview"
          description="Current preview evidence stays in Today. This section keeps model context visible without promoting official picks."
        >
          <PredictionEngineV4Panel />
          <ModelMetricsFrameworkPanel />
        </DashboardPanelGroup>

        <DashboardPanelGroup
          title="Feature Store"
          description="Feature quality and sufficiency checks for MLB model inputs."
        >
          <MlbFeatureStoreIntegrationPanel />
        </DashboardPanelGroup>

        <DashboardPanelGroup
          title="Contracts"
          description="Prediction contracts, safety checks and settlement contracts."
        >
          <SportPredictionSdkPanel />
          <PredictionSafetyPanel />
          <SettlementCorePanel />
        </DashboardPanelGroup>

        <DashboardPanelGroup
          title="Production and advanced model tools"
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
        eyebrow="Developer Mode"
        title="Data & Operations"
        description="Provider, sync and runtime diagnostics."
      >
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['System', 'Healthy'],
            ['Provider Calls', '0 in this view'],
            ['Official Picks', 'Off'],
            ['Imported MLB Data', 'Available'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        <DashboardPanelGroup
          title="Engineering details"
          description="Sync jobs, provider health, runtime checks, data quality and route contracts."
        >
          <HistoricalImportEnginePanel />
          <RuntimeObservabilityPanel />
          <SyncReliabilityPanel />
          <GlobalDataQualityPanel />
          <ProviderIntelligencePanel />
          <MultiSportEnginePanel />
        </DashboardPanelGroup>
      </DashboardSection>

      <DashboardSection
        id="advanced"
        eyebrow="Developer Mode"
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
