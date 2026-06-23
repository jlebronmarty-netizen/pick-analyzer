type StepMethod = 'GET' | 'POST'

type StepResult = {
  step: string
  success: boolean
  status?: number
  method?: StepMethod
  data?: unknown
  error?: string
}

type MasterSyncResult = {
  success: boolean
  startedAt: string
  finishedAt: string
  steps: StepResult[]
}

type PipelineStep = {
  step: string
  path: string
  method: StepMethod
  includeSecret?: boolean
}

function getBaseUrl() {
  const vercelUrl = process.env.VERCEL_URL

  if (vercelUrl) {
    return `https://${vercelUrl}`
  }

  const publicUrl = process.env.NEXT_PUBLIC_APP_URL

  if (publicUrl) {
    return publicUrl.replace(/\/$/, '')
  }

  return 'http://localhost:3000'
}

function withSecret(path: string) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return path

  const separator = path.includes('?') ? '&' : '?'

  return `${path}${separator}secret=${encodeURIComponent(cronSecret)}`
}

async function runStep(
  step: string,
  path: string,
  method: StepMethod = 'GET',
  includeSecret = false
): Promise<StepResult> {
  try {
    const baseUrl = getBaseUrl()
    const finalPath = includeSecret ? withSecret(path) : path

    const response = await fetch(`${baseUrl}${finalPath}`, {
      method,
      cache: 'no-store',
    })

    const text = await response.text()

    let data: unknown

    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return {
      step,
      success: response.ok,
      status: response.status,
      method,
      data,
    }
  } catch (error) {
    return {
      step,
      success: false,
      method,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function runMasterSync(): Promise<MasterSyncResult> {
  const startedAt = new Date().toISOString()

  const steps: StepResult[] = []

  const pipeline: PipelineStep[] = [
    {
      step: 'Sync MLB Results',
      path: '/api/results/sync',
      method: 'POST',
      includeSecret: true,
    },
    {
      step: 'Backfill Results',
      path: '/api/results/backfill',
      method: 'POST',
      includeSecret: true,
    },    
    {
      step: 'Recalculate Team Stats',
      path: '/api/team-stats/recalculate',
      method: 'POST',
      includeSecret: true,
    },
    {
      step: 'Recalculate Head To Head',
      path: '/api/head-to-head/recalculate',
      method: 'POST',
      includeSecret: true,
    },
    {
      step: 'Capture Predictions',
      path: '/api/cron/capture-predictions',
      method: 'GET',
      includeSecret: true,
    },
    {
      step: 'BSN Sync Results',
      path: '/api/bsn/sync',
      method: 'GET',
    },
    {
      step: 'BSN Generate Predictions',
      path: '/api/bsn/predictions',
      method: 'GET',
    },
    {
      step: 'Settle Predictions',
      path: '/api/predictions/settle',
      method: 'GET',
    },
    {
      step: 'Refresh Analytics',
      path: '/api/analytics/dashboard',
      method: 'GET',
    },
    {
      step: 'Refresh Top Picks',
      path: '/api/predictions/top',
      method: 'GET',
    },
  ]

  for (const item of pipeline) {
    const result = await runStep(
      item.step,
      item.path,
      item.method,
      item.includeSecret ?? false
    )

    steps.push(result)
  }

  const finishedAt = new Date().toISOString()

  return {
    success: steps.every((step) => step.success),
    startedAt,
    finishedAt,
    steps,
  }
}