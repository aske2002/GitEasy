// Global type augmentation for the contextBridge API
import type { GitApi } from '../../preload'

declare global {
  interface Window {
    git: GitApi
  }
}
