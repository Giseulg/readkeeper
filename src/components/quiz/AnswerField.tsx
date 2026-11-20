import type { QuizQuestion } from '@/domain/types'

export function AnswerField({ question, value, onChange }: {
  question: QuizQuestion
  value: string
  onChange: (value: string) => void
}) {
  if (!question.choices?.length) {
    return (
      <label className="col" style={{ gap: 4 }}>
        <span className="lbl">내 답변</span>
        <textarea className="input area" value={value} onChange={(e) => onChange(e.target.value)} placeholder="기억나는 만큼 적어 보세요" />
      </label>
    )
  }

  return (
    <fieldset className="col quiz-options">
      <legend className="lbl">정답을 하나 고르세요</legend>
      {question.choices.map((choice) => (
        <label key={choice} className={`quiz-option${value === choice ? ' selected' : ''}`}>
          <input type="radio" name={`answer-${question.id}`} checked={value === choice} onChange={() => onChange(choice)} />
          <span>{choice}</span>
        </label>
      ))}
    </fieldset>
  )
}
