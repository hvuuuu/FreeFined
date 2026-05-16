const CACHE_NAME = "onnx-model-cache-v1"
const DB_NAME = "onnx-model-cache"
const DB_STORE = "models"

function hasCacheApi() {
  return typeof caches !== "undefined"
}

function hasIndexedDb() {
  return typeof indexedDB !== "undefined"
}

async function readFromCacheApi(url: string): Promise<ArrayBuffer | null> {
  if (!hasCacheApi()) {
    return null
  }

  const cache = await caches.open(CACHE_NAME)
  const response = await cache.match(url)
  if (!response) {
    return null
  }
  return response.arrayBuffer()
}

async function writeToCacheApi(url: string, buffer: ArrayBuffer) {
  if (!hasCacheApi()) {
    return
  }

  const cache = await caches.open(CACHE_NAME)
  const response = new Response(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
    },
  })
  await cache.put(url, response)
}

function openIndexedDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readFromIndexedDb(key: string): Promise<ArrayBuffer | null> {
  const db = await openIndexedDb()
  if (!db) {
    return null
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly")
    const store = tx.objectStore(DB_STORE)
    const request = store.get(key)

    request.onsuccess = () => resolve((request.result as ArrayBuffer | undefined) ?? null)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

async function writeToIndexedDb(key: string, buffer: ArrayBuffer) {
  const db = await openIndexedDb()
  if (!db) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite")
    const store = tx.objectStore(DB_STORE)
    store.put(buffer, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
}

async function fetchModelBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`)
  }
  return response.arrayBuffer()
}

export interface ModelLoadResult {
  buffer: ArrayBuffer | null
  cached: boolean
  warning: string | null
}

export async function loadModelBufferWithCache(url: string): Promise<ModelLoadResult> {
  const cachedResponse = await readFromCacheApi(url)
  if (cachedResponse) {
    return { buffer: cachedResponse, cached: true, warning: null }
  }

  const indexedDbResponse = await readFromIndexedDb(url)
  if (indexedDbResponse) {
    await writeToCacheApi(url, indexedDbResponse)
    return { buffer: indexedDbResponse, cached: true, warning: null }
  }

  try {
    const remoteBuffer = await fetchModelBuffer(url)
    await Promise.all([
      writeToCacheApi(url, remoteBuffer).catch(() => undefined),
      writeToIndexedDb(url, remoteBuffer).catch(() => undefined),
    ])
    return { buffer: remoteBuffer, cached: false, warning: null }
  } catch {
    return {
      buffer: null,
      cached: false,
      warning:
        "Model file could not be loaded. Falling back to lightweight browser enhancement.",
    }
  }
}
