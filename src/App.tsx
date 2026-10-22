import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudOff,
  Coffee,
  Download,
  EyeOff,
  Flame,
  FolderOpen,
  GraduationCap,
  Heart,
  LayoutGrid,
  Leaf,
  LoaderCircle,
  LogIn,
  Menu,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Sprout,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  WifiOff,
  X,
} from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAuth } from './lib/useAuth'
import { useLibrary } from './lib/useLibrary'
import { useInstall } from './lib/useInstall'
import { useReviewClock } from './lib/useReviewClock'
import {
  deleteSubject,
  deleteTopic,
  isDue,
  isStudyActive,
  localDay,
  reviewCard,
  setCardSuspended,
  streak,
} from './lib/study'
import { isLibrary } from './lib/validation'
import type { Card, Library, Subject, Topic } from './lib/types'
import { SubjectIcon } from './components/SubjectIcon'
import { Modal } from './components/Modal'
import { AccountModal } from './components/AccountModal'
import { CardEditor, SubjectEditor, TopicEditor } from './components/Editors'
import { StudySession } from './components/StudySession'

type Page = 'home' | 'library' | 'favorites' | 'activity'
type Dialog =
  | { kind: 'subject'; subject?: Subject }
  | { kind: 'topic'; subject: Subject; topic?: Topic }
  | { kind: 'card'; card?: Card }
  | { kind: 'preview'; card: Card }
  | { kind: 'account' }
  | { kind: 'settings' }
  | { kind: 'install' }
  | { kind: 'confirm'; title: string; message: string; action: () => void; destructive?: boolean }
  | null

export default function App() {
  const { user, loading, error } = useAuth()
  if (loading)
    return (
      <div className="app-loading">
        <div className="brand-icon">
          <BookOpen />
        </div>
        <h1>
          studard<span>.</span>
        </h1>
        <LoaderCircle className="spin" size={22} />
        <p>Preparando seu espaço de estudo…</p>
      </div>
    )
  return <Workspace key={user?.id || 'guest'} user={user} authError={error} />
}

