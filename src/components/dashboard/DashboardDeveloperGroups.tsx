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
const AiPerformanceCenterPanel = dynamic(() => import('@/components/dashboard/AiPerformanceCenterPanel'))
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
const SportsDataIoDiscoveryLabPanel = dynamic(() => import('@/components/dashboard/SportsDataIoDiscoveryLabPanel'))
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
const BasketballDataCoveragePanel = dynamic(() => import('@/components/dashboard/BasketballDataCoveragePanel'))
const BsnIntelligencePanel = dynamic(() => import('@/components/dashboard/BsnIntelligencePanel'))
const BsnPredictionPreviewPanel = dynamic(() => import('@/components/dashboard/BsnPredictionPreviewPanel'))
const BsnModelMaturityPanel = dynamic(() => import('@/components/dashboard/BsnModelMaturityPanel'))
const AdaptiveOperationsPanel = dynamic(() => import('@/components/dashboard/AdaptiveOperationsPanel'))
const OperationsHealthPanel = dynamic(() => import('@/components/dashboard/OperationsHealthPanel'))
const ProductionReadinessAuditPanel = dynamic(() => import('@/components/dashboard/ProductionReadinessAuditPanel'))
const MlbMarketExpansionRoadmapPanel = dynamic(() => import('@/components/dashboard/MlbMarketExpansionRoadmapPanel'))
const UniversalProjectionEnginePanel = dynamic(() => import('@/components/dashboard/UniversalProjectionEnginePanel'))
const MlbTemporalHealthPanel = dynamic(() => import('@/components/dashboard/MlbTemporalHealthPanel'))

export default function DashboardDeveloperGroups() {
  return (
    <DashboardSection
      id="advanced-details"
      eyebrow="Advanced Details"
      title="Advanced Details"
      description="Technical panels are grouped here and only load when opened."
    >
      <DeveloperDetails title="Overview" description="Daily briefing, operating day, next slate and recommendation readiness.">
        <ProductionReadinessAuditPanel />
        <DashboardQuickStats />
        <DashboardHeroPanel />
        <ProductionTodayPanel />
        <DailyReportPanel />
        <NextSlateStatusPanel />
        <RecommendationReadinessPanel />
        <OperatingDayPanel />
      </DeveloperDetails>

      <DeveloperDetails title="Markets" description="Market intelligence, opportunities, ticket state and AI command surfaces.">
        <MlbMarketExpansionRoadmapPanel />
        <MarketIntelligenceSummaryPanel />
        <MlbProspectivePreviewPanel />
        <PlayOfTheDayPanel />
        <TopPicksPanel />
        <BetSlipOptimizerPanel />
        <AICommandCenterPanel />
        <SharpMoneyIntelligencePanel />
        <ClosingLineIntelligencePanel />
        <LiveBettingEnginePanel />
      </DeveloperDetails>

      <DeveloperDetails title="Model" description="Model evidence, feature contracts, prediction safety and simulation tools.">
        <UniversalProjectionEnginePanel />
        <MlbPredictionEnginePanel />
        <PredictionEngineV4Panel />
        <ModelMetricsFrameworkPanel />
        <AiPerformanceCenterPanel />
        <MlbFeatureStoreIntegrationPanel />
        <SportPredictionSdkPanel />
        <PredictionSafetyPanel />
        <MonteCarloSimulatorPanel />
      </DeveloperDetails>

      <DeveloperDetails title="Historical" description="Historical import, replay and multi-sport feature infrastructure.">
        <HistoricalImportEnginePanel />
        <FeatureStoreCorePanel />
        <MultiSportFeatureRegistryPanel />
      </DeveloperDetails>

      <DeveloperDetails title="Data" description="Data quality, missing intelligence, runtime checks and sync reliability.">
        <OperationsHealthPanel />
        <MlbTemporalHealthPanel />
        <AdaptiveOperationsPanel />
        <MlbMissingIntelligencePanel />
        <RuntimeObservabilityPanel />
        <SyncReliabilityPanel />
        <GlobalDataQualityPanel />
        <BasketballDataCoveragePanel />
        <BsnIntelligencePanel />
        <BsnPredictionPreviewPanel />
        <BsnModelMaturityPanel />
        <MultiSportEnginePanel />
      </DeveloperDetails>

      <DeveloperDetails title="Provider" description="Provider intelligence, contracts, adapters and SportsDataIO readiness.">
        <ProviderIntelligencePanel />
        <ProviderAdapterSdkPanel />
        <SportsDataIoContractPanel />
        <SportsDataIoDiscoveryLabPanel />
      </DeveloperDetails>

      <DeveloperDetails title="Settlement" description="Settlement, portfolio and bankroll diagnostics.">
        <SettlementCorePanel />
        <PortfolioAIV2Panel />
        <PortfolioElitePanel />
      </DeveloperDetails>

      <DeveloperDetails title="Learning" description="AI coach, sports brain, pattern discovery and adaptive-weight diagnostics.">
        <AISportsBrainPanel />
        <AICoachPanel />
        <PatternDiscoveryPanel />
        <AdaptiveWeightsPanel />
      </DeveloperDetails>

      <DeveloperDetails title="Calibration" description="NBA validation and calibration modules remain collapsed outside User Mode.">
        <NbaAdapterPanel />
        <NbaDataSyncPanel />
        <NbaDataQualityPanel />
        <NbaFeatureStoreIntegrationPanel />
        <NbaMultiBookComparisonPanel />
        <NbaSteamMovePanel />
        <NbaPredictionEnginePanel />
        <NbaBacktestingCalibrationPanel />
      </DeveloperDetails>

      <DeveloperDetails title="Administration" description="Inactive sport engines, model versions, rollback and tuning controls.">
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
        <ModelVersionsPanel />
        <ModelRollbackPanel />
        <AutoModelTuningPanel />
      </DeveloperDetails>
    </DashboardSection>
  )
}
