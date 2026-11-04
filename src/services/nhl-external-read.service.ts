import 'server-only';
import {cache} from 'react';
import {getNhlFreeReport} from './nhl-free.service';
// Compatibility name retained for all existing Pick consumers. Reads persisted Pick data only.
export const NHL_READ_BRIDGE_URL='https://sports-edge-hub.vercel.app/api/nhl/read-bridge';
export const getNhlExternalReport=cache(getNhlFreeReport);
