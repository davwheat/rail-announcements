import * as base65536 from 'base65536'

interface ISystemTabStateJson {
  systemId: string
  tabId: string
  state: Record<string, unknown>
}

interface IApiSaveResponseError {
  error: true
  message: string
  detail?: unknown
}

interface IApiSaveResponseSuccess {
  error: false
  id: string
}

type SaveApiResponse = IApiSaveResponseError | IApiSaveResponseSuccess

interface IApiGetResponseError {
  error: true
  message: string
}

interface IApiGetResponseSuccess {
  error: false
  data: ISystemTabStateJson
  savedAt: string
}

type GetApiResponse = IApiGetResponseError | IApiGetResponseSuccess

export class SystemTabState {
  readonly systemId: string
  readonly tabId: string
  readonly state: Record<string, unknown>

  constructor(systemId: string, tabId: string, state: Record<string, unknown>) {
    this.systemId = systemId
    this.tabId = tabId
    this.state = state
  }

  toString(): string {
    return JSON.stringify({
      systemId: this.systemId,
      tabId: this.tabId,
      state: this.state,
    })
  }

  async saveToApi(): Promise<string> {
    const body = {
      systemId: this.systemId,
      tabId: this.tabId,
      state: this.state,
    }

    const response = await fetch('https://api.railannouncements.co.uk/save-announcement', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    })

    if (!response.ok) {
      throw new Error(response.statusText)
    }

    const json: SaveApiResponse = await response.json()

    if (json.error) {
      throw new Error(json.message)
    }

    return json.id
  }

  static fromString(str: string): SystemTabState {
    const parsed: ISystemTabStateJson = JSON.parse(str)

    return new SystemTabState(parsed.systemId, parsed.tabId, parsed.state)
  }

  /**
   * Fetches a SystemTabState object from the API by its ID.
   *
   * Throws errors for API errors or fetch errors.
   *
   * @param id UUID of the announcement to fetch
   * @returns SystemTabState object
   */
  static async fromApi(id: string): Promise<SystemTabState> {
    const params = new URLSearchParams()
    params.set('id', id)

    const response = await fetch(`https://api.railannouncements.co.uk/get-announcement?${params}`)

    if (!response.ok) {
      throw new Error(response.statusText)
    }

    const json: GetApiResponse = await response.json()

    if (json.error) {
      throw new Error(json.message)
    }

    return new SystemTabState(json.data.systemId, json.data.tabId, json.data.state)
  }
}
