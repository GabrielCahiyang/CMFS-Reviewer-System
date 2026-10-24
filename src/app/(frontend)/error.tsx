'use client'

import { AlertTriangle } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'

export default function FrontendError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-lg">
        <EmptyState
          icon={<AlertTriangle />}
          title="Let’s turn a fresh page."
          description="Something interrupted this view. Your previously confirmed study progress is preserved. Try reloading the view, or return to the dashboard."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={reset}>Try again</Button>
              <Button variant="secondary" onClick={() => window.location.assign('/')}>
                Back to dashboard
              </Button>
            </div>
          }
        />
      </div>
    </main>
  )
}
