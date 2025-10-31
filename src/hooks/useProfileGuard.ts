import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile } from '../types/app'

export const useProfileGuard = (profile: Profile | undefined, hydrated: boolean) => {
  const navigate = useNavigate()

  useEffect(() => {
    if (hydrated && (!profile || !profile.height_cm || profile.height_cm < 120)) {
      navigate('/onboarding', { replace: true })
    }
  }, [hydrated, profile, navigate])

  return Boolean(hydrated && profile && profile.height_cm && profile.height_cm >= 120)
}
