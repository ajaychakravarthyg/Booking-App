import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Info } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Feedback'
import { AuthLayout } from '@/components/AuthLayout'
import { normalizeError } from '@/lib/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
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
      navigate(user.role === 'ADMIN' && redirectTo === '/' ? '/admin' : redirectTo, {
        replace: true,
      })
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to Staylo"
      subtitle="Pick up where you left off — your bookings and saved dates are waiting."
      footer={
        <>
          <p className="text-center text-sm text-muted-foreground">
            New here?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>

          {/* Seeded by auth-service on an empty database, so a reviewer can get straight in. */}
          <Alert variant="info" className="mt-5">
            <p className="flex flex-wrap items-center gap-x-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Demo admin:</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">admin@hotel.com</code>
              <span>/</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Admin@12345</code>
              <button
                type="button"
                onClick={() => setForm({ email: 'admin@hotel.com', password: 'Admin@12345' })}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Fill
              </button>
            </p>
          </Alert>
        </>
      }
    >
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
            <div className="relative">
              <Input
                {...props}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={form.password}
                onChange={update('password')}
                className="pr-11"
              />
              {/* Reveal toggle, from the 21st.dev reference. Genuinely useful on a phone
                  keyboard, and the accessible name flips with the state. */}
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          )}
        </Field>

        <Button
          type="submit"
          loading={submitting}
          size="lg"
          className="bg-travel-sweep mt-2 border-0 text-white hover:opacity-95"
        >
          Sign in
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </AuthLayout>
  )
}
