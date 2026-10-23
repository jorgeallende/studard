import { useId, useRef, useState } from 'react'
import { Check, ListPlus } from 'lucide-react'
import { Modal } from './Modal'
import { parseBulkCards } from '../lib/bulkCards'
import type { BulkCardDraft } from '../lib/bulkCards'
import type { Subject, Topic } from '../lib/types'

const example = `[
  {
    "pergunta": "O que é concordância verbal?",
    "resposta": "É a relação de número e pessoa entre o verbo e o sujeito."
  }
]`

export function BulkCardImporter({
  subject,
  topics,
  initialTopicId,
  onInsert,
  onClose,
}: {
  subject: Subject
  topics: Topic[]
  initialTopicId?: string
  onInsert: (topicId: string, drafts: BulkCardDraft[]) => boolean
  onClose: () => void
}) {
  const [topicId, setTopicId] = useState(
    initialTopicId || (topics.length === 1 ? topics[0].id : ''),
  )
  const [source, setSource] = useState('')
  const [error, setError] = useState('')
  const submitted = useRef(false)
  const id = useId()
  const result = parseBulkCards(source)
  const hasInput = !!source.trim()
  const validTopic = topics.some((topic) => topic.id === topicId)
  const count = result.ok ? result.cards.length : 0
  const errorMessage = error || (hasInput && !result.ok ? result.error : '')

  return (
    <Modal
      title="Inserir cards em bloco"
      description={`Transforme o conteúdo da sua aula em cards de ${subject.name}.`}
      onClose={onClose}
      wide
    >
      <form
        className="editor-form bulk-import-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!result.ok || !validTopic || submitted.current) return
          submitted.current = true
          if (!onInsert(topicId, result.cards)) {
            submitted.current = false
            setError(
              'O tema não está mais disponível. Selecione um tema válido antes de adicionar os cards.',
            )
          }
        }}
      >
        <label>
          Tema de destino
          <select
            required
            value={topicId}
            onChange={(event) => {
              setTopicId(event.target.value)
              setError('')
            }}
          >
            <option value="" disabled>
              Selecione o tema que vai receber os cards
            </option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          JSON dos flashcards
          <textarea
            autoFocus
            rows={8}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="bulk-json-input"
            value={source}
            placeholder={example}
            aria-invalid={hasInput && !result.ok}
            aria-describedby={`${id}-hint${errorMessage ? ` ${id}-error` : ''}`}
            onChange={(event) => {
              setSource(event.target.value)
              setError('')
            }}
          />
        </label>
        <p id={`${id}-hint`} className="bulk-import-hint">
          Cole uma lista com os campos <code>"pergunta"</code> e <code>"resposta"</code>. Cada item
          será um novo flashcard neste tema.
        </p>
        {errorMessage && (
          <p id={`${id}-error`} className="form-error" role="alert">
            {errorMessage}
          </p>
        )}
        {result.ok && (
          <section className="bulk-preview" aria-label="Prévia dos cards">
            <div className="bulk-preview-heading">
              <strong>
                <Check size={15} />
                JSON validado
              </strong>
              <span role="status">
                {count} {count === 1 ? 'card pronto' : 'cards prontos'} para adicionar
              </span>
            </div>
            <ol>
              {result.cards.slice(0, 3).map((card, index) => (
                <li key={index}>
                  <strong>{card.question}</strong>
                  <p>{card.answer}</p>
                </li>
              ))}
            </ol>
            {count > 3 && (
              <p className="bulk-import-hint">
                Prévia dos 3 primeiros cards. Todos os {count} cards serão adicionados.
              </p>
            )}
          </section>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" disabled={!result.ok || !validTopic}>
            <ListPlus size={17} />
            {count ? `Adicionar ${count} ${count === 1 ? 'card' : 'cards'}` : 'Adicionar cards'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
