import { useState } from 'react'
import Avatar from '~/components/ui/Avatar'
import Button from '~/components/ui/Button'
import Card from '~/components/ui/Card'
import Tag from '~/components/ui/Tag'
import type { QuizQuestion } from '~/lib/api/mock'

interface MemoryRepsProps {
  data: QuizQuestion
}

export default function MemoryReps({ data }: MemoryRepsProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer)
    setIsCorrect(answer === data.correctAnswer)
  }

  return (
    <Card className="overflow-hidden shadow-lg">
      <div className="flex flex-col items-center p-6 text-center">
        <Tag variant="primary" className="mb-4">
          DAILY RECALL
        </Tag>

        <Avatar name={data.contactName} size={80} className="mb-4 border-2 border-gray-100" />

        <p className="mb-6 text-lg font-semibold leading-relaxed text-text-main">
          You met this person at the <strong>{data.context}</strong>. What is their name?
        </p>

        <div className="grid w-full grid-cols-2 gap-3">
          {data.options.map((option) => (
            <Button
              key={option}
              variant={
                selectedAnswer === option
                  ? isCorrect
                    ? 'success'
                    : 'danger'
                  : 'default'
              }
              onClick={() => handleAnswer(option)}
              disabled={selectedAnswer !== null}
              className="h-11 text-sm"
            >
              {selectedAnswer === option && isCorrect && '✓ '}
              {selectedAnswer === option && !isCorrect && '✗ '}
              {option}
            </Button>
          ))}
        </div>

        {selectedAnswer && (
          <div className="mt-4 text-center">
            <p className={isCorrect ? 'text-success' : 'text-red-500'}>
              {isCorrect ? '🎉 Correct!' : '❌ Not quite right'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              The answer is: <strong>{data.correctAnswer}</strong>
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
