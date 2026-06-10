import { authorizedRequest } from './apiClient'

export const fetchExpenses = (auth) => authorizedRequest('/api/expenses/', auth)

export const createExpense = (auth, data) =>
  authorizedRequest('/api/expenses/', auth, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateExpense = (auth, expenseId, data) =>
  authorizedRequest(`/api/expenses/${expenseId}/`, auth, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteExpense = (auth, expenseId) =>
  authorizedRequest(`/api/expenses/${expenseId}/`, auth, { method: 'DELETE' })

export const fetchActivity = (auth, { limit = 40, offset = 0 } = {}) =>
  authorizedRequest(`/api/activity/?limit=${limit}&offset=${offset}`, auth)

export const scanReceipt = (auth, imageBase64, mimeType = 'image/jpeg') =>
  authorizedRequest('/api/expenses/scan-receipt/', auth, {
    method: 'POST',
    body: JSON.stringify({ image: imageBase64, mime_type: mimeType }),
  })
