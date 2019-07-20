interface LinkedList<T> {
  h: LinkedListElement<T>
  t: LinkedListElement<T>
  e: boolean
  s: Number
}

interface LinkedListElement<T> {
  d: T
  p: LinkedListElement<T>
  n: LinkedListElement<T>
}