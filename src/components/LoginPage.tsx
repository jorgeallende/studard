import { BookOpen, CloudOff, Leaf, Sparkles, Sprout } from 'lucide-react'
import { AuthForm } from './AuthForm'
import { supabase } from '../lib/supabase'

export function LoginPage({
  error,
  needRefresh,
  onUpdate,
}: {
  error: string
  needRefresh: boolean
  onUpdate: () => void
}) {
  return (
    <div className="login-page">
      <header className="login-header">
        <div className="brand">
          <span className="brand-icon">
            <BookOpen size={23} />
          </span>
          <span>
            studard<span className="brand-dot">.</span>
          </span>
        </div>
        <span className="login-header-caption">
          <Sprout size={16} />
          Um pouco a cada dia.
        </span>
      </header>
      <main className="login-main">
        <section className="login-intro" aria-labelledby="login-title">
          <span className="eyebrow">
            <Sparkles size={15} />
            UM BOM DIA PARA APRENDER
          </span>
          <h1 id="login-title">
            Um espaço para o que você quer <em>aprender.</em>
          </h1>
          <p>Organize suas matérias, crie flashcards e cultive o conhecimento no seu ritmo.</p>
          <div className="login-illustration" aria-hidden="true">
            <span className="login-orbit" />
            <span className="login-paper login-paper-back" />
            <span className="login-paper login-paper-front">
              <BookOpen size={57} strokeWidth={1.2} />
              <span />
              <span />
            </span>
            <span className="login-art-spark">✳</span>
            <Leaf className="login-art-leaf" size={46} strokeWidth={1.2} />
          </div>
        </section>
        <section className="login-panel" aria-label="Acesso à sua conta">
          {needRefresh && (
            <div className="notice">
              <Sparkles size={17} />
              <span>Uma nova versão está pronta.</span>
              <button onClick={onUpdate}>Atualizar app</button>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {supabase ? (
            <AuthForm />
          ) : (
            <div className="login-unavailable" role="status">
              <span className="account-big-icon">
                <CloudOff size={31} />
              </span>
              <h2>O acesso ainda não está disponível.</h2>
              <p>A conexão do aplicativo precisa ser configurada. Tente novamente mais tarde.</p>
            </div>
          )}
        </section>
      </main>
      <footer className="login-footer">
        <Sprout size={14} />
        Seu conhecimento, um card de cada vez.
      </footer>
    </div>
  )
}
