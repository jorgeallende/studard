import { useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { LoaderCircle, LogOut, Sprout } from 'lucide-react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'

export function AccountModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  async function signOut() {
    if (!supabase || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) {
        setError('Não foi possível sair. Tente novamente.')
        return
      }
      onClose()
    } catch {
      setError('Não foi possível sair. Tente novamente.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <Modal
      title="Seu aprendizado, em todo lugar"
      description="Sua biblioteca acompanha você."
      onClose={onClose}
    >
      <div className="account-content">
        <div className="account-identity">
          <span className="account-big-icon">
            <Sprout size={33} />
          </span>
          <strong>{user.email}</strong>
          <span>Conta conectada</span>
        </div>
        <p className="account-note">
          Seus cards e seu progresso ficam vinculados à sua conta. Entre com ela para continuar seus
          estudos em outros dispositivos.
        </p>
        <button
          className="btn btn-secondary full-width"
          disabled={busy}
          onClick={() => void signOut()}
        >
          {busy ? <LoaderCircle className="spin" size={16} /> : <LogOut size={16} />}Sair desta
          conta
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
