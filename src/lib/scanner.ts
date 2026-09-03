/** Cycle de vie d'un scan de code-barre. Deux endroits scannent un ISBN (la recherche
 * principale et le sélecteur de couverture d'un tome) avec exactement la même mécanique :
 * import dynamique de html5-qrcode (~370 Ko, jamais chargé tant qu'on n'ouvre pas la caméra),
 * garde anti-double-lecture, pause après la première lecture, arrêt silencieux. */

const CAMERA = { facingMode: 'environment' }
const SCAN_CONFIG = { fps: 10, qrbox: { width: 250, height: 120 } }

export type BarcodeScanner = {
  /** Démarre la caméra dans l'élément donné. Renvoie false si l'accès échoue
   * (HTTPS manquant, permission refusée, pas de caméra). */
  start(elementId: string, onDecode: (isbn: string) => void): Promise<boolean>
  /** Réarme la lecture après un scan, pour enchaîner sans rouvrir la caméra. */
  resume(): void
  stop(): void
}

export function createBarcodeScanner(): BarcodeScanner {
  let instance: import('html5-qrcode').Html5Qrcode | null = null
  let decoded = false

  return {
    async start(elementId, onDecode) {
      decoded = false
      const { Html5Qrcode } = await import('html5-qrcode')
      instance = new Html5Qrcode(elementId)
      try {
        await instance.start(
          CAMERA,
          SCAN_CONFIG,
          (text) => {
            // La caméra continue de décoder après la première lecture : sans cette garde,
            // un même code déclenche plusieurs recherches.
            if (decoded) return
            decoded = true
            instance?.pause(true)
            onDecode(text)
          },
          () => {},
        )
        return true
      } catch {
        return false
      }
    },
    resume() {
      decoded = false
      instance?.resume()
    },
    stop() {
      if (!instance) return
      // stop() rejette si la caméra n'a jamais démarré — sans intérêt ici, on ferme quoi qu'il arrive.
      instance.stop().catch(() => {})
      instance = null
    },
  }
}
