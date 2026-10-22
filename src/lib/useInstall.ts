import { useEffect, useState } from 'react'
interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}
export function useInstall() {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  )
  useEffect(() => {
    const before = (event: Event) => {
      event.preventDefault()
      setEvent(event as InstallEvent)
    }
    const after = () => {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', before)
    window.addEventListener('appinstalled', after)
    return () => {
      window.removeEventListener('beforeinstallprompt', before)
      window.removeEventListener('appinstalled', after)
    }
  }, [])
  return {
    installed,
    canInstall: !!event,
    install: async () => {
      if (!event) return false
      await event.prompt()
      const result = await event.userChoice
      setEvent(null)
      return result.outcome === 'accepted'
    },
  }
}
