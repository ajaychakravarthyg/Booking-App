import { useCallback, useEffect, useState } from 'react'
import { BedDouble, Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { normalizeError, roomsApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Alert, Badge, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { PanelHero } from '@/components/PageHero'
import { RoomThumb } from '@/components/RoomThumb'
import { HERO } from '@/lib/images'
import { formatMoney } from '@/lib/format'

const BLANK = {
  roomNumber: '',
  type: 'DOUBLE',
  pricePerNight: '',
  capacity: 2,
  description: '',
  imageUrl: '',
  amenities: '',
  available: true,
}

function toFormState(room) {
  return {
    roomNumber: room.roomNumber ?? '',
    type: room.type ?? 'DOUBLE',
    pricePerNight: String(room.pricePerNight ?? ''),
    capacity: room.capacity ?? 2,
    description: room.description ?? '',
    imageUrl: room.imageUrl ?? '',
    // The API exposes amenities as an array; a comma-separated field is far easier to
    // edit by hand than a repeater widget.
    amenities: (room.amenities ?? []).join(', '),
    available: room.available ?? true,
  }
}

export function RoomsPanel({ roomTypes, onChanged }) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [editing, setEditing] = useState(null) // room being edited, or 'new'
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [previewFailed, setPreviewFailed] = useState(false)

  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // No `available` filter: admins must see out-of-service rooms too.
      const { data } = await roomsApi.list()
      setRooms(data)
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openNew = () => {
    setEditing('new')
    setForm(BLANK)
    setSaveError(null)
    setPreviewFailed(false)
  }

  const openEdit = (room) => {
    setEditing(room)
    setForm(toFormState(room))
    setSaveError(null)
    setPreviewFailed(false)
  }

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    // A new URL deserves a fresh attempt; otherwise one bad paste latches the error on.
    if (key === 'imageUrl') setPreviewFailed(false)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)

    const payload = {
      roomNumber: form.roomNumber.trim(),
      type: form.type,
      pricePerNight: Number(form.pricePerNight),
      capacity: Number(form.capacity),
      description: form.description.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      amenities: form.amenities
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      available: Boolean(form.available),
    }

    try {
      if (editing === 'new') {
        const { data } = await roomsApi.create(payload)
        setRooms((current) => [...current, data])
        setNotice(`Room ${data.roomNumber} was created.`)
      } else {
        const { data } = await roomsApi.update(editing.id, payload)
        setRooms((current) => current.map((room) => (room.id === data.id ? data : room)))
        setNotice(`Room ${data.roomNumber} was updated.`)
      }
      setEditing(null)
      onChanged?.()
    } catch (err) {
      setSaveError(err.status ? err : normalizeError(err))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await roomsApi.remove(toDelete.id)
      setRooms((current) => current.filter((room) => room.id !== toDelete.id))
      setNotice(`Room ${toDelete.roomNumber} was deleted.`)
      setToDelete(null)
      onChanged?.()
    } catch (err) {
      setDeleteError(err.status ? err : normalizeError(err))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <PageLoader label="Loading rooms" />

  return (
    <div>
      <PanelHero
        image={HERO.inventory}
        title="Room inventory"
        description={`${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} in the catalog · ${
          rooms.filter((r) => r.available).length
        } in service`}
        action={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add room
          </Button>
        }
      />

      {notice && (
        <Alert variant="success" className="mb-4">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert variant="error" title="Could not load rooms" onRetry={load} className="mb-4">
          {error.message}
        </Alert>
      )}

      {rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No rooms yet"
          description="Add your first room to start taking bookings."
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add room
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Horizontal scroll rather than a cramped layout — a data table with 6 columns
              cannot compress onto a phone without becoming unreadable. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Photo</span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">Room</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Rate</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Sleeps</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rooms.map((room) => (
                  <tr key={room.id} className="transition-colors hover:bg-muted/30">
                    <td className="py-2 pl-4 pr-0">
                      <RoomThumb imageUrl={room.imageUrl} roomNumber={room.roomNumber} size={44} />
                    </td>
                    <td className="px-4 py-3 font-medium">{room.roomNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{room.typeLabel}</td>
                    <td className="px-4 py-3">{formatMoney(room.pricePerNight)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{room.capacity}</td>
                    <td className="px-4 py-3">
                      <Badge variant={room.available ? 'success' : 'destructive'}>
                        {room.available ? 'In service' : 'Out of service'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(room)}
                          aria-label={`Edit room ${room.roomNumber}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeleteError(null)
                            setToDelete(room)
                          }}
                          aria-label={`Delete room ${room.roomNumber}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Create / edit ──────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(editing)}
        onClose={() => !saving && setEditing(null)}
        title={editing === 'new' ? 'Add a room' : `Edit room ${editing?.roomNumber ?? ''}`}
        description="Changing the rate does not alter existing bookings — each one keeps the price it was made at."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="room-form" loading={saving}>
              {editing === 'new' ? 'Create room' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="room-form" onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
          {saveError && (
            <Alert variant="error" title="Could not save">
              {saveError.message}
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Room number" required error={saveError?.fieldErrors?.roomNumber}>
              {(props) => (
                <Input {...props} required placeholder="101" value={form.roomNumber} onChange={update('roomNumber')} />
              )}
            </Field>

            <Field label="Type" required error={saveError?.fieldErrors?.type}>
              {(props) => (
                <Select {...props} value={form.type} onChange={update('type')}>
                  {(roomTypes ?? []).map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Price per night" required error={saveError?.fieldErrors?.pricePerNight}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="149.99"
                  value={form.pricePerNight}
                  onChange={update('pricePerNight')}
                />
              )}
            </Field>

            <Field label="Capacity" required error={saveError?.fieldErrors?.capacity}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  required
                  min="1"
                  max="20"
                  value={form.capacity}
                  onChange={update('capacity')}
                />
              )}
            </Field>
          </div>

          <Field label="Description" error={saveError?.fieldErrors?.description}>
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                placeholder="Bright double with a city view…"
                value={form.description}
                onChange={update('description')}
              />
            )}
          </Field>

          <Field
            label="Image URL"
            hint="Any public image URL. Leave blank to show a placeholder."
            error={saveError?.fieldErrors?.imageUrl}
          >
            {(props) => (
              <Input
                {...props}
                type="url"
                placeholder="https://images.unsplash.com/…"
                value={form.imageUrl}
                onChange={update('imageUrl')}
              />
            )}
          </Field>

          {/* Live preview. Room images are arbitrary external URLs, so showing the result
              before saving is the only way an admin finds out the link is wrong without
              publishing a broken card to every guest. */}
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="relative aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-md bg-muted">
              {form.imageUrl.trim() && !previewFailed ? (
                <img
                  src={form.imageUrl.trim()}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-medium">Preview</p>
              <p className="mt-0.5 text-muted-foreground">
                {!form.imageUrl.trim()
                  ? 'No image set — guests will see a placeholder tile.'
                  : previewFailed
                    ? 'That URL could not be loaded. Check it before saving.'
                    : 'This is how the photo will be cropped on the room card.'}
              </p>
            </div>
          </div>

          <Field label="Amenities" hint="Comma separated." error={saveError?.fieldErrors?.amenities}>
            {(props) => (
              <Input
                {...props}
                placeholder="Wi-Fi, Air conditioning, Balcony"
                value={form.amenities}
                onChange={update('amenities')}
              />
            )}
          </Field>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
            <input
              type="checkbox"
              checked={form.available}
              onChange={update('available')}
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            <span className="text-sm">
              <span className="font-medium">In service</span>
              <span className="mt-0.5 block text-muted-foreground">
                Unchecking takes the room off sale for all dates. This is the safe alternative
                to deleting it.
              </span>
            </span>
          </label>
        </form>
      </Modal>

      {/* ── Delete ─────────────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(toDelete)}
        onClose={() => !deleting && setToDelete(null)}
        title={`Delete room ${toDelete?.roomNumber ?? ''}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Keep room
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
        <Alert variant="warning" title="Consider taking it out of service instead">
          Past bookings stay readable because each one stores its own copy of the room, but any
          future booking for this room would be left orphaned. Unchecking “In service” removes
          it from sale while keeping the record intact.
        </Alert>
      </Modal>
    </div>
  )
}
