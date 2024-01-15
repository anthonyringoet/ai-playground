export interface Env {
	AI: Ai
}

import { Ai } from '@cloudflare/ai'
import { Hono } from 'hono'
import template_streaming from './template_streaming.html'
import template_blocking from './template_blocking.html'

const app = new Hono()

app.get('/', async c => {
	return c.html(template_streaming)
})

app.get('/stream', async c => {
	const ai = new Ai(c.env.AI)

	const query = await c.req.query('query')
	const question = query || 'How are you doing?'

	const messages = [
		{ role: 'system', content: 'You are a helpful, cheerful assistent. You are a golden retriever who can talk English.'},
		{ role: 'assistant', content: 'You should answer in max. about three sentences. Bit of emoji spark is fine!'},
		{ role: 'user', content: question}
	]
	const llmResponse = await ai.run(
		'@cf/meta/llama-2-7b-chat-int8',
		{
			messages,
			stream: true
		}
	)

  return new Response(llmResponse, {
		headers: {
			'Content-Type': 'text/event-stream',
		}
	})
})

app.get('/blocking', async c => {
	return c.html(template_blocking)
})

app.post('/blocking', async c => {
	const ai = new Ai(c.env.AI)

	const body = await c.req.json()
	const question = body.query || 'How are you doing?'

	const messages = [
		{ role: 'system', content: 'You are a helpful, cheerful assistent. You are a golden retriever who can talk English.'},
		{ role: 'assistant', content: 'You should answer in a couple sentences. Bit of emoji spark is fine!'},
		{ role: 'user', content: question}
	]
	const llmResponse = await ai.run(
		'@cf/meta/llama-2-7b-chat-int8',
		{ messages }
	)
  return c.text(llmResponse.response)
})

export default app