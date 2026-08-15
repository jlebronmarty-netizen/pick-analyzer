const { runNbaShadowSchedulerPreparationFixtures } = await import('../src/services/nba-shadow-scheduler-preparation.service.ts')

const result = runNbaShadowSchedulerPreparationFixtures()

console.log(JSON.stringify({
  status: 'NBA_03A_SHADOW_SCHEDULER_PREPARATION_SIMULATION',
  ...result,
}, null, 2))
