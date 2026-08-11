import { useCallback, useEffect, useState } from 'react'
import { Trash2, UserCog, Users } from 'lucide-react'
import { normalizeError, usersApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Alert, Badge, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { PanelHero } from '@/components/PageHero'
import { HERO } from '@/lib/images'
import { formatDateTime } from '@/lib/format'

export function UsersPanel({ onChanged }) {
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await usersApi.list()
      setUsers(data)
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const changeRole = async (user, role) => {
    setBusyId(user.id)
    setError(null)
    try {
      const { data } = await usersApi.updateRole(user.id, role)
      setUsers((current) => current.map((item) => (item.id === data.id ? data : item)))
      setNotice(`${data.name} is now ${data.role === 'ADMIN' ? 'an administrator' : 'a customer'}.`)
      onChanged?.()
    } catch (err) {
      // The API refuses to demote the last remaining admin; surface that reason verbatim.
      setError(err.status ? err : normalizeError(err))
    } finally {
      setBusyId(null)
    }
  }

  const toggleStatus = async (user) => {
    setBusyId(user.id)
    setError(null)
    try {
      const { data } = await usersApi.updateStatus(user.id, !user.enabled)
      setUsers((current) => current.map((item) => (item.id === data.id ? data : item)))
      setNotice(`${data.name} was ${data.enabled ? 'activated' : 'deactivated'}.`)
      onChanged?.()
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await usersApi.remove(toDelete.id)
      setUsers((current) => current.filter((item) => item.id !== toDelete.id))
      setNotice(`${toDelete.name} was deleted.`)
      setToDelete(null)
      onChanged?.()
    } catch (err) {
      setDeleteError(err.status ? err : normalizeError(err))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <PageLoader label="Loading users" />

  return (
    <div>
      <PanelHero
        image={HERO.guests}
        title="Users"
        description={`${users.length} ${users.length === 1 ? 'account' : 'accounts'} · deactivating is preferred over deleting, as it blocks sign-in while keeping booking history attributable`}
      />

      {notice && (
        <Alert variant="success" className="mb-4">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert variant="error" title="Action failed" className="mb-4">
          {error.message}
        </Alert>
      )}

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No users" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[50rem] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => {
                  const isSelf = user.id === currentUser?.id
                  const busy = busyId === user.id

                  return (
                    <tr key={user.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="font-medium">{user.name}</span>
                        {isSelf && (
                          <Badge variant="primary" className="ml-2">
                            You
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={user.role}
                          disabled={busy}
                          onChange={(event) => changeRole(user, event.target.value)}
                          className="w-32"
                          aria-label={`Role for ${user.name}`}
                        >
                          <option value="CUSTOMER">Customer</option>
                          <option value="ADMIN">Admin</option>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.enabled ? 'success' : 'muted'}>
                          {user.enabled ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy || isSelf}
                            onClick={() => toggleStatus(user)}
                            // Self-deactivation is blocked server-side too; disabling the
                            // control just avoids offering a guaranteed failure.
                            title={isSelf ? 'You cannot deactivate your own account' : undefined}
                          >
                            <UserCog className="h-4 w-4" aria-hidden="true" />
                            {user.enabled ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy || isSelf}
                            onClick={() => {
                              setDeleteError(null)
                              setToDelete(user)
                            }}
                            aria-label={`Delete ${user.name}`}
                            title={isSelf ? 'You cannot delete your own account' : undefined}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(toDelete)}
        onClose={() => !deleting && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? ''}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Keep account
            </Button>
            <Button variant="destructive" onClick={confirmDelete} loading={deleting}>
              Delete permanently
            </Button>
          </>
        }
      >
        {deleteError && (
          <Alert variant="error" title="Could not delete" className="mb-4">
            {deleteError.message}
          </Alert>
        )}
        <Alert variant="warning" title="Deactivating is usually the better option">
          Their bookings live in a separate service and keep a copy of the guest&apos;s name and
          email, so past reservations stay readable. But the account itself is gone for good and
          the email becomes reusable.
        </Alert>
      </Modal>
    </div>
  )
}
