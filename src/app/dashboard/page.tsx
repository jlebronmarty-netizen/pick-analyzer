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
        <AICommandCenterPanel />
      </DashboardSection>

      <DashboardSection
        id="multi-sport"
        eyebrow="Sports"
        title="Multi-Sport Coverage"
        description="Select a sport and view only real predictions currently available for that league."
      >
        <MultiSportEnginePanel />
        <ProviderIntelligencePanel />
        <ProviderAdapterSdkPanel />
        <SportsDataIoContractPanel />
        <HistoricalImportEnginePanel />
        <FeatureStoreCorePanel />
        <MultiSportFeatureRegistryPanel />
        <MlbFeatureStoreIntegrationPanel />
        <MlbPredictionEnginePanel />
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
        <GlobalDataQualityPanel />
      </DashboardSection>

      <DashboardSection
        id="nba-adapter"
        eyebrow="NBA"
        title="NBA Adapter"
        description="NBA team intelligence, data coverage and production-readiness monitoring."
      >
        <NbaAdapterPanel />
        <NbaDataSyncPanel />
        <NbaDataQualityPanel />
        <NbaFeatureStoreIntegrationPanel />
        <NbaMultiBookComparisonPanel />
        <NbaSteamMovePanel />
        <NbaPredictionEnginePanel />
        <NbaBacktestingCalibrationPanel />
      </DashboardSection>

      <DashboardSection
        id="sports-brain"
        eyebrow="Strategy"
        title="AI Sports Brain"
        description="Build a bankroll strategy from your target profit, risk tolerance and selected sport."
      >
        <AISportsBrainPanel />
      </DashboardSection>

      <DashboardSection
        id="daily-report"
        eyebrow="Daily"
        title="Daily Report"
        description="Fast daily betting report with bankroll guidance."
      >
        <DailyReportPanel />
      </DashboardSection>

      <DashboardSection
        id="prediction-v4"
        eyebrow="AI Rating"
        title="Prediction Engine V4"
        description="Unified AI rating combining model confidence, edge, EV, sharp money and Monte Carlo simulation."
      >
        <PredictionEngineV4Panel />
        <SportPredictionSdkPanel />
        <PredictionSafetyPanel />
        <SettlementCorePanel />
      </DashboardSection>

      <DashboardSection
        id="top-picks"
        eyebrow="Picks"
        title="Top Picks"
        description="Adaptive-ranked picks, play of the day and strongest model edges."
      >
        <PlayOfTheDayPanel />
        <TopPicksPanel />
      </DashboardSection>

      <DashboardSection
        id="bet-slip"
        eyebrow="Optimizer"
        title="Bet Slip Optimizer"
        description="AI optimized singles and parlays using EV, confidence, edge and adaptive score."
      >
        <BetSlipOptimizerPanel />
      </DashboardSection>

      <DashboardSection
        id="risk-lab"
        eyebrow="Risk"
        title="Risk Lab"
        description="Monte Carlo simulation, downside risk, probability of profit and bankroll stress testing."
      >
        <MonteCarloSimulatorPanel />
      </DashboardSection>

      <DashboardSection
        id="sharp-money"
        eyebrow="Market"
        title="Sharp Money Intelligence"
        description="Steam profiles, reverse line movement, public fade spots and value windows."
      >
        <SharpMoneyIntelligencePanel />
      </DashboardSection>

      <DashboardSection
        id="closing-line"
        eyebrow="CLV"
        title="Closing Line Intelligence"
        description="Sportsbook rankings, line movement, entry timing and current value windows."
      >
        <ClosingLineIntelligencePanel />
      </DashboardSection>

      <DashboardSection
        id="live-betting"
        eyebrow="Live"
        title="Live Betting Engine"
        description="Live EV, win probability, momentum, Kelly stake, cash-out and hedge intelligence."
      >
        <LiveBettingEnginePanel />
      </DashboardSection>

      <DashboardSection
        id="portfolio"
        eyebrow="Portfolio"
        title="Portfolio Builder"
        description="AI allocation, diversification, exposure control and target-profit planning."
      >
        <PortfolioAIV2Panel />
        <PortfolioElitePanel />
      </DashboardSection>

      <DashboardSection
        id="ai-coach"
        eyebrow="Coach"
        title="AI Performance Coach"
        description="Settled performance patterns, calibration warnings and personalized model rules."
      >
        <AICoachPanel />
      </DashboardSection>

      <DashboardSection
        id="learning"
        eyebrow="Learning"
        title="Learning Engine"
        description="Historical pattern discovery and adaptive weight recommendations."
      >
        <PatternDiscoveryPanel />
        <AdaptiveWeightsPanel />
      </DashboardSection>

      <DashboardSection
        id="model-center"
        eyebrow="Model"
        title="AI Model Center"
        description="Model versioning, rollback and auto tuning."
      >
        <RuntimeObservabilityPanel />
        <SyncReliabilityPanel />
        <ModelMetricsFrameworkPanel />
        <ModelVersionsPanel />
        <ModelRollbackPanel />
        <AutoModelTuningPanel />
      </DashboardSection>
    </DashboardShell>
  )
}
