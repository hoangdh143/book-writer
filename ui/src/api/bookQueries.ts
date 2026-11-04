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
    // keep polling active books; when a fresh load fails on the network,
    // keep trying every few seconds so the view heals once the server returns
    refetchInterval: (query) => {
      const data = query.state.data
      if (data !== undefined) return pollInterval(data.status)
      return query.state.error instanceof TypeError ? 3000 : false
    },
  })

export const useChapter = (id: string, number: number) =>
  useQuery({
    queryKey: bookKeys.chapter(id, number),
    queryFn: () => bookApi.chapter(id, number),
  })
