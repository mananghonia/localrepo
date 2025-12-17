import { authorizedRequest } from './apiClient'

export const fetchExpenses = (auth) => authorizedRequest('/api/expenses/', auth)

export const createExpense = (auth, data) =>
  authorizedRequest('/api/expenses/', auth, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const fetchActivity = (auth) => authorizedRequest('/api/activity/', auth)
