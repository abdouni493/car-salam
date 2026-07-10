import { supabase } from '../supabase'
import { uploadCarImage } from './uploadCarImage'

/**
 * Données PRIVÉES du propriétaire d'un véhicule en conciergerie (table `car_owners`).
 * ⚠️ Réservé aux écrans admin : cette table n'a aucune policy pour le rôle `anon`.
 */
export interface CarOwnerRow {
  id?: string
  car_id?: string
  owner_name: string
  owner_phone?: string
  /** Généré par un trigger DB (CS-001, CS-002…) — ne jamais l'envoyer à l'insert. */
  internal_ref?: string
  consignment_date?: string
  commission_type: 'amount' | 'percentage'
  commission_value: number
  contract_url?: string
  private_notes?: string
  created_at?: string
  updated_at?: string
}

/** Le sous-ensemble de `car_owners` que les formulaires envoient. */
export type CarOwnerInput = Omit<CarOwnerRow, 'id' | 'car_id' | 'internal_ref' | 'created_at' | 'updated_at'>

export interface Car {
  id?: string
  brand: string
  model: string
  year: number
  plate_number: string
  price_per_day: number
  status: string
  image_url?: string
  created_at?: string
  // Additional fields for full car data
  color?: string
  vin?: string
  energy?: string
  transmission?: string
  seats?: number
  doors?: number
  price_week?: number
  price_month?: number
  deposit?: number
  /** Tarifs euros facultatifs : null ⇒ conversion du tarif DZD au taux courant. */
  price_day_eur?: number | null
  price_week_eur?: number | null
  price_month_eur?: number | null
  deposit_eur?: number | null
  mileage?: number
  fuel_level?: 'full' | 'half' | 'quarter' | 'eighth' | 'empty'
  is_hidden_from_site?: boolean
  ownership_type?: 'personal' | 'consignment'
  /** Description PUBLIQUE (affichée sur le site). */
  description?: string
  /** Présent uniquement via getCarsWithOwners() / getCarOwner() — jamais côté site public. */
  owner?: CarOwnerRow | null
}

export interface AddCarData {
  brand: string
  model: string
  year: number
  plate_number: string
  price_per_day: number
  status: string
  image?: File
  image_url?: string
  // Additional fields
  color?: string
  vin?: string
  energy?: string
  transmission?: string
  seats?: number
  doors?: number
  price_week?: number
  price_month?: number
  deposit?: number
  // Tarifs euros (optionnels : null ⇒ conversion du tarif DZD au taux courant)
  price_day_eur?: number | null
  price_week_eur?: number | null
  price_month_eur?: number | null
  deposit_eur?: number | null
  mileage?: number
  ownership_type?: 'personal' | 'consignment'
  description?: string
  /** Requis quand ownership_type === 'consignment'. */
  owner?: CarOwnerInput
}

/**
 * Add a new car with optional image upload or direct URL
 */
