import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthError, User } from '@supabase/supabase-js'
import {
  ArrowRight,
  Cloud,
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
  LogOut,
  Sprout,
  UserPlus,
} from 'lucide-react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

function authErrorMessage(error: AuthError) {
  switch (error.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos. Confira os dados e tente novamente.'
    case 'email_not_confirmed':
      return 'Esta conta ainda aguarda ativação. O acesso sem confirmação de e-mail precisa estar habilitado no projeto.'
    case 'user_already_exists':
    case 'email_exists':
      return 'Já existe uma conta com este e-mail. Use a opção Entrar.'
    case 'weak_password':
      return 'Escolha uma senha mais forte, com pelo menos 8 caracteres. Confira também as regras de senha do projeto.'
    case 'email_address_invalid':
      return 'Informe um endereço de e-mail válido.'
    case 'signup_disabled':
      return 'A criação de contas está indisponível. Entre com uma conta existente.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes antes de tentar novamente.'
    default:
      return 'Não foi possível acessar sua conta. Confira sua conexão e tente novamente.'
  }
}

export function AccountModal({
  user,
  onClose,
  notify,
}: {
  user: User | null
  onClose: () => void
  notify: (message: string) => void
}) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const errorId = useId()
  const isSignup = mode === 'signup'

  function changeMode(next: Mode) {
    if (submitting.current) return
    setMode(next)
    setPassword('')
    setConfirmation('')
    setShowPassword(false)
    setError('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase || submitting.current) return
    setError('')
    if (isSignup && password !== confirmation) {
      setError('As senhas não coincidem. Digite a mesma senha nos dois campos.')
      return
    }
    submitting.current = true
    setBusy(true)
    try {
      const credentials = { email: email.trim(), password }
      const { data, error } = isSignup
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials)
      if (error) {
        setError(authErrorMessage(error))
        return
      }
      if (!data.session) {
        // Confirmation is a server setting. Never report a successful login without a session.
        setError(
          'O cadastro imediato ainda não está habilitado. Desative a confirmação de e-mail no Supabase para entrar sem essa etapa.',
        )
        return
      }
      setPassword('')
      setConfirmation('')
      notify(
        isSignup ? 'Conta criada. Seu espaço de estudo está pronto!' : 'Você entrou na sua conta.',
      )
      onClose()
    } catch {
      setError('Confira sua conexão e tente novamente.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

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
      notify('Você saiu da conta. Seus cards na nuvem estão guardados.')
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
      title={
        user
          ? 'Seu aprendizado, em todo lugar'
          : isSignup
            ? 'Seu espaço começa aqui'
            : 'Entre no seu espaço'
      }
      description={user ? 'Sua biblioteca acompanha você.' : 'Seu conhecimento merece ir com você.'}
      onClose={onClose}
    >
      <div className="account-content">
        {user ? (
          <>
            <div className="account-identity">
              <span className="account-big-icon">
                <Sprout size={33} />
              </span>
              <strong>{user.email}</strong>
              <span>Conta conectada</span>
            </div>
            <p className="account-note">
              Sua biblioteca na nuvem é separada dos cards do modo local. Para trazer cards de lá,
              exporte um backup no modo local e restaure-o nesta conta.
            </p>
            <button
              className="btn btn-secondary full-width"
              disabled={busy}
              onClick={() => void signOut()}
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : <LogOut size={16} />}Sair desta
              conta
            </button>
          </>
        ) : !supabase ? (
          <>
            <div className="account-big-icon">
              <Cloud size={34} />
            </div>
            <h3>Por enquanto, um espaço só seu.</h3>
            <p>
              A sincronização ainda não foi configurada. Seus cards já podem ser criados e estudados
              neste dispositivo.
            </p>
            <p className="form-notice">
              Exporte sua biblioteca nas preferências para guardar uma cópia. O acesso com e-mail e
              senha ficará disponível assim que a conexão for configurada.
            </p>
            <button className="btn btn-primary full-width" onClick={onClose}>
              Continuar estudando
              <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <>
            <div className="auth-mode" role="group" aria-label="Tipo de acesso">
              <button
                type="button"
                aria-pressed={!isSignup}
                disabled={busy}
                onClick={() => changeMode('signin')}
              >
                Entrar
              </button>
              <button
                type="button"
                aria-pressed={isSignup}
                disabled={busy}
                onClick={() => changeMode('signup')}
              >
                Criar conta
              </button>
            </div>
            <form className="editor-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
              <label>
                Seu e-mail
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  maxLength={254}
                  placeholder="voce@exemplo.com"
                  value={email}
                  disabled={busy}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                Senha
                <span className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    required
                    minLength={isSignup ? 8 : undefined}
                    maxLength={128}
                    placeholder={isSignup ? 'Pelo menos 8 caracteres' : 'Digite sua senha'}
                    value={password}
                    disabled={busy}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-describedby={error ? errorId : undefined}
                  />
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    disabled={busy}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
              {isSignup && (
                <label>
                  Confirmar senha
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    placeholder="Repita sua senha"
                    value={confirmation}
                    disabled={busy}
                    onChange={(event) => setConfirmation(event.target.value)}
                    aria-describedby={error ? errorId : undefined}
                  />
                </label>
              )}
              {error && (
                <p className="form-error" id={errorId} role="alert">
                  {error}
                </p>
              )}
              <button className="btn btn-primary full-width" disabled={busy} type="submit">
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : isSignup ? (
                  <UserPlus size={17} />
                ) : (
                  <LogIn size={17} />
                )}
                {busy
                  ? isSignup
                    ? 'Criando sua conta…'
                    : 'Entrando…'
                  : isSignup
                    ? 'Criar minha conta'
                    : 'Entrar na minha conta'}
              </button>
              <p className="account-note">
                {isSignup
                  ? 'Crie sua conta para guardar seus cards e continuar os estudos em qualquer dispositivo.'
                  : 'Entre com seu e-mail e senha para encontrar seus cards e seu progresso.'}
              </p>
            </form>
          </>
        )}
        {user && error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
