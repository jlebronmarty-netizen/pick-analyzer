import { makeHandler } from '../../../../lib/nba-shared-feed.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;
export const GET = makeHandler();
