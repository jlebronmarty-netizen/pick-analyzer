export const dynamic = 'force-dynamic'

export async function GET() {
  const environment = process.env.VERCEL_ENV ?? 'unknown'
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? null

  if (environment === 'production') {
    return Response.json(
      {
        ok: false,
        code: 'RESEARCH_ONLY',
        message: 'PA-14 BALLDONTLIE research diagnostics are disabled in production.',
      },
      { status: 403 }
    )
  }

  return Response.json({
    ok: true,
    environment,
    branch,
    provider: 'balldontlie',
    configured: Boolean(process.env.BALLDONTLIE_API_KEY),
  })
}
