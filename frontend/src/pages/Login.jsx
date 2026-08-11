import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Hotel, Info, LogIn } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Feedback'
import { normalizeError } from '@/lib/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = location.state?.from?.pathname ?? '/'
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const user = await login(form)
      // Admins land on the dashboard; everyone else goes where they were headed.
      navigate(user.role === 'ADMIN' && redirectTo === '/' ? '/admin' : redirectTo, { replace: true })
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemo = () => setForm({ email: 'admin@hotel.com', password: 'Admin@12345' })

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Hotel className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to manage your reservations at Aurora Grand.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use the email address you registered with.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {error && (
              <Alert variant="error" title="Could not sign in">
                {error.message}
              </Alert>
            )}

            <Field label="Email" required error={error?.fieldErrors?.email}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={update('email')}
                />
              )}
            </Field>

            <Field label="Password" required error={error?.fieldErrors?.password}>
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={update('password')}
                />
              )}
            </Field>

            <Button type="submit" loading={submitting} className="mt-1">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            New here?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Demo credentials are seeded by auth-service on an empty database. */}
      <Alert variant="info" className="mt-5">
        <p className="flex flex-wrap items-center gap-x-1.5">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Demo admin:</span>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">admin@hotel.com</code>
          <span>/</span>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Admin@12345</code>
          <button
            type="button"
            onClick={fillDemo}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Fill
          </button>
        </p>
      </Alert>
    </div>
  )
}
