import { useMutation, useQueryClient } from '@tanstack/react-query'
import { bookApi } from './endpoints'
import { bookKeys } from './bookQueries'
import type { CreateBookInput, TocApproveInput } from './requests'
import { useUiStore } from '../store/uiStore'

const useRefreshBooks = (): (() => void) => {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: bookKeys.root })
  }
}

export const useCreateBook = () => {
  const refresh = useRefreshBooks()
  const selectBook = useUiStore((state) => state.selectBook)
  return useMutation({
    mutationFn: (input: CreateBookInput) => bookApi.create(input),
    onSuccess: (created) => {
      selectBook(created.id)
      refresh()
    },
  })
}

export const useRemoveBook = () => {
  const refresh = useRefreshBooks()
  const clearSelectionIf = useUiStore((state) => state.clearSelectionIf)
  return useMutation({
    mutationFn: (id: string) => bookApi.remove(id),
    onSuccess: (_result, id) => {
      clearSelectionIf(id)
      refresh()
    },
  })
}

export const useTocApprove = (id: string) => {
  const refresh = useRefreshBooks()
  return useMutation({
    mutationFn: (input: TocApproveInput) => bookApi.approveToc(id, input),
    onSuccess: refresh,
  })
}

export const useTocRevise = (id: string) => {
  const refresh = useRefreshBooks()
  return useMutation({
    mutationFn: (comment: string) => bookApi.reviseToc(id, comment),
    onSuccess: refresh,
  })
}

export const useChapterApprove = (id: string, number: number) => {
  const refresh = useRefreshBooks()
  return useMutation({
    mutationFn: (comment: string | undefined) => bookApi.approveChapter(id, number, comment),
    onSuccess: refresh,
  })
}

export const useChapterRevise = (id: string, number: number) => {
  const refresh = useRefreshBooks()
  return useMutation({
    mutationFn: (comment: string) => bookApi.reviseChapter(id, number, comment),
    onSuccess: refresh,
  })
}

export const useApproveRest = (id: string) => {
  const refresh = useRefreshBooks()
  return useMutation({
    mutationFn: (comment: string | undefined) => bookApi.approveRest(id, comment),
    onSuccess: refresh,
  })
}
