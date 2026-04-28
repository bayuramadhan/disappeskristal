export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw Object.assign(new Error(err.message ?? 'Request gagal'), { status: res.status })
  }
  const json = await res.json()
  return json.data
}
