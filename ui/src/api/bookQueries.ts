import { useQuery } from '@tanstack/react-query'
import { bookApi } from './endpoints'
import { pollInterval } from '../domain/bookStatus'

export const bookKeys = {
  root: ['books'] as const,
  list: () => [...bookKeys.root, 'list'] as const,
  detail: (id: string) => [...bookKeys.root, 'detail', id] as const,
  chapter: (id: string, number: number) => [...bookKeys.detail(id), 'chapter', number] as const,
}

export const useBookList = () =>
  useQuery({ queryKey: bookKeys.list(), queryFn: bookApi.list })

export const useBook = (id: string) =>
  useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => bookApi.get(id),
    refetchInterval: (query) => pollInterval(query.state.data?.status ?? ''),
  })

export const useChapter = (id: string, number: number) =>
  useQuery({
    queryKey: bookKeys.chapter(id, number),
    queryFn: () => bookApi.chapter(id, number),
  })
