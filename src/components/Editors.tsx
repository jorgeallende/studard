import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Plus } from 'lucide-react'
import { Modal } from './Modal'
import { SubjectIcon, subjectIcons } from './SubjectIcon'
import type { Card, Color, Library, Subject, Topic } from '../lib/types'

export function SubjectEditor({
  subject,
  onSave,
  onClose,
}: {
  subject?: Subject
  onSave: (value: Subject) => void
  onClose: () => void
}) {
  const [name, setName] = useState(subject?.name || '')
  const [color, setColor] = useState<Color>(subject?.color || 'sage')
  const [icon, setIcon] = useState(subject?.icon || 'book')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim())
      onSave({ id: subject?.id || crypto.randomUUID(), name: name.trim(), color, icon })
  }
  return (
    <Modal
      title={subject ? 'Editar matéria' : 'Uma nova descoberta'}
      description="Dê um espaço para o que você quer aprender."
      onClose={onClose}
    >
      <form onSubmit={submit} className="editor-form">
        <label>
          Nome da matéria
          <input
            autoFocus
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Português"
          />
        </label>
        <fieldset>
          <legend>Escolha um ícone</legend>
          <div className="icon-options">
            {Object.keys(subjectIcons).map((key) => (
              <button
                key={key}
                type="button"
                aria-label={`Ícone ${key}`}
                aria-pressed={icon === key}
                className={`icon-option ${icon === key ? 'selected' : ''}`}
                onClick={() => setIcon(key)}
              >
                <SubjectIcon name={key} />
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Uma cor para chamar de sua</legend>
          <div className="color-options">
            {(['sage', 'blue', 'peach', 'lilac', 'yellow'] as Color[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={
                  {
                    sage: 'Verde',
                    blue: 'Azul',
                    peach: 'Pêssego',
                    lilac: 'Lilás',
                    yellow: 'Amarelo',
                  }[c]
                }
                aria-pressed={color === c}
                className={`color-option tone-${c}`}
                onClick={() => setColor(c)}
              >
                {color === c && <Check size={18} />}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit">
            <Check size={17} />
            {subject ? 'Salvar alterações' : 'Criar matéria'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function TopicEditor({
  topic,
  subject,
  onSave,
  onClose,
}: {
  topic?: Topic
  subject: Subject
  onSave: (value: Topic) => void
  onClose: () => void
}) {
  const [name, setName] = useState(topic?.name || '')
  return (
    <Modal
      title={topic ? 'Editar tema' : 'Um tema de cada vez'}
      description={`Organize seus estudos de ${subject.name}.`}
      onClose={onClose}
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim())
            onSave({
              id: topic?.id || crypto.randomUUID(),
              subjectId: subject.id,
              name: name.trim(),
            })
        }}
      >
        <label>
          Nome do tema
          <input
            autoFocus
            required
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Concordância verbal"
          />
        </label>
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit">
            <Check size={17} />
            {topic ? 'Salvar alterações' : 'Criar tema'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function CardEditor({
  card,
  library,
  initialSubject,
  initialTopic,
  onSave,
  onClose,
}: {
  card?: Card
  library: Library
  initialSubject?: string
  initialTopic?: string
  onSave: (card: Card) => void
  onClose: () => void
}) {
  const cardTopic = library.topics.find((t) => t.id === card?.topicId)
  const [subjectId, setSubjectId] = useState(
    cardTopic?.subjectId || initialSubject || library.subjects[0]?.id || '',
  )
  const [topicId, setTopicId] = useState(
    card?.topicId ||
      initialTopic ||
      library.topics.find((t) => t.subjectId === subjectId)?.id ||
      '',
  )
  const [question, setQuestion] = useState(card?.question || '')
  const [answer, setAnswer] = useState(card?.answer || '')
  const topics = library.topics.filter((t) => t.subjectId === subjectId)
  return (
    <Modal
      title={card ? 'Editar flashcard' : 'Uma pergunta. Um novo aprendizado.'}
      description="Transforme o que você está estudando em algo que fica."
      onClose={onClose}
      wide
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!question.trim() || !answer.trim() || !topicId) return
          onSave({
            ...card,
            id: card?.id || crypto.randomUUID(),
            topicId,
            question: question.trim(),
            answer: answer.trim(),
            favorite: card?.favorite || false,
            createdAt: card?.createdAt || new Date().toISOString(),
            dueAt: card?.dueAt || new Date().toISOString(),
            reviews: card?.reviews || 0,
          })
        }}
      >
        <div className="form-row">
          <label>
            Matéria
            <select
              required
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value)
                setTopicId(library.topics.find((t) => t.subjectId === e.target.value)?.id || '')
              }}
            >
              <option value="" disabled>
                Selecione
              </option>
              {library.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tema
            <select required value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="" disabled>
                {topics.length ? 'Selecione um tema' : 'Crie um tema primeiro'}
              </option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span className="label-line">
            Frente <span>A pergunta</span>
          </span>
          <textarea
            autoFocus
            required
            maxLength={2000}
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="O que você quer lembrar?"
          />
        </label>
        <label>
          <span className="label-line">
            Verso <span>A resposta</span>
          </span>
          <textarea
            required
            maxLength={10000}
            rows={5}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Explique com suas palavras. Vale incluir exemplos!"
          />
        </label>
        {!topics.length && (
          <p className="form-notice">Crie um tema dentro dessa matéria antes de adicionar cards.</p>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" disabled={!topicId}>
            <Plus size={17} />
            {card ? 'Salvar alterações' : 'Criar flashcard'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
