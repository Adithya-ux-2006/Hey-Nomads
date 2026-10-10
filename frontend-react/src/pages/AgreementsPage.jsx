import { apiFetch } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import Layout from '../components/Layout'
import { Card, ButtonLink, Spinner, EmptyState, ErrorState } from '../components/UI'
import UserAvatar from '../components/UserAvatar'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'

const excerpt = (content, len = 140) => {
  if (!content) return 'No content yet.'
  const line = content.split('\n').find(l => l.trim() && !l.startsWith('ROOMMATE AGREEMENT')) || ''
  const text = line.trim()
  return text.length > len ? `${text.slice(0, len)}...` : text
}

export default function AgreementsPage() {
  const { data, loading, error, retry } = useAsync(
    () => apiFetch('/agreements').then(d => (Array.isArray(d) ? d : [])),
    []
  )
  const agreements = data || []

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Agreements</h1>
        <p className="text-sm text-text-muted mb-6">
          Written terms for the people you have matched with.
        </p>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : error ? (
          <ErrorState what="agreements" error={error} onRetry={retry} />
        ) : agreements.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No agreements yet"
            description="Once you and a roommate match, you can draft shared terms for rent, chores and guests."
            action={<ButtonLink to="/matches">See your matches</ButtonLink>}
          />
        ) : (
          <div className="space-y-4">
            {agreements.map(a => (
              <Card key={a.id} className="p-4 flex items-center gap-4">
                <UserAvatar src={a.partner_image} name={a.partner_name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary truncate">
                      {a.partner_name}
                    </h3>
                    <span className="text-xs text-text-muted">
                      {a.status === 'template' ? 'Not started' : a.status}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted truncate mt-0.5">
                    {excerpt(a.content)}
                  </p>
                </div>
                <Link
                  to={`/agreement/${a.partner_id}`}
                  className="px-3 py-2 rounded-lg bg-brand-coral text-white text-xs font-semibold hover:bg-brand-coral-dark transition-colors"
                >
                  {a.status === 'template' ? 'Draft' : 'Open'}
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}