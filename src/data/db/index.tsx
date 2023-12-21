import { ISystemTabStateJson } from '@data/SystemTabState'

const DB_NAME = 'personalPresets'
const VERSION = 1

export interface IPersonalPresetObject extends ISystemTabStateJson {
  presetId: string
  name: string
}

export function initPersonalPresetsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, VERSION)

    request.onupgradeneeded = function () {
      const db = request.result

      if (!db.objectStoreNames.contains('presets')) {
        console.log('Creating personal presets object store')
        db.createObjectStore('presets', { keyPath: ['systemId', 'tabId', 'presetId'] })
      }
    }

    request.onerror = function (event) {
      console.error('Failed to open personal presets database', event)
      reject(event)
    }

    request.onsuccess = function () {
      console.log('Successfully opened personal presets database')
      resolve(request.result)
    }
  })
}

export function savePersonalPreset(preset: IPersonalPresetObject): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)

    request.onsuccess = () => {
      const db = request.result

      const transaction = db.transaction(['presets'], 'readwrite')
      const store = transaction.objectStore('presets')

      const saveRequest = store.put(preset)

      saveRequest.onsuccess = () => {
        resolve()
      }

      saveRequest.onerror = () => {
        reject(saveRequest.error)
      }
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

export function getPersonalPresets(systemId: string, tabId: string): Promise<IPersonalPresetObject[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)

    request.onsuccess = () => {
      const db = request.result

      const transaction = db.transaction(['presets'], 'readonly')
      const store = transaction.objectStore('presets')

      const getRequest: IDBRequest<IPersonalPresetObject[]> = store.getAll(IDBKeyRange.bound([systemId, tabId], [systemId, tabId, []]))

      getRequest.onsuccess = () => {
        resolve(getRequest.result)
      }

      getRequest.onerror = () => {
        reject(getRequest.error)
      }
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

export function deletePersonalPreset(systemId: string, tabId: string, presetId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)

    request.onsuccess = () => {
      const db = request.result

      const transaction = db.transaction(['presets'], 'readwrite')
      const store = transaction.objectStore('presets')

      const deleteRequest = store.delete([systemId, tabId, presetId])

      deleteRequest.onsuccess = () => {
        resolve()
      }

      deleteRequest.onerror = () => {
        reject(deleteRequest.error)
      }
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}
