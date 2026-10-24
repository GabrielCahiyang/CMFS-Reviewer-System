import { notFound } from 'next/navigation'
import { StudyHub } from '@/components/study-hub'

const pages = [
  'dashboard',
  'categories',
  'flashcards',
  'mistakes',
  'bookmarks',
  'history',
  'profile',
  'settings',
  'login',
  'register',
  'forgot-password',
  'study',
  'results',
  'study-admin',
  'study-admin/students',
  'study-admin/activity',
  'study-admin/questions',
  'categories/new-reviewer',
  'categories/cfms-questionnaire',
  'categories/huhuhuhu-reviewer',
  'categories/pre-finals',
  'categories/working-capital',
  'categories/financial-statements',
]

export const dynamicParams = false

export function generateStaticParams() {
  return pages.map((page) => ({ slug: page.split('/') }))
}

export default async function HubPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const page = slug.join('/')
  if (!pages.includes(page)) notFound()
  return <StudyHub page={page} />
}
