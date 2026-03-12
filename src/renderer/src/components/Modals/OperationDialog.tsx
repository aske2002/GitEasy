import { useState } from 'react'
import { useRepoStore } from '../../store/repoStore'

export function OperationDialog() {
  const { operationError, operationInProgress, clearError } = useRepoStore()

  if (!operationError && !operationInProgress) return null

  if (operationError) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          background: 'var(--color-bg-panel)',
          border: '1px solid var(--color-red)',
          borderRadius: 10,
          padding: '12px 16px',
          maxWidth: 480,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10
        }}
      >
        <span style={{ color: 'var(--color-red)', fontSize: 16, flexShrink: 0 }}>✕</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 4 }}>
            Operation failed
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>
            {operationError}
          </div>
        </div>
        <button
          onClick={clearError}
          style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
        >
          ✕
        </button>
      </div>
    )
  }

  return null
}
