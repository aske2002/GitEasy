import { useState, useEffect } from 'react'
import type { AccountInfo } from '../../../../shared/ipc'

interface Props {
  onClose: () => void
}

type Provider = 'github' | 'gitlab' | 'custom'

const PROVIDERS: { id: Provider; label: string; defaultHost: string; tokenUrl: string; color: string }[] = [
  {
    id: 'github',
    label: 'GitHub',
    defaultHost: 'github.com',
    tokenUrl: 'https://github.com/settings/tokens/new?scopes=repo&description=GitAske',
    color: '#e6edf3'
  },
  {
    id: 'gitlab',
    label: 'GitLab',
    defaultHost: 'gitlab.com',
    tokenUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens/new?name=GitAske&scopes=read_user,write_repository',
    color: '#fc6d26'
  },
  {
    id: 'custom',
    label: 'Self-hosted GitLab',
    defaultHost: '',
    tokenUrl: '',
    color: '#fc6d26'
  }
]

export function AccountsModal({ onClose }: Props) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [adding, setAdding] = useState(false)
  const [provider, setProvider] = useState<Provider>('github')
  const [host, setHost] = useState('github.com')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAccounts()
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const loadAccounts = async () => {
    const list = await window.git.listAccounts()
    setAccounts(list)
  }

  const handleProviderChange = (p: Provider) => {
    setProvider(p)
    const def = PROVIDERS.find(x => x.id === p)!
    if (p !== 'custom') setHost(def.defaultHost)
    else setHost('')
    setError(null)
  }

  const handleConnect = async () => {
    if (!token.trim() || !host.trim()) return
    setLoading(true)
    setError(null)
    try {
      await window.git.addAccount(provider, host.trim(), token.trim())
      setToken('')
      setAdding(false)
      await loadAccounts()
    } catch (e: any) {
      setError(e.message ?? 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (acc: AccountInfo) => {
    if (!confirm(`Disconnect ${acc.username} from ${acc.host}?`)) return
    await window.git.removeAccount(acc.host, acc.username)
    await loadAccounts()
  }

  const providerDef = PROVIDERS.find(p => p.id === provider)!

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: 480, maxHeight: '80vh', borderRadius: 10, overflow: 'hidden',
          background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '14px 18px',
          borderBottom: '1px solid var(--color-border)', flexShrink: 0
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1, color: 'var(--color-text-primary)' }}>
            Connected Accounts
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            ✕
          </button>
        </div>

        {/* Account list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {accounts.length === 0 && !adding && (
            <div style={{
              padding: '32px 18px', textAlign: 'center',
              color: 'var(--color-text-muted)', fontSize: 13
            }}>
              No accounts connected yet.<br />
              <span style={{ fontSize: 12 }}>Add an account to enable authenticated push, pull, and fetch.</span>
            </div>
          )}

          {accounts.map(acc => (
            <AccountRow key={`${acc.host}/${acc.username}`} account={acc} onRemove={() => handleRemove(acc)} />
          ))}

          {/* Add account form */}
          {adding && (
            <div style={{ padding: '16px 18px', borderTop: accounts.length > 0 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Connect new account
              </div>

              {/* Provider picker */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, border: '1px solid',
                      borderColor: provider === p.id ? 'var(--color-accent)' : 'var(--color-border)',
                      background: provider === p.id ? 'rgba(124,140,248,0.12)' : 'transparent',
                      color: provider === p.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      cursor: 'pointer', fontWeight: provider === p.id ? 600 : 400
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Host (only editable for custom) */}
              {provider === 'custom' && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                    GitLab host
                  </label>
                  <input
                    value={host}
                    onChange={e => setHost(e.target.value)}
                    placeholder="e.g. gitlab.mycompany.com"
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Token input */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  <span>Personal access token</span>
                  {providerDef.tokenUrl && (
                    <a
                      href="#"
                      onClick={e => { e.preventDefault(); window.open(providerDef.tokenUrl) }}
                      style={{ color: 'var(--color-accent)', textDecoration: 'none', fontSize: 11 }}
                    >
                      Generate token ↗
                    </a>
                  )}
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleConnect() }}
                  placeholder={provider === 'github' ? 'ghp_...' : 'glpat-...'}
                  style={inputStyle}
                  autoFocus
                />
              </div>

              {error && (
                <div style={{ color: 'var(--color-red)', fontSize: 12, marginBottom: 10, padding: '6px 8px', background: 'rgba(224,92,106,0.08)', borderRadius: 4 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setAdding(false); setToken(''); setError(null) }}
                  style={secondaryBtnStyle}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  disabled={loading || !token.trim() || !host.trim()}
                  style={{
                    ...primaryBtnStyle,
                    opacity: (loading || !token.trim() || !host.trim()) ? 0.5 : 1,
                    cursor: loading ? 'wait' : 'pointer'
                  }}
                >
                  {loading ? 'Verifying…' : 'Connect'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!adding && (
          <div style={{
            padding: '12px 18px', borderTop: '1px solid var(--color-border)',
            display: 'flex', justifyContent: 'flex-end', flexShrink: 0
          }}>
            <button onClick={() => setAdding(true)} style={primaryBtnStyle}>
              + Add account
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AccountRow({ account, onRemove }: { account: AccountInfo; onRemove: () => void }) {
  const providerLabel = account.host === 'github.com' ? 'GitHub' : 'GitLab'
  const providerColor = account.host === 'github.com' ? '#e6edf3' : '#fc6d26'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
      borderBottom: '1px solid var(--color-border)'
    }}>
      {/* Avatar or fallback */}
      {account.avatarUrl ? (
        <img src={account.avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--color-bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: 'var(--color-text-muted)', flexShrink: 0
        }}>
          {account.username[0]?.toUpperCase()}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 2 }}>
          {account.username}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            background: providerColor, color: '#000', borderRadius: 3,
            padding: '1px 5px', fontSize: 10, fontWeight: 700
          }}>
            {providerLabel}
          </span>
          {account.host}
        </div>
      </div>

      <button
        onClick={onRemove}
        style={{
          background: 'transparent', border: '1px solid var(--color-border)',
          borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          color: 'var(--color-text-muted)'
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-red)'; e.currentTarget.style.color = 'var(--color-red)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
      >
        Disconnect
      </button>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border)', borderRadius: 5, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box'
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 5,
  border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer'
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, borderRadius: 5,
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text-secondary)', cursor: 'pointer'
}
