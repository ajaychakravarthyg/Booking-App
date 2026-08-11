import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Hotel, UserPlus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Feedback'
import { normalizeError } from '@/lib/api'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState(null)
  const [localErrors, setLocalErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (event) => {
    setForm({ ...form, [key]: event.target.value })
    setLocalErrors((current) => ({ ...current, [key]: undefined }))
  }

  const validate = () => {
    const errors = {}
    if (form.name.trim().length < 2) errors.name = 'Please enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.'
    // Mirrors auth-service's @Size(min = 8) so the user is not told by a round trip.
    if (form.password.length < 8) errors.password = 'Use at least 8 characters.'
    if (form.confirm !== form.password) errors.confirm = 'Passwords do not match.'
    return errors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setLocalErrors(errors)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      // The API deliberately ignores any role sent here — every self-registration is a
      // CUSTOMER, so there is no role field on this form.
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (key) => localErrors[key] ?? error?.fieldErrors?.[key]

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Hotel className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It takes a moment, and you can book straight away.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>Your password is stored only as a BCrypt hash.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {error && (
              <Alert variant="error" title="Could not create your account">
                {error.message}
              </Alert>
            )}

            <Field label="Full name" required error={fieldError('name')}>
              {(props) => (
                <Input
                  {...props}
                  autoComplete="name"
                  required
                  placeholder="Ada Lovelace"
                  value={form.name}
                  onChange={update('name')}
                />
              )}
            </Field>

            <Field label="Email" required error={fieldError('email')}>
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

            <Field label="Password" required error={fieldError('password')} hint="At least 8 characters.">
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={update('password')}
                />
              )}
            </Field>

            <Field label="Confirm password" required error={fieldError('confirm')}>
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={update('confirm')}
                />
              )}
            </Field>

            <Button type="submit" loading={submitting} className="mt-1">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Create account
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
