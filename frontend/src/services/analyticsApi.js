import { authorizedRequest } from './apiClient.js'

export const fetchAnalytics = (auth) =>
  authorizedRequest('/api/analytics/', auth)

export const fetchSimplify = (auth) =>
  authorizedRequest('/api/analytics/simplify/', auth)