function Workspace({ user, authError }: { user: User | null; authError: string }) {
  const { data, update, ready, online, status, message, storageError, retry, reloadCloud } =
    useLibrary(user?.id)
  const [page, setPage] = useState<Page>('home')
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [session, setSession] = useState<{ cards: Card[]; title: string } | null>(null)
  const [onlyDue, setOnlyDue] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const install = useInstall()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const subject = data.subjects.find((s) => s.id === selectedSubject)
  const topics = data.topics.filter((t) => t.subjectId === selectedSubject)
  const now = useReviewClock(data.cards)
  const activeCards = data.cards.filter(isStudyActive)
  const due = data.cards.filter((c) => isDue(c, now))
  const todayReviews = data.history.filter((r) => localDay(new Date(r.at)) === localDay(new Date()))
  const currentStreak = streak(data)
  const todayCount = todayReviews.length
  const todayGoal = 20
  const q = query.trim().toLocaleLowerCase('pt-BR')

  useEffect(() => {
    if (dialog) setSidebarOpen(false)
  }, [dialog])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    if (!sidebarOpen) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [sidebarOpen])

  function navigate(next: Page, subjectId: string | null = null) {
    setPage(next)
    setSelectedSubject(subjectId)
    setSelectedTopic(null)
    setQuery('')
    setOnlyDue(false)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  function startStudy(cards: Card[], title: string) {
    const available = cards.filter(isStudyActive)
    if (!available.length) {
      setToast(
        'Nenhum card ativo para estudar neste contexto. Você pode criar ou reativar um card.',
      )
      return
    }
    setSession({ cards: available, title })
  }
  function openCard(card: Card) {
    if (!isStudyActive(card)) setDialog({ kind: 'preview', card })
    else startStudy([card], 'Uma descoberta rápida')
  }
  function restoreCard(card: Card) {
    update((library) => setCardSuspended(library, card.id, false))
    setDialog(null)
    setToast('O card voltou às sessões de estudo e revisão.')
  }
  function startReview(cards: Card[], title: string) {
    const available = cards.filter((card) => isDue(card))
    if (!available.length) {
      setToast('Tudo em dia! Nenhum card precisa de revisão neste contexto.')
      return
    }
    setSession({ cards: available, title })
  }
  function newCard() {
    if (!data.subjects.length) {
      setDialog({ kind: 'subject' })
      setToast('Comece criando uma matéria para organizar seus cards.')
      return
    }
    if (!data.topics.length || (subject && !topics.length)) {
      setDialog({ kind: 'topic', subject: subject || data.subjects[0] })
      setToast('Crie um tema para guardar seus primeiros cards.')
      return
    }
    setDialog({ kind: 'card' })
  }
  function saveSubject(value: Subject) {
    const editing = data.subjects.some((s) => s.id === value.id)
    update((d) => ({
      ...d,
      subjects: editing
        ? d.subjects.map((s) => (s.id === value.id ? value : s))
        : [...d.subjects, value],
    }))
    setDialog(null)
    setToast(editing ? 'Matéria atualizada.' : 'Matéria criada. Agora adicione seu primeiro tema!')
    if (!editing) navigate('library', value.id)
  }
  function saveTopic(value: Topic) {
    const editing = data.topics.some((t) => t.id === value.id)
    update((d) => ({
      ...d,
      topics: editing ? d.topics.map((t) => (t.id === value.id ? value : t)) : [...d.topics, value],
    }))
    setDialog(null)
    setSelectedTopic(value.id)
    setToast(editing ? 'Tema atualizado.' : 'Tema criado. Hora do primeiro card!')
  }
  function saveCard(value: Card) {
    const editing = data.cards.some((c) => c.id === value.id)
    update((d) => ({
      ...d,
      cards: editing ? d.cards.map((c) => (c.id === value.id ? value : c)) : [...d.cards, value],
    }))
    setDialog(null)
    setToast(editing ? 'Flashcard atualizado.' : 'Novo flashcard pronto para estudar!')
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `studard-${localDay(new Date())}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setToast('Sua biblioteca foi exportada.')
  }
  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('large')
      const parsed: unknown = JSON.parse(await file.text())
      if (!isLibrary(parsed)) throw new Error('invalid')
      setDialog({
        kind: 'confirm',
        title: 'Restaurar biblioteca?',
        message: `Este arquivo tem ${parsed.subjects.length} matérias e ${parsed.cards.length} cards. Sua biblioteca atual será substituída. Exporte uma cópia antes de continuar.`,
        action: () => {
          update(parsed)
          navigate('home')
          setToast('Biblioteca restaurada.')
          setDialog(null)
        },
      })
    } catch {
      setToast('Arquivo inválido. Escolha um backup JSON do Studard de até 10 MB.')
    }
  }
  const removeSubject = (s: Subject) =>
    setDialog({
      kind: 'confirm',
      title: `Excluir ${s.name}?`,
      message:
        'Todos os temas e flashcards desta matéria serão excluídos. Esta ação não pode ser desfeita.',
      destructive: true,
      action: () => {
        update((d) => deleteSubject(d, s.id))
        setDialog(null)
        navigate('library')
        setToast('Matéria excluída.')
      },
    })
  const removeTopic = (t: Topic) =>
    setDialog({
      kind: 'confirm',
      title: `Excluir ${t.name}?`,
      message: 'Todos os cards deste tema também serão excluídos. Esta ação não pode ser desfeita.',
      destructive: true,
      action: () => {
        update((d) => deleteTopic(d, t.id))
        setSelectedTopic(null)
        setDialog(null)
        setToast('Tema excluído.')
      },
    })
  const removeCard = (card: Card) =>
    setDialog({
      kind: 'confirm',
      title: 'Excluir este flashcard?',
      message: `“${card.question}” será excluído da sua biblioteca.`,
      destructive: true,
      action: () => {
        update((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== card.id) }))
        setDialog(null)
        setToast('Flashcard excluído.')
      },
    })
  const toggleFavorite = (id: string) =>
    update((d) => ({
      ...d,
      cards: d.cards.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)),
    }))

  const scopedCards = data.cards.filter((c) => {
    const topic = data.topics.find((t) => t.id === c.topicId)
    return (
      (!selectedSubject || topic?.subjectId === selectedSubject) &&
      (!selectedTopic || c.topicId === selectedTopic) &&
      (page !== 'favorites' || c.favorite)
    )
  })
  const scopedDue = scopedCards.filter((card) => isDue(card, now))
  const scopedStudyCards = scopedCards.filter(isStudyActive)
  const matchingCards = scopedCards.filter((c) => {
    const topic = data.topics.find((t) => t.id === c.topicId)
    const cardSubject = data.subjects.find((s) => s.id === topic?.subjectId)
    return (
      (!onlyDue || isDue(c, now)) &&
      (!q ||
        `${c.question} ${c.answer} ${topic?.name} ${cardSubject?.name}`
          .toLocaleLowerCase('pt-BR')
          .includes(q))
    )
  })
  const cloudLabels = {
    local: 'Salvo neste dispositivo',
    loading: 'Carregando biblioteca',
    synced: 'Tudo sincronizado',
    saving: 'Sincronizando…',
    offline: 'Offline · salvo no dispositivo',
    error: 'Sincronização pendente',
    conflict: 'Biblioteca com conflito',
  }
  const accountName = user?.email?.split('@')[0] || 'Seu espaço'

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <aside
        className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
        aria-label="Navegação principal"
      >
        <button className="brand" onClick={() => navigate('home')} aria-label="Studard, início">
          <span className="brand-icon">
            <BookOpen size={23} />
          </span>
          <span>
            studard<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="workspace-label">
          <span className="workspace-symbol">
            <Sprout size={17} />
          </span>
          Meu espaço de estudo
          <span className="small-dot" />
        </div>
        <span className="nav-label">SEU APRENDIZADO</span>
        <nav className="main-nav">
          <button
            className={page === 'home' && !q ? 'active' : ''}
            onClick={() => navigate('home')}
            aria-current={page === 'home' ? 'page' : undefined}
          >
            <LayoutGrid size={19} />
            Visão geral
          </button>
          <button
            className={page === 'library' ? 'active' : ''}
            onClick={() => navigate('library')}
            aria-current={page === 'library' ? 'page' : undefined}
          >
            <FolderOpen size={19} />
            Minhas matérias<span className="nav-count">{data.subjects.length}</span>
          </button>
          <button
            className={page === 'favorites' ? 'active' : ''}
            onClick={() => navigate('favorites')}
            aria-current={page === 'favorites' ? 'page' : undefined}
          >
            <Heart size={19} />
            Favoritos
            <span className="nav-count">{data.cards.filter((c) => c.favorite).length || ''}</span>
          </button>
          <button
            className={page === 'activity' ? 'active' : ''}
            onClick={() => navigate('activity')}
            aria-current={page === 'activity' ? 'page' : undefined}
          >
            <TrendingUp size={19} />
            Meu progresso
          </button>
        </nav>
        <div className="subjects-nav-heading">
          <span className="nav-label">MINHAS MATÉRIAS</span>
          <button
            className="icon-btn"
            aria-label="Criar matéria"
            onClick={() => setDialog({ kind: 'subject' })}
          >
            <Plus size={15} />
          </button>
        </div>
        <nav className="subjects-nav" aria-label="Matérias">
          {data.subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate('library', s.id)}
              className={selectedSubject === s.id ? 'selected-subject' : ''}
            >
              <span className={`subject-dot dot-${s.color}`} />
              {s.name}
              <ChevronRight size={13} />
            </button>
          ))}
          {!data.subjects.length && (
            <p className="sidebar-empty">
              Seu próximo interesse
              <br />
              começa aqui.
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          {!install.installed && (
            <div className="install-card">
              <span className="install-icon">
                <ArrowDownToLine size={20} />
              </span>
              <strong>Seu estudo vai com você</strong>
              <p>
                Instale o app e aprenda
                <br />
                de onde estiver.
              </p>
              <button
                onClick={() =>
                  install.canInstall ? void install.install() : setDialog({ kind: 'install' })
                }
              >
                Instalar Studard
                <ArrowRight size={15} />
              </button>
            </div>
          )}
          <button className="settings-link" onClick={() => setDialog({ kind: 'settings' })}>
            <Settings2 size={17} />
            Preferências
          </button>
          <button className="user-card" onClick={() => setDialog({ kind: 'account' })}>
            <span className="avatar">
              {user ? accountName.slice(0, 2).toUpperCase() : <Sprout size={19} />}
            </span>
            <span>
              <strong>{accountName}</strong>
              <small>{user ? 'Minha conta' : 'Aprender é um hábito'}</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={sidebarOpen}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              <span>Meu espaço</span>
              <ChevronRight size={13} />
              <strong>
                {subject?.name ||
                  {
                    home: 'Visão geral',
                    library: 'Matérias',
                    favorites: 'Favoritos',
                    activity: 'Progresso',
                  }[page]}
              </strong>
            </span>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Buscar na biblioteca"
                placeholder="Encontre algo para aprender…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button onClick={() => setQuery('')} aria-label="Limpar busca">
                  <X size={14} />
                </button>
              ) : (
                <kbd>⌘ K</kbd>
              )}
            </label>
            <button
              className="icon-btn help-button"
              aria-label="Como usar o Studard"
              onClick={() => setDialog({ kind: 'install' })}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="topbar-avatar"
              aria-label="Minha conta"
              onClick={() => setDialog({ kind: 'account' })}
            >
              {user ? accountName.slice(0, 1).toUpperCase() : <Sprout size={19} />}
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          {(!online ||
            storageError ||
            status === 'error' ||
            status === 'conflict' ||
            authError) && (
            <div className="notice" role="status">
              {!online ? <WifiOff size={17} /> : <CloudOff size={17} />}
              <span>
                {storageError
                  ? 'Não foi possível salvar no dispositivo. Exporte uma cópia da biblioteca para preservar seus cards.'
                  : authError ||
                    (!online
                      ? 'Você está offline. Continue estudando; as alterações ficam neste dispositivo.'
                      : message)}
              </span>
              {storageError && <button onClick={exportData}>Exportar</button>}
              {status === 'error' && <button onClick={retry}>Tentar novamente</button>}
              {status === 'conflict' && (
                <button onClick={() => setDialog({ kind: 'settings' })}>Resolver</button>
              )}
            </div>
          )}
          {needRefresh && (
            <div className="notice">
              <Sparkles size={17} />
              <span>Uma nova versão do Studard está pronta.</span>
              <button onClick={() => void updateServiceWorker(true)}>Atualizar app</button>
            </div>
          )}
          {!ready ? (
            <div className="content-loading">
              <LoaderCircle className="spin" />
              <p>Carregando sua biblioteca…</p>
            </div>
          ) : (
            <>
              {q ? (
                <>
                  <PageHeading
                    eyebrow="SUA BIBLIOTECA"
                    title={`Resultados para “${query}”`}
                    subtitle={`${matchingCards.length} ${matchingCards.length === 1 ? 'card encontrado' : 'cards encontrados'}`}
                  />
                  <CardGrid
                    cards={matchingCards}
                    data={data}
                    onFavorite={toggleFavorite}
                    onEdit={(card) => setDialog({ kind: 'card', card })}
                    onDelete={removeCard}
                    onRestore={restoreCard}
                    onStudy={openCard}
                    emptyAction={newCard}
                  />
                </>
              ) : page === 'home' ? (
                <>
                  <div className="welcome-row">
                    <div>
                      <span className="eyebrow">
                        <span className="tiny-sun">✳</span> UM BOM DIA PARA APRENDER
                      </span>
                      <h1>
                        Seu próximo passo começa aqui<span className="heading-dot">.</span>
                      </h1>
                      <p>Um pouco de curiosidade. Um card de cada vez.</p>
                    </div>
                    <span className="date-pill">
                      {new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
                        .format(new Date())
                        .replace('.', '')}
                      <span />
                      {new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
                        .format(new Date())
                        .replace('.', '')}
                    </span>
                  </div>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-kicker">
                        <span />
                        SEU FUTURO EU VAI AGRADECER
                      </span>
                      <h2>
                        Pequenos passos.
                        <br />
                        <em>Grandes descobertas.</em>
                      </h2>
                      <p>
                        Conhecimento cresce quando você cultiva.
                        <br />
                        Que tal alguns minutos de estudo hoje?
                      </p>
                      <div className="session-actions hero-actions">
                        <button
                          className="btn btn-primary"
                          disabled={data.cards.length > 0 && !activeCards.length}
                          title={
                            activeCards.length
                              ? 'Praticar todos os cards ativos, de todas as matérias e temas'
                              : data.cards.length
                                ? 'Reative um card na listagem para voltar a estudar'
                                : 'Criar meu primeiro card'
                          }
                          onClick={() =>
                            data.cards.length
                              ? startStudy(data.cards, 'Estudo livre · todas as matérias')
                              : newCard()
                          }
                        >
                          <Play size={16} fill="currentColor" />
                          {data.cards.length ? 'Vamos estudar' : 'Criar meu primeiro card'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={!due.length}
                          title={
                            due.length
                              ? 'Revisar apenas os cards disponíveis, de todas as matérias e temas'
                              : 'Tudo em dia. Nenhum card precisa de revisão agora.'
                          }
                          onClick={() => startReview(data.cards, 'Revisão · todas as matérias')}
                        >
                          <RotateCcw size={16} />
                          Revisar {due.length}
                        </button>
                      </div>
                      <span className="hero-footnote">
                        {data.cards.length
                          ? `Estudo livre: ${activeCards.length} cards ativos. Revisão: só os disponíveis.`
                          : 'O primeiro passo é uma boa pergunta.'}
                      </span>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <span className="art-spark spark-one">✳</span>
                      <span className="art-spark spark-two">✦</span>
                      <span className="art-dot" />
                      <div className="art-card art-card-back">
                        <div />
                        <div />
                        <div />
                      </div>
                      <div className="art-card art-card-middle">
                        <BookOpen size={45} strokeWidth={1.2} />
                      </div>
                      <div className="art-card art-card-front">
                        <span className="art-card-label">
                          <span />
                          UM POUCO TODOS OS DIAS
                        </span>
                        <div className="art-book">
                          <BookOpen size={53} strokeWidth={1.3} />
                          <span>✧</span>
                        </div>
                        <strong>
                          Aprender é<br />
                          abrir possibilidades.
                        </strong>
                        <span className="art-line" />
                        <span className="art-card-bottom">
                          Sua próxima descoberta está aqui.
                          <Sparkles size={13} />
                        </span>
                      </div>
                      <div className="art-note">
                        <span className="note-icon">
                          <Check size={14} />
                        </span>
                        Você consegue. Um card de cada vez.
                      </div>
                      <span className="art-leaf">
                        <Leaf size={48} strokeWidth={1.2} />
                      </span>
                    </div>
                  </section>
                  <section className="stats-grid" aria-label="Resumo dos estudos">
                    <Stat
                      icon={<BookOpen size={21} />}
                      tone="sage"
                      value={data.cards.length}
                      label="cards na sua coleção"
                      detail={`${data.subjects.length} matérias para explorar`}
                    />
                    <Stat
                      icon={<RotateCcw size={21} />}
                      tone="peach"
                      value={due.length}
                      label="cards para revisar"
                      detail="Uma chance de fixar o que aprendeu"
                    />
                    <Stat
                      icon={<Flame size={21} />}
                      tone="lilac"
                      value={`${currentStreak} ${currentStreak === 1 ? 'dia' : 'dias'}`}
                      label="de constância"
                      detail={
                        currentStreak
                          ? 'Continue cultivando esse hábito'
                          : 'Seu primeiro dia pode ser hoje'
                      }
                    />
                  </section>
                  <div className="dashboard-bottom">
                    <section className="subjects-section">
                      <div className="section-heading">
                        <div>
                          <h2>O que vamos aprender?</h2>
                          <p>Escolha uma matéria e siga sua curiosidade.</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setDialog({ kind: 'subject' })}
                        >
                          <Plus size={16} />
                          Nova matéria
                        </button>
                      </div>
                      <div className="subject-grid">
                        {data.subjects.map((s) => (
                          <SubjectTile
                            key={s.id}
                            subject={s}
                            data={data}
                            onClick={() => navigate('library', s.id)}
                          />
                        ))}
                        <button
                          className="add-subject-tile"
                          onClick={() => setDialog({ kind: 'subject' })}
                        >
                          <span>
                            <Plus size={22} />
                          </span>
                          <strong>
                            {data.subjects.length ? 'Mais um interesse?' : 'Sua primeira matéria'}
                          </strong>
                          <small>Crie um novo espaço para aprender</small>
                        </button>
                      </div>
                    </section>
                    <aside className="daily-panel">
                      <div className="daily-panel-heading">
                        <span className="daily-icon">
                          <Target size={20} />
                        </span>
                        <span>UM POUCO A CADA DIA</span>
                      </div>
                      <h3>Encontre seu ritmo.</h3>
                      <p>
                        Pequenas sessões também
                        <br />
                        fazem grandes diferenças.
                      </p>
                      <div className="daily-progress">
                        <strong>
                          {todayCount}
                          <span> / {todayGoal} cards</span>
                        </strong>
                        <span>{Math.min(100, Math.round((todayCount / todayGoal) * 100))}%</span>
                      </div>
                      <div className="progress-track">
                        <span
                          style={{ width: `${Math.min(100, (todayCount / todayGoal) * 100)}%` }}
                        />
                      </div>
                      <span className="daily-caption">
                        {todayCount >= todayGoal
                          ? 'Meta do dia alcançada. Muito bem!'
                          : todayCount
                            ? 'Cada card é um passo. Continue assim.'
                            : 'Seu primeiro card já é um começo.'}
                      </span>
                      <div className="daily-divider" />
                      <span className="quote-mark">“</span>
                      <blockquote>
                        Não é sobre saber tudo.
                        <br />É sobre aprender
                        <br />
                        <em>um pouco mais.</em>
                      </blockquote>
                      <Sprout className="daily-sprout" size={58} strokeWidth={1} />
                    </aside>
                  </div>
                </>
              ) : page === 'library' && !subject ? (
                <>
                  <PageHeading
                    eyebrow="CONHECIMENTO BEM ORGANIZADO"
                    title="Minhas matérias"
                    subtitle="Um lugar para cada interesse. Uma descoberta a cada visita."
                    action={
                      <button
                        className="btn btn-primary"
                        onClick={() => setDialog({ kind: 'subject' })}
                      >
                        <Plus size={18} />
                        Nova matéria
                      </button>
                    }
                  />
                  <div className="subject-grid library-grid">
                    {data.subjects.map((s) => (
                      <SubjectTile
                        key={s.id}
                        subject={s}
                        data={data}
                        onClick={() => navigate('library', s.id)}
                        onEdit={() => setDialog({ kind: 'subject', subject: s })}
                        onDelete={() => removeSubject(s)}
                      />
                    ))}
                    <button
                      className="add-subject-tile"
                      onClick={() => setDialog({ kind: 'subject' })}
                    >
                      <span>
                        <Plus size={22} />
                      </span>
                      <strong>Uma nova matéria</strong>
                      <small>O que desperta sua curiosidade?</small>
                    </button>
                  </div>
                </>
              ) : page === 'library' && subject ? (
                <>
                  <button className="back-link" onClick={() => navigate('library')}>
                    <ArrowLeft size={15} />
                    Todas as matérias
                  </button>
                  <div className="subject-page-heading">
                    <span className={`subject-icon large-icon tone-${subject.color}`}>
                      <SubjectIcon name={subject.icon} size={30} />
                    </span>
                    <PageHeading
                      eyebrow="SUA MATÉRIA"
                      title={subject.name}
                      subtitle={`${topics.length} ${topics.length === 1 ? 'tema' : 'temas'} · ${data.cards.filter((c) => topics.some((t) => t.id === c.topicId)).length} cards para descobrir`}
                      action={
                        <div className="heading-actions">
                          <button
                            className="icon-btn border-btn"
                            aria-label="Editar matéria"
                            onClick={() => setDialog({ kind: 'subject', subject })}
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            className="icon-btn border-btn"
                            aria-label="Excluir matéria"
                            onClick={() => removeSubject(subject)}
                          >
                            <Trash2 size={17} />
                          </button>
                          <button className="btn btn-primary" onClick={newCard}>
                            <Plus size={17} />
                            Novo card
                          </button>
                        </div>
                      }
                    />
                  </div>
                  <div className="topic-tabs">
                    <button
                      className={!selectedTopic ? 'selected' : ''}
                      onClick={() => setSelectedTopic(null)}
                    >
                      Todos os temas
                      <span>
                        {data.cards.filter((c) => topics.some((t) => t.id === c.topicId)).length}
                      </span>
                    </button>
                    {topics.map((t) => (
                      <button
                        key={t.id}
                        className={selectedTopic === t.id ? 'selected' : ''}
                        onClick={() => setSelectedTopic(t.id)}
                      >
                        {t.name}
                        <span>{data.cards.filter((c) => c.topicId === t.id).length}</span>
                      </button>
                    ))}
                    <button
                      className="add-topic"
                      onClick={() => setDialog({ kind: 'topic', subject })}
                    >
                      <Plus size={16} />
                      Novo tema
                    </button>
                  </div>
                  <div className="cards-toolbar">
                    <div>
                      <h2>
                        {data.topics.find((t) => t.id === selectedTopic)?.name ||
                          'Todos os flashcards'}{' '}
                        <span className="count-badge">{matchingCards.length}</span>
                      </h2>
                      {selectedTopic && (
                        <div className="topic-actions">
                          <button
                            className="text-button"
                            onClick={() =>
                              setDialog({
                                kind: 'topic',
                                subject,
                                topic: topics.find((t) => t.id === selectedTopic),
                              })
                            }
                          >
                            <Pencil size={12} />
                            Editar tema
                          </button>
                          <button
                            className="text-button danger-text"
                            onClick={() => {
                              const t = topics.find((t) => t.id === selectedTopic)
                              if (t) removeTopic(t)
                            }}
                          >
                            <Trash2 size={12} />
                            Excluir tema
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="toolbar-actions">
                      <label className="filter-toggle">
                        <input
                          type="checkbox"
                          checked={onlyDue}
                          onChange={(e) => setOnlyDue(e.target.checked)}
                        />
                        Só para revisar
                      </label>
                      <div className="session-actions">
                        <button
                          className="btn btn-primary"
                          disabled={!scopedStudyCards.length}
                          title="Praticar todos os cards do tema selecionado, ou da matéria em Todos os temas"
                          onClick={() =>
                            startStudy(
                              scopedCards,
                              `Estudo livre · ${data.topics.find((t) => t.id === selectedTopic)?.name || subject.name}`,
                            )
                          }
                        >
                          <Play size={15} />
                          Estudar {scopedStudyCards.length}
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={!scopedDue.length}
                          title={
                            scopedDue.length
                              ? 'Revisar apenas os cards disponíveis neste tema ou matéria'
                              : 'Tudo em dia. Nenhum card precisa de revisão neste contexto.'
                          }
                          onClick={() =>
                            startReview(
                              scopedCards,
                              `Revisão · ${data.topics.find((t) => t.id === selectedTopic)?.name || subject.name}`,
                            )
                          }
                        >
                          <RotateCcw size={15} />
                          Revisar {scopedDue.length}
                        </button>
                      </div>
                    </div>
                  </div>
                  <CardGrid
                    cards={matchingCards}
                    data={data}
                    onFavorite={toggleFavorite}
                    onEdit={(card) => setDialog({ kind: 'card', card })}
                    onDelete={removeCard}
                    onRestore={restoreCard}
                    onStudy={openCard}
                    emptyAction={
                      onlyDue && scopedCards.length
                        ? undefined
                        : topics.length
                          ? newCard
                          : () => setDialog({ kind: 'topic', subject })
                    }
                    emptyText={
                      onlyDue && scopedCards.length ? 'Revisões em dia por aqui' : undefined
                    }
                    emptyDescription={
                      onlyDue && scopedCards.length
                        ? scopedStudyCards.length
                          ? 'Nenhum card deste contexto precisa de revisão agora. Você pode continuar praticando com o botão Estudar.'
                          : 'Desmarque Só para revisar para consultar seus cards ou reativar os que estão fora das sessões.'
                        : undefined
                    }
                  />
                </>
              ) : page === 'favorites' ? (
                <>
                  <PageHeading
                    eyebrow="O QUE MERECE FICAR POR PERTO"
                    title="Seus favoritos"
                    subtitle="Aquelas ideias que você quer revisitar mais vezes."
                    action={
                      <button
                        className="btn btn-primary"
                        disabled={!matchingCards.some(isStudyActive)}
                        onClick={() => startStudy(matchingCards, 'Seus favoritos')}
                      >
                        <Play size={16} />
                        Estudar favoritos
                      </button>
                    }
                  />
                  <CardGrid
                    cards={matchingCards}
                    data={data}
                    onFavorite={toggleFavorite}
                    onEdit={(card) => setDialog({ kind: 'card', card })}
                    onDelete={removeCard}
                    onRestore={restoreCard}
                    onStudy={openCard}
                    emptyText="Seus favoritos moram aqui"
                    emptyDescription="Toque no coração de um card para guardar as ideias que você quer ter sempre por perto."
                  />
                </>
              ) : (
                <ProgressPage data={data} />
              )}
            </>
          )}
          <footer className="main-footer">
            <span>
              <Sprout size={14} />
              Feito para aprender no seu tempo.
            </span>
            <button
              className={`sync-status sync-${status}`}
              onClick={() => setDialog({ kind: 'settings' })}
            >
              {status === 'saving' || status === 'loading' ? (
                <LoaderCircle className="spin" size={13} />
              ) : user ? (
                <Cloud size={14} />
              ) : (
                <span className="small-dot" />
              )}
              {cloudLabels[status]}
            </button>
          </footer>
        </main>
      </div>
      <input
        hidden
        ref={importRef}
        type="file"
        accept=".json,application/json"
        onChange={(e) => void importData(e)}
      />
      {toast && (
        <div className="toast" role="status">
          <span>
            <Sparkles size={15} />
          </span>
          {toast}
          <button className="icon-btn" onClick={() => setToast('')} aria-label="Fechar aviso">
            <X size={15} />
          </button>
        </div>
      )}
      {dialog?.kind === 'subject' && (
        <SubjectEditor
          subject={dialog.subject}
          onSave={saveSubject}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'topic' && (
        <TopicEditor
          subject={dialog.subject}
          topic={dialog.topic}
          onSave={saveTopic}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'card' && (
        <CardEditor
          card={dialog.card}
          library={data}
          initialSubject={selectedSubject || undefined}
          initialTopic={selectedTopic || undefined}
          onSave={saveCard}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'account' && (
        <AccountModal user={user} onClose={() => setDialog(null)} notify={setToast} />
      )}
      {dialog?.kind === 'settings' && (
        <Modal
          title="Do seu jeito"
          description="Cuide do seu espaço e leve seu aprendizado com você."
          onClose={() => setDialog(null)}
        >
          <div className="settings-content">
            <div className="settings-status">
              <span className="subject-icon tone-sage">
                {user ? <Cloud size={22} /> : <Download size={22} />}
              </span>
              <div>
                <strong>{cloudLabels[status]}</strong>
                <p>{user ? user.email : 'Entre na sua conta para sincronizar seus cards.'}</p>
              </div>
            </div>
            {message && <p className="form-notice">{message}</p>}
            <button className="settings-row" onClick={exportData}>
              <Download size={20} />
              <span>
                <strong>Exportar biblioteca</strong>
                <small>Uma cópia dos seus cards em JSON</small>
              </span>
              <ChevronRight size={17} />
            </button>
            <button className="settings-row" onClick={() => importRef.current?.click()}>
              <Upload size={20} />
              <span>
                <strong>Restaurar um backup</strong>
                <small>Importar uma biblioteca do Studard</small>
              </span>
              <ChevronRight size={17} />
            </button>
            {status === 'conflict' && (
              <button
                className="settings-row"
                onClick={() =>
                  setDialog({
                    kind: 'confirm',
                    title: 'Carregar a versão mais recente?',
                    message:
                      'As alterações locais serão substituídas pela versão salva na nuvem. Exporte uma cópia local antes de continuar.',
                    action: () => {
                      void reloadCloud()
                      setDialog(null)
                    },
                  })
                }
              >
                <Cloud size={20} />
                <span>
                  <strong>Carregar versão da nuvem</strong>
                  <small>Exporte sua cópia local primeiro</small>
                </span>
                <ChevronRight size={17} />
              </button>
            )}
            <button className="settings-row" onClick={() => setDialog({ kind: 'account' })}>
              <LogIn size={20} />
              <span>
                <strong>{user ? 'Minha conta' : 'Entrar na minha conta'}</strong>
                <small>Seu aprendizado em todos os dispositivos</small>
              </span>
              <ChevronRight size={17} />
            </button>
            <p className="settings-note">
              <Leaf size={14} />
              Studard · Um card de cada vez.
            </p>
          </div>
        </Modal>
      )}
      {dialog?.kind === 'install' && (
        <Modal
          title="Seu aprendizado vai com você"
          description="Um espaço simples para cultivar o que você sabe."
          onClose={() => setDialog(null)}
        >
          <div className="guide-content">
            <div>
              <span>01</span>
              <p>
                <strong>Organize por matéria e tema</strong>Crie uma matéria, adicione temas e
                guarde seus flashcards neles.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Teste sua memória</strong>Pense na resposta, vire o card e avalie como foi
                lembrar. O app agenda a próxima revisão.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Estude de onde estiver</strong>Use a opção “Instalar aplicativo” do
                navegador. No iPhone, abra no Safari, toque em Compartilhar e “Adicionar à Tela de
                Início”.
              </p>
            </div>
            <div className="form-notice">
              Depois do primeiro acesso, o app fica disponível offline. As revisões feitas sem
              conexão são sincronizadas quando você voltar a ficar online.
            </div>
            {install.canInstall && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  void install.install()
                  setDialog(null)
                }}
              >
                <ArrowDownToLine size={17} />
                Instalar Studard
              </button>
            )}
          </div>
        </Modal>
      )}
      {dialog?.kind === 'confirm' && (
        <Modal title={dialog.title} onClose={() => setDialog(null)}>
          <p className="confirm-copy">{dialog.message}</p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setDialog(null)}>
              Cancelar
            </button>
            <button
              className={`btn ${dialog.destructive ? 'btn-danger' : 'btn-primary'}`}
              onClick={dialog.action}
            >
              {dialog.destructive ? 'Sim, excluir' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}
      {dialog?.kind === 'preview' && (
        <Modal
          title="Consultar flashcard"
          description="Este card está fora das sessões, mas continua guardado na sua biblioteca."
          onClose={() => setDialog(null)}
        >
          <div className="card-preview-content">
            <span className="eyebrow">PERGUNTA</span>
            <h3>{dialog.card.question}</h3>
            <span className="eyebrow">RESPOSTA</span>
            <p>{dialog.card.answer}</p>
            <button className="btn btn-secondary" onClick={() => restoreCard(dialog.card)}>
              <RotateCcw size={16} />
              Voltar às sessões
            </button>
          </div>
        </Modal>
      )}
      {session && (
        <StudySession
          cards={session.cards}
          library={data}
          title={session.title}
          onReview={(id, rating) => update((d) => reviewCard(d, id, rating))}
          onSuspend={(id) => update((d) => setCardSuspended(d, id, true))}
          onClose={() => {
            setSession(null)
            setToast('Seu progresso foi salvo. Cada passo conta.')
          }}
        />
      )}
    </div>
  )
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>
          {title}
          <span className="heading-dot">.</span>
        </h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  )
}
function Stat({
  icon,
  tone,
  value,
  label,
  detail,
}: {
  icon: React.ReactNode
  tone: string
  value: number | string
  label: string
  detail: string
}) {
  return (
    <div className="stat-card">
      <span className={`stat-icon tone-${tone}`}>{icon}</span>
      <div>
        <div className="stat-main">
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
        <p>{detail}</p>
      </div>
    </div>
  )
}
function SubjectTile({
  subject,
  data,
  onClick,
  onEdit,
  onDelete,
}: {
  subject: Subject
  data: Library
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const topics = data.topics.filter((t) => t.subjectId === subject.id)
  const cards = data.cards.filter((c) => topics.some((t) => t.id === c.topicId))
  const due = cards.filter((c) => isDue(c)).length
  return (
    <article className={`subject-tile subject-${subject.color}`}>
      <button className="subject-tile-main" onClick={onClick}>
        <span className={`subject-icon tone-${subject.color}`}>
          <SubjectIcon name={subject.icon} />
        </span>
        <span className="subject-tile-arrow">
          <ArrowRight size={19} />
        </span>
        <h3>{subject.name}</h3>
        <p>
          {topics.length} {topics.length === 1 ? 'tema' : 'temas'}
          <span>·</span>
          {cards.length} cards
        </p>
        <div className="subject-tile-bottom">
          <span className={due ? 'due-label' : 'done-label'}>
            <span />
            {due ? `${due} para revisar` : cards.length ? 'Tudo em dia' : 'Pronto para começar'}
          </span>
          <span className="mini-card-decoration">
            <BookOpen size={16} />
          </span>
        </div>
      </button>
      {onEdit && (
        <div className="subject-manage">
          <button className="icon-btn" aria-label={`Editar ${subject.name}`} onClick={onEdit}>
            <Pencil size={14} />
          </button>
          <button className="icon-btn" aria-label={`Excluir ${subject.name}`} onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </article>
  )
}
function CardGrid({
  cards,
  data,
  onFavorite,
  onEdit,
  onDelete,
  onRestore,
  onStudy,
  emptyAction,
  emptyText = 'Uma boa pergunta é só o começo',
  emptyDescription = 'Crie seu primeiro flashcard e transforme curiosidade em conhecimento.',
}: {
  cards: Card[]
  data: Library
  onFavorite: (id: string) => void
  onEdit: (card: Card) => void
  onDelete: (card: Card) => void
  onRestore: (card: Card) => void
  onStudy: (card: Card) => void
  emptyAction?: () => void
  emptyText?: string
  emptyDescription?: string
}) {
  if (!cards.length)
    return (
      <div className="empty-state">
        <span>
          <BookOpen size={34} strokeWidth={1.3} />
        </span>
        <h2>{emptyText}</h2>
        <p>{emptyDescription}</p>
        {emptyAction && (
          <button className="btn btn-primary" onClick={emptyAction}>
            <Plus size={17} />
            Começar por aqui
          </button>
        )}
      </div>
    )
  return (
    <div className="cards-grid">
      {cards.map((card) => {
        const topic = data.topics.find((t) => t.id === card.topicId)
        const subject = data.subjects.find((s) => s.id === topic?.subjectId)
        return (
          <article className="flashcard-tile" key={card.id}>
            <div className="flashcard-tile-top">
              <span className={`card-topic-label tone-${subject?.color || 'sage'}`}>
                {topic?.name}
              </span>
              <button
                className={`icon-btn heart-btn ${card.favorite ? 'is-favorite' : ''}`}
                aria-label={card.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                aria-pressed={card.favorite}
                onClick={() => onFavorite(card.id)}
              >
                <Heart size={17} fill={card.favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
            <button className="card-question" onClick={() => onStudy(card)}>
              <small>PERGUNTA</small>
              <h3>{card.question}</h3>
              <span>
                {card.suspended ? <EyeOff size={14} /> : <RotateCcw size={14} />}
                {card.suspended ? 'Consultar pergunta e resposta' : 'Vire para descobrir'}
              </span>
            </button>
            <div className="flashcard-tile-bottom">
              <span
                className={
                  card.suspended ? 'card-suspended' : isDue(card) ? 'card-due' : 'card-reviewed'
                }
              >
                <span />
                {card.suspended ? 'Fora das sessões' : isDue(card) ? 'Para revisar' : 'Em dia'}
              </span>
              <span className="card-tile-actions">
                {card.suspended && (
                  <button
                    className="icon-btn"
                    aria-label="Voltar às sessões"
                    title="Voltar às sessões de estudo e revisão"
                    onClick={() => onRestore(card)}
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
                <button
                  className="icon-btn"
                  aria-label="Editar flashcard"
                  onClick={() => onEdit(card)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Excluir flashcard"
                  onClick={() => onDelete(card)}
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </div>
          </article>
        )
      })}
    </div>
  )
}
function ProgressPage({ data }: { data: Library }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 6 + i)
    const count = data.history.filter((r) => localDay(new Date(r.at)) === localDay(d)).length
    return { day: d, count }
  })
  const maximum = Math.max(5, ...days.map((d) => d.count))
  const remembered = data.history.filter((r) => r.rating !== 'again').length
  return (
    <>
      <PageHeading
        eyebrow="CADA PASSO CONTA"
        title="Seu conhecimento está crescendo"
        subtitle="O que você aprende hoje é parte de quem você será amanhã."
      />
      <section className="stats-grid">
        <Stat
          icon={<GraduationCap size={23} />}
          tone="sage"
          value={data.history.length}
          label="revisões realizadas"
          detail="Cada revisão fortalece sua memória"
        />
        <Stat
          icon={<Flame size={22} />}
          tone="peach"
          value={`${streak(data)} dias`}
          label="de constância"
          detail="Um hábito que se constrói aos poucos"
        />
        <Stat
          icon={<Target size={23} />}
          tone="lilac"
          value={
            data.history.length ? `${Math.round((remembered / data.history.length) * 100)}%` : '—'
          }
          label="de respostas lembradas"
          detail="Com base nas suas próprias avaliações"
        />
      </section>
      <section className="activity-panel">
        <div className="section-heading">
          <div>
            <h2>Seu ritmo nos últimos dias</h2>
            <p>Cada barra é um pouco de conhecimento cultivado.</p>
          </div>
          <span className="chart-tag">Últimos 7 dias</span>
        </div>
        <div className="activity-chart">
          {days.map(({ day, count }) => (
            <div className="chart-column" key={localDay(day)}>
              <span>{count}</span>
              <div className="chart-bar-wrap">
                <div
                  className={`chart-bar ${localDay(day) === localDay(new Date()) ? 'chart-today' : ''}`}
                  style={{ height: `${Math.max(2, (count / maximum) * 100)}%` }}
                />
              </div>
              <span>
                {new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
                  .format(day)
                  .replace('.', '')}
              </span>
            </div>
          ))}
        </div>
        <div className="chart-footer">
          <span className="subject-dot dot-sage" />
          Cards revisados por dia
        </div>
      </section>
      <div className="progress-encouragement">
        <Coffee size={25} strokeWidth={1.5} />
        <p>
          <strong>Consistência tem mais valor que pressa.</strong>Reserve alguns minutos por dia.
          Você não precisa aprender tudo de uma vez.
        </p>
        <Sparkles size={24} />
      </div>
    </>
  )
}
