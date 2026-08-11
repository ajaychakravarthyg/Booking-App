import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/Feedback'
import { buttonClasses } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That link does not lead anywhere. It may have moved, or never existed."
        action={
          <Link to="/" className={buttonClasses({})}>
            Back to rooms
          </Link>
        }
      />
    </div>
  )
}
