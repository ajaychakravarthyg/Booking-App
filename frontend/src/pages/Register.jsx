import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Feedback'
import { AuthLayout } from '@/components/AuthLayout'
import { normalizeError } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Password strength, scored on the rules the API actually enforces plus a couple of habits
 * worth encouraging. Deliberately advisory: the only hard rule is 8 characters, and inventing
 * stricter client-side rules than the server has is how forms end up rejecting valid input.
 */
function scorePassword(password) {
  if (!password) return { score: 0, label: '', hints: [] }

  const checks = [
    { pass: password.length >= 8, hint: 'at least 8 characters' },
    { pass: password.length >= 12, hint: '12+ for a stronger one' },
    { pass: /[A-Z]/.test(password) && /[a-z]/.test(password), hint: 'mixed case' },
    { pass: /\d/.test(password), hint: 'a number' },
    { pass: /[^A-Za-z0-9]/.test(password), hint: 'a symbol' },
  ]

  const score = checks.filter((check) => check.pass).length
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']

  return {
    score,
    label: labels[score],
    hints: checks.filter((check) => !check.pass).map((check) => check.hint),
  }
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
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
    // Mirrors auth-service's @Size(min = 8) exactly — no stricter, or the form would reject
    // passwords the API would happily accept.
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
      // The API ignores any role sent here — every self-registration is a CUSTOMER, which is
      // why this form has no role field.
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (key) => localErrors[key] ?? error?.fieldErrors?.[key]
  const strength = scorePassword(form.password)

  const strengthColours = [
    'bg-muted',
    'bg-destructive',
    'bg-warning',
    'bg-warning',
    'bg-success',
    'bg-success',
  ]

  return (
    <AuthLayout
      eyebrow="Start exploring"
      title="Create your account"
      subtitle="It takes a moment, and you can book straight away."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
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

        <Field label="Password" required error={fieldError('password')}>
          {(props) => (
            <div className="relative">
              <Input
                {...props}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={form.password}
                onChange={update('password')}
                className="pr-11"
              />
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

        {/* Strength meter. aria-live keeps it announced without stealing focus mid-typing. */}
        {form.password && (
          <div aria-live="polite">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((step) => (
                <span
                  key={step}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    step <= strength.score ? strengthColours[strength.score] : 'bg-muted',
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{strength.label}</span>
              {strength.hints.length > 0 && <> — try adding {strength.hints[0]}</>}
            </p>
          </div>
        )}

        <Field label="Confirm password" required error={fieldError('confirm')}>
          {(props) => (
            <div className="relative">
              <Input
                {...props}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={form.confirm}
                onChange={update('confirm')}
                className="pr-11"
              />
              {form.confirm && form.confirm === form.password && (
                <span className="absolute inset-y-0 right-0 flex items-center px-3 text-success">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Passwords match</span>
                </span>
              )}
            </div>
          )}
        </Field>

        <Button
          type="submit"
          loading={submitting}
          size="lg"
          className="bg-travel-sweep mt-2 border-0 text-white hover:opacity-95"
        >
          Create account
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Your password is stored only as a BCrypt hash — never in plain text.
        </p>
      </form>
    </AuthLayout>
  )
}
