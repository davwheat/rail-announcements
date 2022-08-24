import React, { useState } from 'react'

/**
 * Wrapper for React's `useState` hook that persists data in the browser's LocalStorage.
 *
 * The value must be `JSON.stringify`/`parse`-able in order to successfully store itself
 * in LocalStorage.
 *
 * Can accept an optional third parameter to validate the persisted value of the state
 * to ensure it is acceptable before it gets loaded as the initial state. This should be
 * prepared to accept any value as input, and should return a boolean: `true` meaning
 * valid and `false` meaning invalid.
 */
export default function useStateWithLocalStorage<T>(
  key: string,
  initialValue: T,
  validator: (input: any) => boolean = () => true,
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)

      if (item) {
        const parsed = JSON.parse(item)
        if (validator(parsed)) {
          return parsed
        }
      }
      return initialValue
    } catch (error) {
      // If error also return initialValue
      console.error(error)
      return initialValue
    }
  })

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue: React.Dispatch<React.SetStateAction<T>> = value => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value
      // Save state
      setStoredValue(valueToStore)
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.warn(error)
    }
  }

  /**
   * Resets the stored and actual state back to the initial value provided
   * to the hook call.
   */
  const resetValue = () => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = initialValue
      // Save state
      setStoredValue(valueToStore)
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.warn(error)
    }
  }

  return [storedValue, setValue, resetValue]
}
