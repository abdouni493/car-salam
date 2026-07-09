import { supabase } from '../supabase'

export interface OwnerContractUploadResult {
  success: boolean
  url?: string
  error?: string
}

/** Bucket privé : seuls les utilisateurs authentifiés peuvent lire/écrire. */
const BUCKET = 'contracts'

/** Une heure — durée de vie du lien signé remis à l'admin. */
const SIGNED_URL_TTL_SECONDS = 3600

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * Téléverse le contrat de conciergerie scanné (PDF ou image) d'un propriétaire.
 * Le bucket est privé : on stocke le chemin, pas une URL publique.
 */
export async function uploadOwnerContract(
  file: File,
  carId?: string
): Promise<OwnerContractUploadResult> {
  try {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { success: false, error: 'Le contrat doit être un PDF ou une image (JPG, PNG, WEBP)' }
    }

    if (file.size > MAX_SIZE) {
      return { success: false, error: 'Le fichier doit faire moins de 10 Mo' }
    }

    const fileExt = file.name.split('.').pop()
    const fileName = carId
      ? `${carId}-${Date.now()}.${fileExt}`
      : `contract-${Date.now()}.${fileExt}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file, { cacheControl: '3600', upsert: false })

    if (error) {
      console.error('Contract upload error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, url: fileName }
  } catch (error) {
    console.error('Unexpected error during contract upload:', error)
    return { success: false, error: 'Une erreur inattendue est survenue pendant le téléversement' }
  }
}

/**
 * Génère un lien temporaire pour consulter un contrat stocké dans le bucket privé.
 * Accepte aussi une URL absolue (contrats téléversés avant le passage au bucket privé).
 */
export async function getOwnerContractUrl(path: string): Promise<string | null> {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error) {
    console.error('Contract signed URL error:', error)
    return null
  }
  return data?.signedUrl ?? null
}
