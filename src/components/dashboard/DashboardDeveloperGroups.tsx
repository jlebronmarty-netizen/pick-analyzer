'use client'

import dynamic from 'next/dynamic'
import DashboardSection from '@/components/dashboard/DashboardSection'
import DeveloperDetails from '@/components/dashboard/DeveloperDetails'

const DashboardQuickStats = dynamic(() => import('@/components/dashboard/DashboardQuickStats'))
const DashboardHeroPanel = dynamic(() => import('@/components/dashboard/DashboardHeroPanel'))
const ProductionTodayPanel = dynamic(() => import('@/components/dashboard/ProductionTodayPanel'))
const DailyReportPanel = dynamic(() => import('@/components/dashboard/DailyReportPanel'))
const NextSlateStatusPanel = dynamic(() => import('@/components/dashboard/NextSlateStatusPanel'))
const MarketIntelligenceSummaryPanel = dynamic(() => import('@/components/dashboard/MarketIntelligenceSummaryPanel'))
const RecommendationReadinessPanel = dynamic(() => import('@/components/dashboard/RecommendationReadinessPanel'))
const OperatingDayPanel = dynamic(() => import('@/components/dashboard/OperatingDayPanel'))
const MlbProspectivePreviewPanel = dynamic(() => import('@/components/dashboard/MlbProspectivePreviewPanel'))
const PlayOfTheDayPanel = dynamic(() => import('@/components/dashboard/PlayOfTheDayPanel'))
const TopPicksPanel = dynamic(() => import('@/components/dashboard/TopPicksPanel'))
const BetSlipOptimizerPanel = dynamic(() => import('@/components/dashboard/BetSlipOptimizerPanel'))
const AICommandCenterPanel = dynamic(() => import('@/components/dashboard/AICommandCenterPanel'))
const MlbPredictionEnginePanel = dynamic(() => import('@/components/dashboard/MlbPredictionEnginePanel'))
const PredictionEngineV4Panel = dynamic(() => import('@/components/dashboard/PredictionEngineV4Panel'))
const ModelMetricsFrameworkPanel = dynamic(() => import('@/components/dashboard/ModelMetricsFrameworkPanel'))
const MlbFeatureStoreIntegrationPanel = dynamic(() => import('@/components/dashboard/MlbFeatureStoreIntegrationPanel'))
const SportPredictionSdkPanel = dynamic(() => import('@/components/dashboard/SportPredictionSdkPanel'))
const PredictionSafetyPanel = dynamic(() => import('@/components/dashboard/PredictionSafetyPanel'))
const SettlementCorePanel = dynamic(() => import('@/components/dashboard/SettlementCorePanel'))
const MonteCarloSimulatorPanel = dynamic(() => import('@/components/dashboard/MonteCarloSimulatorPanel'))
const PortfolioAIV2Panel = dynamic(() => import('@/components/dashboard/PortfolioAIV2Panel'))
const PortfolioElitePanel = dynamic(() => import('@/components/dashboard/PortfolioElitePanel'))
const SharpMoneyIntelligencePanel = dynamic(() => import('@/components/dashboard/SharpMoneyIntelligencePanel'))
const ClosingLineIntelligencePanel = dynamic(() => import('@/components/dashboard/ClosingLineIntelligencePanel'))
const LiveBettingEnginePanel = dynamic(() => import('@/components/dashboard/LiveBettingEnginePanel'))
const AISportsBrainPanel = dynamic(() => import('@/components/dashboard/AISportsBrainPanel'))
const AICoachPanel = dynamic(() => import('@/components/dashboard/AICoachPanel'))
const PatternDiscoveryPanel = dynamic(() => import('@/components/dashboard/PatternDiscoveryPanel'))
const AdaptiveWeightsPanel = dynamic(() => import('@/components/dashboard/AdaptiveWeightsPanel'))
const MlbMissingIntelligencePanel = dynamic(() => import('@/components/dashboard/MlbMissingIntelligencePanel'))
const HistoricalImportEnginePanel = dynamic(() => import('@/components/dashboard/HistoricalImportEnginePanel'))
const RuntimeObservabilityPanel = dynamic(() => import('@/components/dashboard/RuntimeObservabilityPanel'))
const SyncReliabilityPanel = dynamic(() => import('@/components/dashboard/SyncReliabilityPanel'))
const GlobalDataQualityPanel = dynamic(() => import('@/components/dashboard/GlobalDataQualityPanel'))
const ProviderIntelligencePanel = dynamic(() => import('@/components/dashboard/ProviderIntelligencePanel'))
const MultiSportEnginePanel = dynamic(() => import('@/components/dashboard/MultiSportEnginePanel'))
const ProviderAdapterSdkPanel = dynamic(() => import('@/components/dashboard/ProviderAdapterSdkPanel'))
const SportsDataIoContractPanel = dynamic(() => import('@/components/dashboard/SportsDataIoContractPanel'))
const FeatureStoreCorePanel = dynamic(() => import('@/components/dashboard/FeatureStoreCorePanel'))
const MultiSportFeatureRegistryPanel = dynamic(() => import('@/components/dashboard/MultiSportFeatureRegistryPanel'))
const NbaAdapterPanel = dynamic(() => import('@/components/dashboard/NbaAdapterPanel'))
const NbaDataSyncPanel = dynamic(() => import('@/components/dashboard/NbaDataSyncPanel'))
const NbaDataQualityPanel = dynamic(() => import('@/components/dashboard/NbaDataQualityPanel'))
const NbaFeatureStoreIntegrationPanel = dynamic(() => import('@/components/dashboard/NbaFeatureStoreIntegrationPanel'))
const NbaMultiBookComparisonPanel = dynamic(() => import('@/components/dashboard/NbaMultiBookComparisonPanel'))
const NbaSteamMovePanel = dynamic(() => import('@/components/dashboard/NbaSteamMovePanel'))
const NbaPredictionEnginePanel = dynamic(() => import('@/components/dashboard/NbaPredictionEnginePanel'))
const NbaBacktestingCalibrationPanel = dynamic(() => import('@/components/dashboard/NbaBacktestingCalibrationPanel'))
const NflFeatureStoreIntegrationPanel = dynamic(() => import('@/components/dashboard/NflFeatureStoreIntegrationPanel'))
const NflPredictionEnginePanel = dynamic(() => import('@/components/dashboard/NflPredictionEnginePanel'))
const SoccerFeatureStoreIntegrationPanel = dynamic(() => import('@/components/dashboard/SoccerFeatureStoreIntegrationPanel'))
const SoccerPredictionEnginePanel = dynamic(() => import('@/components/dashboard/SoccerPredictionEnginePanel'))
const NhlFeatureStoreIntegrationPanel = dynamic(() => import('@/components/dashboard/NhlFeatureStoreIntegrationPanel'))
const NhlPredictionEnginePanel = dynamic(() => import('@/components/dashboard/NhlPredictionEnginePanel'))
const TennisFeatureStoreIntegrationPanel = dynamic(() => import('@/components/dashboard/TennisFeatureStoreIntegrationPanel'))
const TennisPredictionEnginePanel = dynamic(() => import('@/components/dashboard/TennisPredictionEnginePanel'))
const UfcFeatureStoreIntegrationPanel = dynamic(() => import('@/components/dashboard/UfcFeatureStoreIntegrationPanel'))
const UfcPredictionEnginePanel = dynamic(() => import('@/components/dashboard/UfcPredictionEnginePanel'))
const ModelVersionsPanel = dynamic(() => import('@/components/dashboard/ModelVersionsPanel'))
const ModelRollbackPanel = dynamic(() => import('@/components/dashboard/ModelRollbackPanel'))
const AutoModelTuningPanel = dynamic(() => import('@/components/dashboard/AutoModelTuningPanel'))

