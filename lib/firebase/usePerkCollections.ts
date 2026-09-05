'use client'

import { useContext } from 'react'
import { PerkCollectionsContext } from './PerkCollectionsProvider'

export function usePerkCollections() {
  const ctx = useContext(PerkCollectionsContext)
  if (!ctx) throw new Error('usePerkCollections must be used within a PerkCollectionsProvider')
  return ctx
}
