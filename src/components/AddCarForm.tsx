import React, { useState } from 'react'
import { addCar, AddCarData } from '../services/carService'
import { CarOwnerInfo, Language, OwnershipType } from '../types'
import { CarOwnerFields, OwnershipSelector, emptyOwnerInfo } from './CarOwnerFields'

interface AddCarFormProps {
  onCarAdded?: () => void
  onClose?: () => void
  lang?: Language
}

const blankForm = (): AddCarData => ({
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  plate_number: '',
  price_per_day: 0,
  status: 'available',
  ownership_type: 'personal',
  description: '',
})

const AddCarForm: React.FC<AddCarFormProps> = ({ onCarAdded, onClose, lang = 'fr' }) => {
  const [formData, setFormData] = useState<AddCarData>(blankForm())
  const [ownerInfo, setOwnerInfo] = useState<CarOwnerInfo>(emptyOwnerInfo())

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConsignment = formData.ownership_type === 'consignment'

  const handleOwnershipChange = (ownership_type: OwnershipType) => {
    setError(null)
    setFormData(prev => ({ ...prev, ownership_type }))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'year' || name === 'price_per_day' ? Number(value) : value
    }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      // Create preview URL
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isConsignment && !ownerInfo.ownerName.trim()) {
      setError(lang === 'fr'
        ? 'Le nom du propriétaire est requis pour un véhicule en conciergerie.'
        : 'اسم المالك مطلوب للمركبة بالوكالة.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await addCar({
        ...formData,
        image: imageFile || undefined,
        // `internal_ref` est omis : le trigger DB le génère (CS-001, CS-002…).
        owner: isConsignment
          ? {
              owner_name: ownerInfo.ownerName.trim(),
              owner_phone: ownerInfo.ownerPhone || undefined,
              consignment_date: ownerInfo.consignmentDate || undefined,
              commission_type: ownerInfo.commissionType,
              commission_value: ownerInfo.commissionValue,
              contract_url: ownerInfo.contractUrl || undefined,
              private_notes: ownerInfo.privateNotes || undefined,
            }
          : undefined,
      })

      if (result.success) {
        // Reset form
        setFormData(blankForm())
        setOwnerInfo(emptyOwnerInfo())
        setImageFile(null)
        setImagePreview(null)

        onCarAdded?.()
        onClose?.()
      } else {
        setError(result.error || 'Failed to add car')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Add New Car</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <OwnershipSelector
          value={formData.ownership_type || 'personal'}
          onChange={handleOwnershipChange}
          lang={lang}
        />

        {isConsignment && (
          <CarOwnerFields value={ownerInfo} onChange={setOwnerInfo} lang={lang} />
        )}

        <div>
          <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
            Brand
          </label>
          <input
            type="text"
            id="brand"
            name="brand"
            value={formData.brand}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Toyota"
          />
        </div>

        <div>
          <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
            Model
          </label>
          <input
            type="text"
            id="model"
            name="model"
            value={formData.model}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Camry"
          />
        </div>

        <div>
          <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
            Year
          </label>
          <input
            type="number"
            id="year"
            name="year"
            value={formData.year}
            onChange={handleInputChange}
            required
            min="1900"
            max={new Date().getFullYear() + 1}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="plate_number" className="block text-sm font-medium text-gray-700 mb-1">
            Plate Number
          </label>
          <input
            type="text"
            id="plate_number"
            name="plate_number"
            value={formData.plate_number}
            onChange={handleInputChange}
            required={!isConsignment}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={isConsignment
              ? (lang === 'fr' ? 'Optionnelle — visible uniquement par vous' : 'اختياري — مرئي لك فقط')
              : 'e.g., ABC-123'}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            {lang === 'fr' ? 'Description (affichée sur le site public)' : 'الوصف (يُعرض على الموقع العام)'}
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={formData.description || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="price_per_day" className="block text-sm font-medium text-gray-700 mb-1">
            Price per Day ($)
          </label>
          <input
            type="number"
            id="price_per_day"
            name="price_per_day"
            value={formData.price_per_day}
            onChange={handleInputChange}
            required
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="50.00"
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="available">Available</option>
            <option value="rented">Rented</option>
            <option value="maintenance">Maintenance</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>

        <div>
          <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
            Car Image (Optional)
          </label>
          <input
            type="file"
            id="image"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {imagePreview && (
            <div className="mt-2">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-32 object-cover rounded-md"
              />
            </div>
          )}
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Adding Car...' : 'Add Car'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default AddCarForm