export async function addCar(carData: AddCarData): Promise<{ success: boolean; car?: Car; error?: string }> {
  try {
    let imageUrl: string | undefined

    // Use provided image_url or upload image if provided
    if (carData.image_url) {
      imageUrl = carData.image_url
    } else if (carData.image) {
      const uploadResult = await uploadCarImage(carData.image)
      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error
        }
      }
      imageUrl = uploadResult.url
    }

    // Insert car data into database
    const { data, error } = await supabase
      .from('cars')
      .insert({
        brand: carData.brand,
        model: carData.model,
        year: carData.year,
        plate_number: carData.plate_number,
        price_per_day: carData.price_per_day,
        status: carData.status,
        image_url: imageUrl,
        color: carData.color,
        vin: carData.vin,
        energy: carData.energy,
        transmission: carData.transmission,
        seats: carData.seats,
        doors: carData.doors,
        price_week: carData.price_week,
        price_month: carData.price_month,
        deposit: carData.deposit,
        price_day_eur: carData.price_day_eur ?? null,
        price_week_eur: carData.price_week_eur ?? null,
        price_month_eur: carData.price_month_eur ?? null,
        deposit_eur: carData.deposit_eur ?? null,
        mileage: carData.mileage,
        ownership_type: carData.ownership_type || 'personal',
        description: carData.description,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    // Véhicule en conciergerie : les données du propriétaire vont dans `car_owners`.
    // `internal_ref` est volontairement absent — le trigger DB le génère (CS-001…).
    if (carData.ownership_type === 'consignment' && carData.owner) {
      const { error: ownerError } = await supabase
        .from('car_owners')
        .insert({ ...carData.owner, car_id: data.id })

      if (ownerError) {
        // Rollback manuel : sans propriétaire, une voiture conciergerie n'a pas de sens.
        console.error('Owner insert failed, rolling back car:', ownerError)
        await supabase.from('cars').delete().eq('id', data.id)
        return {
          success: false,
          error: ownerError.message
        }
      }
    }

    return {
      success: true,
      car: data
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}

/**
 * Get all cars
 */
export async function getCars(): Promise<{ success: boolean; cars?: Car[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      cars: data
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}

/**
 * Get a single car by ID
 */
export async function getCar(id: string): Promise<{ success: boolean; car?: Car; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Database error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      car: data
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}

/**
 * Update a car.
 *
 * Quand `updates.owner` est fourni et que la voiture est en conciergerie, les
 * données du propriétaire sont upsertées dans `car_owners`. Si la voiture
 * repasse en 'personal', sa ligne `car_owners` est supprimée.
 */
export async function updateCar(
  id: string,
  updates: Partial<Car>
): Promise<{ success: boolean; car?: Car; error?: string }> {
  try {
    // `owner` n'est pas une colonne de `cars` — on l'extrait avant l'update.
    const { owner, ...carUpdates } = updates

    const { data, error } = await supabase
      .from('cars')
      .update(carUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    if (carUpdates.ownership_type === 'consignment' && owner) {
      // `internal_ref` est géré par la DB : on ne l'écrase jamais depuis l'UI.
      const { internal_ref: _ref, id: _id, created_at: _c, updated_at: _u, ...ownerFields } = owner
      const { error: ownerError } = await supabase
        .from('car_owners')
        .upsert({ ...ownerFields, car_id: id }, { onConflict: 'car_id' })

      if (ownerError) {
        console.error('Owner upsert error:', ownerError)
        return {
          success: false,
          error: ownerError.message
        }
      }
    } else if (carUpdates.ownership_type === 'personal') {
      // Retour en véhicule personnel : plus aucune donnée propriétaire à conserver.
      const { error: deleteError } = await supabase
        .from('car_owners')
        .delete()
        .eq('car_id', id)

      if (deleteError) {
        console.error('Owner delete error:', deleteError)
        return {
          success: false,
          error: deleteError.message
        }
      }
    }

    return {
      success: true,
      car: data
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}

/**
 * Données du propriétaire d'un véhicule. ⚠️ ADMIN UNIQUEMENT — ne jamais appeler
 * depuis `src/components/website/**`.
 */
export async function getCarOwner(
  carId: string
): Promise<{ success: boolean; owner?: CarOwnerRow | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('car_owners')
      .select('*')
      .eq('car_id', carId)
      .maybeSingle()

    if (error) {
      console.error('Database error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, owner: data }
  } catch (error) {
    console.error('Unexpected error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Toutes les voitures avec, pour celles en conciergerie, les données du
 * propriétaire jointes. ⚠️ ADMIN UNIQUEMENT — ne jamais appeler depuis
 * `src/components/website/**`.
 */
export async function getCarsWithOwners(): Promise<{ success: boolean; cars?: Car[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cars')
      .select('*, owner:car_owners(*)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return { success: false, error: error.message }
    }

    // Le join 1-1 remonte un tableau : on l'aplatit.
    const cars = (data || []).map((row: any) => ({
      ...row,
      owner: Array.isArray(row.owner) ? (row.owner[0] ?? null) : (row.owner ?? null),
    }))

    return { success: true, cars }
  } catch (error) {
    console.error('Unexpected error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a car
 */
export async function deleteCar(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('cars')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Database error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}