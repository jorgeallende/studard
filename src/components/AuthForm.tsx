import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthError } from '@supabase/supabase-js'
import { Eye, EyeOff, LoaderCircle, LogIn, UserPlus } from 'lucide-react'
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

export function AuthForm() {
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
    } catch {
      setError('Confira sua conexão e tente novamente.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <div className="auth-form">
      <div className="auth-form-heading">
        <h2>{isSignup ? 'Crie sua conta' : 'Entre na sua conta'}</h2>
        <p>
          {isSignup
            ? 'Um novo espaço para o que você quer aprender.'
            : 'Seu espaço de estudo está esperando por você.'}
        </p>
      </div>
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
    </div>
  )
}
