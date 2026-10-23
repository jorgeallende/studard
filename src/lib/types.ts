export type Color = 'sage' | 'blue' | 'peach' | 'lilac' | 'yellow'
export interface Subject {
  id: string
  name: string
  color: Color
  icon: string
}
export interface Topic {
  id: string
  subjectId: string
  name: string
  suspended?: boolean
}
export interface Card {
  id: string
  topicId: string
  question: string
  answer: string
  favorite: boolean
  suspended?: boolean
  createdAt: string
  dueAt: string
  reviews: number
  lastRating?: Rating
}
export type Rating = 'again' | 'good' | 'easy'
export interface Review {
  id: string
  cardId: string
  at: string
  rating: Rating
}
export interface Library {
  version: 1
  subjects: Subject[]
  topics: Topic[]
  cards: Card[]
  history: Review[]
}
export const emptyLibrary = (): Library => ({
  version: 1,
  subjects: [],
  topics: [],
  cards: [],
  history: [],
})
