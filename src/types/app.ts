export type Sex = 'male' | 'female' | 'unspecified'

export interface Profile {
  sex: Sex
  height_cm: number
  unit: 'kg' | 'lb'
}

export interface Goal {
  targetKg?: number
  startKg?: number
  startDate?: string
}

export interface Entry {
  ts: string
  kg: number
  note?: string
}

export interface AppState {
  profile?: Profile
  goal?: Goal
  entries: Entry[]
}

export const DEFAULT_STATE: AppState = Object.freeze({
  profile: undefined,
  goal: undefined,
  entries: [],
}) as AppState

export const createDefaultState = (): AppState => ({
  profile: undefined,
  goal: undefined,
  entries: [],
})
