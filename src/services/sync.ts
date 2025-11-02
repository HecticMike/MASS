import type { AppState, Entry } from '../types/app'
import { requestAccessToken } from './googleAuth'

export const syncToGoogleSheets = async (entries: Entry[]): Promise<void> => {
  if (!entries.length) {
    console.info('No entries to sync to Google Sheets.')
    return
  }

  try {
    const token = await requestAccessToken()
    console.info('Google Sheets token acquired', token ? '✓' : '×')
    // TODO: Use the token with the Sheets API to push entry data.
  } catch (error) {
    console.error('Google Sheets sync failed', error)
  }
}

export const syncToDriveJson = async (_state: AppState): Promise<void> => {
  try {
    const token = await requestAccessToken()
    console.info('Google Drive token acquired', token ? '✓' : '×')
    // TODO: Use the token with the Drive API to upload the JSON backup.
  } catch (error) {
    console.error('Google Drive sync failed', error)
  }
}
