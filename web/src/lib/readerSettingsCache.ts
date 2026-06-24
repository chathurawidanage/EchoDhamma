export interface CachedSettings {
  theme?: 'light' | 'sepia' | 'dark';
  fontSize?: number;
  fontFamily?: 'serif' | 'sans';
  lineHeight?: number;
  textWidth?: 'narrow' | 'medium' | 'wide';
  isLoaded?: boolean;
}

export const settingsCache: CachedSettings = {
  isLoaded: false
};
