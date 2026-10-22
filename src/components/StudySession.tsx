import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  EyeOff,
  PartyPopper,
  RotateCcw,
  Shuffle,
  Sparkles,
  X,
} from 'lucide-react'
import type { Card, Library, Rating } from '../lib/types'
import { REVIEW_INTERVALS, isStudyActive, shuffleCards } from '../lib/study'

export function StudySession({
  cards: initialCards,
  library,
  title,
  onReview,
  onSuspend,
  onClose,
}: {
  cards: Card[]
  library: Library
  title: string
  onReview: (id: string, rating: Rating) => void
  onSuspend: (id: string) => void
  onClose: () => void
}) {
  const [cards, setCards] = useState(() => shuffleCards(initialCards))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [again, setAgain] = useState(0)
  const [suspended, setSuspended] = useState<string[]>([])
  const [finished, setFinished] = useState(false)
  const [locked, setLocked] = useState(false)
  const lock = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const card = cards[index]
  const topic = library.topics.find((t) => t.id === card?.topicId)
  const subject = library.subjects.find((s) => s.id === topic?.subjectId)
  const activeIds = new Set(library.cards.filter(isStudyActive).map((card) => card.id))
  const restartCards = cards.filter(
    (card) => activeIds.has(card.id) && !suspended.includes(card.id),
  )
  const reviewed = cards.length - suspended.length
  const beginAnswer = () => {
    if (!flipped || lock.current || finished) return false
    lock.current = true
    setLocked(true)
    return true
  }
  const advance = () => {
    setFlipped(false)
    timer.current = setTimeout(() => {
      if (index + 1 >= cards.length) setFinished(true)
      else setIndex((value) => value + 1)
      lock.current = false
      setLocked(false)
    }, 280)
  }
  const rate = (rating: Rating) => {
    if (!beginAnswer()) return
    onReview(card.id, rating)
    if (rating === 'again') setAgain((value) => value + 1)
    advance()
  }
  const suspendCurrent = () => {
    if (!beginAnswer()) return
    onSuspend(card.id)
    setSuspended((ids) => [...ids, card.id])
    advance()
  }
  useEffect(() => {
    dialogRef.current?.showModal()
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialogRef.current?.close()
      document.body.style.overflow = previousOverflow
      clearTimeout(timer.current)
    }
  }, [])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if ((event.key === ' ' || event.key === 'Enter') && event.target === document.body) {
        event.preventDefault()
        if (!finished && !lock.current) setFlipped((value) => !value)
      }
      if (flipped && !finished) {
        if (event.key === '1') rate('again')
        if (event.key === '2') rate('good')
        if (event.key === '3') rate('easy')
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })
  return (
    <dialog
      ref={dialogRef}
      className="study-screen"
      aria-label="Sessão de estudo"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="study-shell">
        <header className="study-header">
          <button ref={closeRef} className="btn btn-ghost" onClick={onClose}>
            <ArrowLeft size={18} />
            Voltar
          </button>
          <span className="wordmark-small">
            <Sparkles size={20} />
            studard
          </span>
          <button className="icon-btn" aria-label="Encerrar sessão" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        {finished ? (
          <div className="study-finished">
            <div className="celebration">
              <PartyPopper size={46} strokeWidth={1.4} />
            </div>
            <span className="eyebrow">UM PASSO A MAIS</span>
            <h1>{reviewed ? 'Olha o quanto você aprendeu.' : 'Sessão concluída.'}</h1>
            <p>
              Você revisou {reviewed} {reviewed === 1 ? 'card' : 'cards'}.<br />
              {again
                ? `${again} ${again === 1 ? 'card volta' : 'cards voltam'} para revisão amanhã.`
                : 'Tudo certo por hoje. Seu eu do futuro agradece.'}
            </p>
            {suspended.length > 0 && (
              <p className="session-suspended-note">
                <EyeOff size={14} />
                {suspended.length}{' '}
                {suspended.length === 1
                  ? 'card ficou fora das sessões e continua'
                  : 'cards ficaram fora das sessões e continuam'}{' '}
                na sua listagem.
              </p>
            )}
            <div className="finish-stats">
              <span>
                <strong>{reviewed}</strong>cards revisados
              </span>
              <span>
                <strong>{reviewed - again}</strong>lembrados
              </span>
            </div>
            <button className="btn btn-primary" onClick={onClose}>
              Concluir sessão
              <Check size={18} />
            </button>
            <button
              className="btn btn-ghost"
              disabled={!restartCards.length}
              onClick={() => {
                setCards(shuffleCards(restartCards))
                setIndex(0)
                setAgain(0)
                setSuspended([])
                setFinished(false)
                setFlipped(false)
              }}
            >
              <RotateCcw size={16} />
              Estudar novamente
            </button>
          </div>
        ) : (
          <>
            <div className="study-intro">
              <span className="eyebrow">HORA DE CULTIVAR O CONHECIMENTO</span>
              <h1>{title}</h1>
              <p>Respire. Pense na resposta. Vire quando estiver pronto.</p>
            </div>
            <div className="study-progress-head">
              <span>
                {subject?.name} <span className="muted">/ {topic?.name}</span>
              </span>
              <strong>
                {index + 1} <span className="muted">de {cards.length}</span>
              </strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${(index / cards.length) * 100}%` }} />
            </div>
            <button
              className={`flip-card ${flipped ? 'is-flipped' : ''}`}
              aria-label={flipped ? 'Voltar à pergunta' : 'Virar flashcard para ver a resposta'}
              aria-describedby={flipped ? 'study-answer' : 'study-question'}
              aria-pressed={flipped}
              disabled={locked}
              onClick={() => setFlipped((value) => !value)}
            >
              <span className="flip-inner">
                <span className="card-face card-front" aria-hidden={flipped}>
                  <span className="face-label">
                    <span className="little-dot" />
                    PERGUNTA
                  </span>
                  <span className="face-content" id="study-question">
                    {card.question}
                  </span>
                  <span className="face-hint">
                    <RotateCcw size={17} />
                    Toque para revelar a resposta
                  </span>
                  <span className="face-decoration">✳</span>
                </span>
                <span className="card-face card-back" aria-hidden={!flipped}>
                  <span className="face-label">
                    <Check size={16} />
                    RESPOSTA
                  </span>
                  <span className="face-content answer-content" id="study-answer">
                    {card.answer}
                  </span>
                  <span className="face-hint">
                    <RotateCcw size={16} />
                    Toque para voltar à pergunta
                  </span>
                </span>
              </span>
            </button>
            <div className="study-controls">
              {flipped ? (
                <>
                  <p>Como foi lembrar?</p>
                  <div className="rating-buttons">
                    <button
                      className="rating rating-again"
                      disabled={locked}
                      onClick={() => rate('again')}
                    >
                      <span>
                        Preciso rever <kbd>1</kbd>
                      </span>
                      <small>{REVIEW_INTERVALS.again.label}</small>
                    </button>
                    <button
                      className="rating rating-good"
                      disabled={locked}
                      onClick={() => rate('good')}
                    >
                      <span>
                        Lembrei <kbd>2</kbd>
                      </span>
                      <small>{REVIEW_INTERVALS.good.label}</small>
                    </button>
                    <button
                      className="rating rating-easy"
                      disabled={locked}
                      onClick={() => rate('easy')}
                    >
                      <span>
                        Foi fácil <kbd>3</kbd>
                      </span>
                      <small>{REVIEW_INTERVALS.easy.label}</small>
                    </button>
                  </div>
                  <button
                    className="suspend-card-button"
                    disabled={locked}
                    title="O card continua na listagem e pode voltar às sessões quando você quiser"
                    onClick={suspendCurrent}
                  >
                    <EyeOff size={14} />
                    Não mostrar mais nas sessões
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-primary reveal-btn"
                    disabled={locked}
                    onClick={() => setFlipped(true)}
                  >
                    Revelar resposta
                    <RotateCcw size={17} />
                  </button>
                  <span className="study-keyboard">
                    Toque no card ou pressione Enter quando ele estiver selecionado
                  </span>
                </>
              )}
            </div>
            <div className="study-bottom">
              <span>
                <Sparkles size={14} />
                Aprender leva tempo. Você está no caminho.
              </span>
              {index === 0 && (
                <button
                  className="btn btn-ghost"
                  disabled={locked || cards.length < 2}
                  onClick={() => {
                    setCards((current) => shuffleCards(current))
                    setFlipped(false)
                  }}
                >
                  <Shuffle size={15} />
                  Embaralhar
                </button>
              )}
              {index > 0 && (
                <span>
                  {index} {index === 1 ? 'card concluído' : 'cards concluídos'}
                  <ArrowRight size={14} />
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
