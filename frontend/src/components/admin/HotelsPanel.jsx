import { useCallback, useEffect, useState } from 'react'
import { Building2, Image as ImageIcon, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { hotelsApi, normalizeError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Alert, Badge, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { PanelHero } from '@/components/PageHero'
import { RoomThumb } from '@/components/RoomThumb'
import { HERO } from '@/lib/images'
import { formatMoney, pluralize } from '@/lib/format'

const BLANK = {
  name: '',
  city: '',
  country: '',
  address: '',
  description: '',
  starRating: '',
  imageUrl: '',
  amenities: '',
  active: true,
}

function toFormState(hotel) {
  return {
    name: hotel.name ?? '',
    city: hotel.city ?? '',
    country: hotel.country ?? '',
    address: hotel.address ?? '',
    description: hotel.description ?? '',
    starRating: hotel.starRating == null ? '' : String(hotel.starRating),
    imageUrl: hotel.imageUrl ?? '',
    amenities: (hotel.amenities ?? []).join(', '),
    active: hotel.active ?? true,
  }
}

export function HotelsPanel({ onChanged }) {
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [editing, setEditing] = useState(null) // hotel being edited, or 'new'
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
      // No `active` filter: an admin must see de-listed properties too.
      const { data } = await hotelsApi.list()
      setHotels(data)
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

  const openEdit = (hotel) => {
    setEditing(hotel)
    setForm(toFormState(hotel))
    setSaveError(null)
    setPreviewFailed(false)
  }

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    if (key === 'imageUrl') setPreviewFailed(false)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)

    const payload = {
      name: form.name.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      address: form.address.trim() || null,
      description: form.description.trim() || null,
      // Empty means unrated, which the API accepts as null.
      starRating: form.starRating === '' ? null : Number(form.starRating),
      imageUrl: form.imageUrl.trim() || null,
      amenities: form.amenities
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      active: Boolean(form.active),
    }

    try {
      if (editing === 'new') {
        const { data } = await hotelsApi.create(payload)
        setHotels((current) => [...current, data])
        setNotice(`${data.name} was added in ${data.city}.`)
      } else {
        const { data } = await hotelsApi.update(editing.id, payload)
        setHotels((current) => current.map((h) => (h.id === data.id ? data : h)))
        setNotice(`${data.name} was updated.`)
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
      await hotelsApi.remove(toDelete.id)
      setHotels((current) => current.filter((h) => h.id !== toDelete.id))
      setNotice(`${toDelete.name} and its rooms were deleted.`)
      setToDelete(null)
      onChanged?.()
    } catch (err) {
      setDeleteError(err.status ? err : normalizeError(err))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <PageLoader label="Loading hotels" />

  const cities = new Set(hotels.map((h) => h.city))

  return (
    <div>
      <PanelHero
        image={HERO.inventory}
        title="Properties"
        description={`${pluralize(hotels.length, 'hotel')} across ${pluralize(
          cities.size,
          'city',
          'cities',
        )} · ${hotels.filter((h) => h.active).length} listed`}
        action={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add hotel
          </Button>
        }
      />

      {notice && (
        <Alert variant="success" className="mb-4">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert variant="error" title="Could not load hotels" onRetry={load} className="mb-4">
          {error.message}
        </Alert>
      )}

      {hotels.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No hotels yet"
          description="Add a property first — rooms belong to a hotel, so nothing can be booked until one exists."
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add hotel
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Photo</span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">Hotel</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Location</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Rating</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Rooms</th>
                  <th scope="col" className="px-4 py-3 font-semibold">From</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {hotels.map((hotel) => (
                  <tr key={hotel.id} className="transition-colors hover:bg-muted/30">
                    <td className="py-2 pl-4 pr-0">
                      <RoomThumb imageUrl={hotel.imageUrl} roomNumber={hotel.name} size={44} />
                    </td>
                    <td className="px-4 py-3 font-medium">{hotel.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        {hotel.city}
                      </span>
                      <span className="block text-xs">{hotel.country}</span>
                    </td>
                    <td className="px-4 py-3">
                      {hotel.starRating ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden="true" />
                          {hotel.starRating}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">unrated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{hotel.roomCount ?? 0}</td>
                    <td className="px-4 py-3">
                      {hotel.priceFrom ? formatMoney(hotel.priceFrom) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={hotel.active ? 'success' : 'destructive'}>
                        {hotel.active ? 'Listed' : 'De-listed'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(hotel)}
                          aria-label={`Edit ${hotel.name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeleteError(null)
                            setToDelete(hotel)
                          }}
                          aria-label={`Delete ${hotel.name}`}
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
        title={editing === 'new' ? 'Add a hotel' : `Edit ${editing?.name ?? ''}`}
        description="The city you type becomes a searchable destination, so reuse an existing spelling to group properties together."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="hotel-form" loading={saving}>
              {editing === 'new' ? 'Create hotel' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="hotel-form" onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
          {saveError && (
            <Alert variant="error" title="Could not save">
              {saveError.message}
            </Alert>
          )}

          <Field label="Hotel name" required error={saveError?.fieldErrors?.name}>
            {(props) => (
              <Input
                {...props}
                required
                placeholder="The Riverside Grand"
                value={form.name}
                onChange={update('name')}
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="City"
              required
              error={saveError?.fieldErrors?.city}
              hint="Appears in destination search"
            >
              {(props) => (
                <Input
                  {...props}
                  required
                  list="known-cities"
                  placeholder="Lisbon"
                  value={form.city}
                  onChange={update('city')}
                />
              )}
            </Field>

            <Field label="Country" required error={saveError?.fieldErrors?.country}>
              {(props) => (
                <Input
                  {...props}
                  required
                  placeholder="Portugal"
                  value={form.country}
                  onChange={update('country')}
                />
              )}
            </Field>
          </div>

          {/* Existing spellings offered as suggestions, because the destination list groups
              on an exact match — "Lisbon" and "lisbon " would otherwise split in two. */}
          <datalist id="known-cities">
            {[...cities].sort().map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Star rating" error={saveError?.fieldErrors?.starRating}>
              {(props) => (
                <Select {...props} value={form.starRating} onChange={update('starRating')}>
                  <option value="">Unrated</option>
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <option key={stars} value={stars}>
                      {stars} star{stars > 1 ? 's' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Address" error={saveError?.fieldErrors?.address}>
              {(props) => (
                <Input
                  {...props}
                  placeholder="12 Rua do Comércio"
                  value={form.address}
                  onChange={update('address')}
                />
              )}
            </Field>
          </div>

          <Field label="Description" error={saveError?.fieldErrors?.description}>
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                placeholder="A restored merchant house on the waterfront…"
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

          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="relative aspect-[16/10] w-36 shrink-0 overflow-hidden rounded-md bg-muted">
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
                  ? 'No image set — the destination card and hotel header will show a placeholder.'
                  : previewFailed
                    ? 'That URL could not be loaded. Check it before saving.'
                    : 'Also used as the photo for this hotel’s city in destination search.'}
              </p>
            </div>
          </div>

          <Field
            label="Facilities"
            hint="Comma separated. Property-level, distinct from a room's amenities."
            error={saveError?.fieldErrors?.amenities}
          >
            {(props) => (
              <Input
                {...props}
                placeholder="Pool, Spa, Airport shuttle"
                value={form.amenities}
                onChange={update('amenities')}
              />
            )}
          </Field>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
            <input
              type="checkbox"
              checked={form.active}
              onChange={update('active')}
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            <span className="text-sm">
              <span className="font-medium">Listed</span>
              <span className="mt-0.5 block text-muted-foreground">
                Unchecking hides the property and every room in it from guests, and removes the
                city from destination search if this was its only hotel. The safe alternative to
                deleting.
              </span>
            </span>
          </label>
        </form>
      </Modal>

      {/* ── Delete ─────────────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(toDelete)}
        onClose={() => !deleting && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? ''}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Keep hotel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} loading={deleting}>
              Delete hotel and rooms
            </Button>
          </>
        }
      >
        {deleteError && (
          <Alert variant="error" title="Could not delete" className="mb-4">
            {deleteError.message}
          </Alert>
        )}
        <Alert variant="warning" title="This also deletes its rooms">
          {toDelete?.roomCount
            ? `All ${pluralize(toDelete.roomCount, 'room')} at this property will be removed — a room cannot exist without its hotel. `
            : 'Any rooms at this property will be removed. '}
          Past bookings stay readable because each one snapshots its room and hotel, but future
          bookings would be orphaned. Un-ticking “Listed” hides it without destroying anything.
        </Alert>
      </Modal>
    </div>
  )
}