export default function DashboardDeveloperGroups() {
  return (
    <>
      <DashboardSection
        id="overview"
        eyebrow="Developer Mode"
        title="Advanced Overview"
        description="Detailed historical widgets and internal views stay collapsed until opened."
      >
        <DeveloperDetails title="Overview diagnostics" description="Raw model, daily report and operating-day diagnostics.">
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
        </DeveloperDetails>
      </DashboardSection>

      <DashboardSection id="model-lab" eyebrow="Developer Mode" title="Model Lab" description="Advanced model evidence, contracts and simulations.">
        <DeveloperDetails title="Historical replay" description="Quarantined completed-game replay for learning only.">
          <MlbPredictionEnginePanel />
        </DeveloperDetails>
        <DeveloperDetails title="Current preview" description="Model context without official-pick promotion.">
          <PredictionEngineV4Panel />
          <ModelMetricsFrameworkPanel />
        </DeveloperDetails>
        <DeveloperDetails title="Feature store" description="Feature quality and sufficiency checks for MLB model inputs.">
          <MlbFeatureStoreIntegrationPanel />
        </DeveloperDetails>
        <DeveloperDetails title="Contracts" description="Prediction contracts, safety checks and settlement contracts.">
          <SportPredictionSdkPanel />
          <PredictionSafetyPanel />
          <SettlementCorePanel />
        </DeveloperDetails>
        <DeveloperDetails title="Advanced tools" description="Risk simulation, portfolios, market intelligence and coaching modules.">
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
        </DeveloperDetails>
      </DashboardSection>

      <DashboardSection id="data-operations" eyebrow="Developer Mode" title="Data & Operations" description="Provider, sync and runtime diagnostics.">
        <DeveloperDetails title="Engineering details" description="Sync jobs, provider health, runtime checks, data quality and route contracts.">
          <MlbMissingIntelligencePanel />
          <HistoricalImportEnginePanel />
          <RuntimeObservabilityPanel />
          <SyncReliabilityPanel />
          <GlobalDataQualityPanel />
          <ProviderIntelligencePanel />
          <MultiSportEnginePanel />
        </DeveloperDetails>
      </DashboardSection>

      <DashboardSection id="advanced" eyebrow="Developer Mode" title="Developer & Inactive Domains" description="Detailed contracts, NBA readiness and inactive modules.">
        <DeveloperDetails title="Provider contracts and registries" description="Static contracts and deterministic validation surfaces.">
          <ProviderAdapterSdkPanel />
          <SportsDataIoContractPanel />
          <FeatureStoreCorePanel />
          <MultiSportFeatureRegistryPanel />
        </DeveloperDetails>
        <DeveloperDetails title="NBA operational readiness" description="NBA evidence remains collapsed outside the MLB Today path.">
          <NbaAdapterPanel />
          <NbaDataSyncPanel />
          <NbaDataQualityPanel />
          <NbaFeatureStoreIntegrationPanel />
          <NbaMultiBookComparisonPanel />
          <NbaSteamMovePanel />
          <NbaPredictionEnginePanel />
          <NbaBacktestingCalibrationPanel />
        </DeveloperDetails>
        <DeveloperDetails title="Inactive sport engines" description="Other sport modules stay collapsed until real data validation is active.">
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
        </DeveloperDetails>
        <DeveloperDetails title="Model administration" description="Versioning, rollback and tuning controls.">
          <ModelVersionsPanel />
          <ModelRollbackPanel />
          <AutoModelTuningPanel />
        </DeveloperDetails>
      </DashboardSection>
    </>
  )
}
