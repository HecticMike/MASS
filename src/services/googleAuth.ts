const fallbackClientId =
  '271874708401-jleia6a7ndhmmaku4bhtkqnvjsms4cg1.apps.googleusercontent.com'

type TokenResponse = {
  access_token: string
  expires_in: number
  error?: unknown
}

type TokenClient = {
  callback: (response: TokenResponse) => void
  requestAccessToken: (options?: { prompt?: string }) => void
}

type GoogleOAuth2 = {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
  }) => TokenClient
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleOAuth2
      }
    }
  }
}

const getClientId = () =>
  import.meta.env.VITE_GOOGLE_CLIENT_ID?.toString()?.trim() || fallbackClientId

let tokenClient: TokenClient | null = null

const initTokenClient = () => {
  const oauth = window.google?.accounts?.oauth2
  if (!oauth) {
    throw new Error('Google Identity Services SDK has not loaded yet.')
  }
  tokenClient = oauth.initTokenClient({
    client_id: getClientId(),
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ].join(' '),
    callback: () => {},
  })
  return tokenClient
}

export const requestAccessToken = () =>
  new Promise<string>((resolve, reject) => {
    try {
      const client = tokenClient ?? initTokenClient()
      client.callback = (response) => {
        if (response.error) {
          reject(response)
        } else {
          resolve(response.access_token)
        }
      }
      client.requestAccessToken({ prompt: 'consent' })
    } catch (error) {
      reject(error)
    }
  })
