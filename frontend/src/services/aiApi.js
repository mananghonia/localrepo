import { authorizedRequest } from './apiClient.js'

export const sendAIMessage = (auth, message, history = []) =>
  authorizedRequest('/api/ai/chat/', auth, {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  })
