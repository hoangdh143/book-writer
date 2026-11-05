import { useEffect } from 'react'
import { useUiStore } from '../store/uiStore'
import { BookDetail } from './BookDetail'
import { CreateBookForm } from './CreateBookForm/CreateBookForm'

export const BookPanel = () => {
  const selectedId = useUiStore((state) => state.selectedBookId)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [selectedId])

  // the form stays mounted while hidden so a half-written idea survives a look at another book
  return (
    <>
      <div hidden={selectedId !== null}>
        <CreateBookForm />
      </div>
      {selectedId === null ? null : <BookDetail key={selectedId} id={selectedId} />}
    </>
  )
}
