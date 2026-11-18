import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HOME = process.env.DASHAMUKHA_HOME || path.join(os.homedir(), '.dashamukha');
export const SESSIONS = path.join(HOME, 'sessions');
export const WEB = path.join(ROOT, 'web');
export const VERSION = '0.2.0';
