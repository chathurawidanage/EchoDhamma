import fs from 'fs';
import path from 'path';
import { TheroConfig } from '../types';

const THEROS_DIR = path.join(process.cwd(), '../src/echodhamma/theros');

/**
 * Reads all Thero JSON configuration files from the Python config directory.
 * Returns only those that are enabled.
 */
export function getTheros(): TheroConfig[] {
  try {
    if (!fs.existsSync(THEROS_DIR)) {
      console.warn(`Theros configuration directory not found at: ${THEROS_DIR}`);
      return [];
    }

    const files = fs.readdirSync(THEROS_DIR);
    const theroConfigs: TheroConfig[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(THEROS_DIR, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        try {
          const config = JSON.parse(fileContent) as TheroConfig;
          if (config.enabled) {
            theroConfigs.push(config);
          }
        } catch (err) {
          console.error(`Failed to parse thero config file: ${file}`, err);
        }
      }
    }

    // Sort by seniority ascending, fallback to id alphabetical
    theroConfigs.sort((a, b) => {
      const aSeniority = a.seniority ?? 999;
      const bSeniority = b.seniority ?? 999;
      if (aSeniority !== bSeniority) {
        return aSeniority - bSeniority;
      }
      return a.id.localeCompare(b.id);
    });

    return theroConfigs;
  } catch (error) {
    console.error('Error reading thero configurations:', error);
    return [];
  }
}

/**
 * Retrieves a Thero configuration by ID.
 */
export function getTheroById(id: string): TheroConfig | null {
  const theros = getTheros();
  return theros.find((t) => t.id === id) || null;
}
