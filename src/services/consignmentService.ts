import { supabase } from '../supabase'
import type { CommissionType } from '../types'

/**
 * Service CONCIERGERIE — ⚠️ ADMIN UNIQUEMENT.
 *
 * Ne jamais importer ce fichier depuis `src/components/website/**` : il lit
 * `car_owners` et la vue `consignment_earnings`, qui exposent le nom, le
 * téléphone et la commission du propriétaire. Ces objets n'ont aucune policy
 * pour le rôle `anon` — un appel depuis le site public échouerait de toute
 * façon, mais la règle reste : ces données ne quittent pas l'admin.
 */

/** Une ligne de la vue `consignment_earnings` : un véhicule confié. */
export interface ConsignmentEarnings {
  carId: string
  brand: string
  model: string
  plateNumber: string | null
  internalRef: string | null
  ownerName: string
  ownerPhone: string | null
  commissionType: CommissionType
  commissionValue: number
  completedRentals: number
  /** Chiffre d'affaires des locations terminées. */
  grossRevenue: number
  /** Part de l'agence (snapshot figé à la clôture de chaque location). */
  agencyCommission: number
  /** Frais de livraison pris en charge par le propriétaire (locations >= 10 jours). */
  ownerDeliveryFees: number
  /** Ce qu'il reste à reverser au propriétaire. */
  ownerPayout: number
}

/**
 * Modifie la commission d'un véhicule en conciergerie. Librement modifiable à
 * tout moment : les locations déjà terminées conservent leur montant figé
 * (`reservations.commission_amount`), seules les suivantes utiliseront la
 * nouvelle valeur.
 */
export async function updateCommission(
  carId: string,
  commissionType: CommissionType,
  commissionValue: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!Number.isFinite(commissionValue) || commissionValue < 0) {
      return { success: false, error: 'La commission doit être un nombre positif' }
    }
    if (commissionType === 'percentage' && commissionValue > 100) {
      return { success: false, error: 'Le pourcentage ne peut pas dépasser 100 %' }
    }

    const { error } = await supabase
      .from('car_owners')
      .update({ commission_type: commissionType, commission_value: commissionValue })
      .eq('car_id', carId)

    if (error) {
      console.error('Database error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Total des commissions encaissées par l'agence sur les locations de conciergerie
 * clôturées depuis le 1er du mois. Lit le snapshot figé `commission_amount`.
 */
export async function getMonthlyAgencyCommission(): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data, error } = await supabase
    .from('reservations')
    .select('commission_amount')
    .eq('status', 'completed')
    .gte('completed_at', startOfMonth)

  if (error) {
    console.error('Database error:', error)
    return 0
  }

  return (data || []).reduce((sum: number, r: any) => sum + Number(r.commission_amount || 0), 0)
}

/** Gains, commissions et reversements par véhicule en conciergerie. */
export async function getConsignmentEarnings(): Promise<{
  success: boolean
  earnings?: ConsignmentEarnings[]
  error?: string
}> {
  try {
    const { data, error } = await supabase.from('consignment_earnings').select('*')

    if (error) {
      console.error('Database error:', error)
      return { success: false, error: error.message }
    }

    const earnings: ConsignmentEarnings[] = (data || []).map((row: any) => ({
      carId: row.car_id,
      brand: row.brand,
      model: row.model,
      plateNumber: row.plate_number ?? null,
      internalRef: row.internal_ref ?? null,
      ownerName: row.owner_name,
      ownerPhone: row.owner_phone ?? null,
      commissionType: row.commission_type,
      commissionValue: Number(row.commission_value || 0),
      completedRentals: Number(row.completed_rentals || 0),
      grossRevenue: Number(row.gross_revenue || 0),
      agencyCommission: Number(row.agency_commission || 0),
      ownerDeliveryFees: Number(row.owner_delivery_fees || 0),
      ownerPayout: Number(row.owner_payout || 0),
    }))

    return { success: true, earnings }
  } catch (error) {
    console.error('Unexpected error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
