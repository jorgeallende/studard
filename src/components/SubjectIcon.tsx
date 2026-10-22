import {
  BookOpen,
  Calculator,
  Landmark,
  Leaf,
  FlaskConical,
  Globe2,
  Palette,
  Music2,
} from 'lucide-react'
export const subjectIcons = {
  book: BookOpen,
  calculator: Calculator,
  landmark: Landmark,
  leaf: Leaf,
  science: FlaskConical,
  globe: Globe2,
  art: Palette,
  music: Music2,
}
export function SubjectIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = subjectIcons[name as keyof typeof subjectIcons] || BookOpen
  return <Icon size={size} strokeWidth={1.8} />
}
