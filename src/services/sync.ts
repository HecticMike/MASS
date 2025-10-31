import type { AppState, Entry } from '../types/app'

export const syncToGoogleSheets = async (entries: Entry[]): Promise<void> => {
  void entries
  // TODO: Implement Google Sheets sync strategy.
}

export const syncToDriveJson = async (state: AppState): Promise<void> => {
  void state
  // TODO: Implement Google Drive JSON sync strategy.
}
