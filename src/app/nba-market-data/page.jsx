import { notFound } from 'next/navigation';
import { enabled } from '../../lib/nba-shared-feed.mjs';
import Board from './board';
export const dynamic = 'force-dynamic';
export default function Page() {
  if (!enabled(process.env)) notFound();
  return <Board />;
}
