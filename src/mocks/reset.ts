/** Mock DB 초기화. mock 모드에서만 의미 있음 */
export function resetMockDb() {
  try {
    localStorage.removeItem('rf-mock-db-v10')
  } catch {
    /* ignore */
  }
  location.reload()
}
