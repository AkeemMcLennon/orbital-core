import { data } from 'react-router'
import FaceStream from '~/components/dashboard/FaceStream'
import MemoryReps from '~/components/dashboard/MemoryReps'
import Timeline from '~/components/dashboard/Timeline'
import { getRecentContacts, getQuizOfTheDay, getTimelineEntries } from '~/lib/api/mock'
import type { Route } from './+types/_index'

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Dashboard - Orbital' },
    { name: 'description', content: 'Your relationship dashboard' },
  ]
}

export async function loader(_: Route.LoaderArgs) {
  const recentContacts = getRecentContacts(10)
  const quizData = getQuizOfTheDay()
  const timelineData = getTimelineEntries(10)

  return data({
    recentContacts,
    quizData,
    timelineData,
  })
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { recentContacts, quizData, timelineData } = loaderData

  return (
    <div
      className="min-h-screen pb-20"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Face Stream */}
      <div className="border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="mx-auto max-w-container px-5 py-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">
            Recently Met
          </h2>
        </div>
        <FaceStream contacts={recentContacts} />
      </div>

      {/* Memory Reps */}
      <div className="mx-auto max-w-container px-5 py-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">
          Memory Reps
        </h2>
        {quizData ? (
          <MemoryReps data={quizData} />
        ) : (
          <div
            className="rounded-card p-6 text-center text-text-muted"
            style={{ backgroundColor: 'var(--bg-card)' }}
          >
            No quizzes available
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="mx-auto max-w-container px-5 pb-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">
          Timeline
        </h2>
        <Timeline items={timelineData} />
      </div>
    </div>
  )
}
