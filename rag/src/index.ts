export interface Env {
	AI: Ai,
	DB: D1Database,
	VECTORIZE_INDEX: VectorizeIndex
}

import { Ai } from '@cloudflare/ai'
import { Hono } from 'hono'

import template_ui from './ui.html'
import template_write from './write.html'

const app = new Hono()

// ui for asking questions
app.get('/ui', c => {
	return c.html(template_ui)
})

// post endpoint to query the LLM
app.get('/', async c => {
	// generate embeddings for the query
	// look up similar vectors in our vector embeddings
	// if there are similar vectors, fetch the corresponding notes from our D1 database
	// query the LLM with the embedded notes in the prompt
	const ai = new Ai(c.env.AI)
	const question = c.req.query('text') || 'What is the capital of the USA?'

	// ensure this uses the same model as the one used to generate the embeddings
	const embeddings = await ai.run('@cf/baai/bge-base-en-v1.5', { text: question })
  const vectors = embeddings.data[0]

  const SIMILARITY_CUTOFF = 0.75
  const vectorQuery = await c.env.VECTORIZE_INDEX.query(vectors, { topK: 1 });
	console.log({ vectorQuery })

  const vecIds = vectorQuery.matches
    .filter(vec => vec.score > SIMILARITY_CUTOFF)
    .map(vec => vec.vectorId)

  let notes = []
  if (vecIds.length) {
    const query = `SELECT * FROM notes WHERE id IN (${vecIds.join(", ")})`
    const { results } = await c.env.DB.prepare(query).bind().all()
    if (results) notes = results.map(vec => vec.text)
  }

  const contextMessage = notes.length
    ? `Context:\n${notes.map(note => `- ${note}`).join("\n")}`
    : ""

  const { response: answer } = await ai.run(
    '@cf/meta/llama-2-7b-chat-int8',
    {
      messages: [
        ...(notes.length ? [{ role: 'system', content: contextMessage }] : []),
        { role: 'system', content: 'When answering the question or responding, use the context provided, if it is provided and relevant.' },
        { role: 'user', content: question }
      ]
    }
  )

  return c.text(answer);
})

// ui for adding notes
app.get('/write', c => {
	return c.html(template_write)
})

// post endpoint for adding notes
app.post('/notes', async c => {
	const ai = new Ai(c.env.AI)
	const { text } = await c.req.json()

  if (!text) c.throw(400, "Missing text");

	// 1 insert note into D1 database
  const { results } = await c.env.DB.prepare("INSERT INTO notes (text) VALUES (?) RETURNING *")
    .bind(text)
    .run()

  const record = results.length ? results[0] : null

  if (!record) c.throw(500, "Failed to create note")

	// 2 generate embedding based on our notes
  const { data } = await ai.run('@cf/baai/bge-base-en-v1.5', { text: [text] })
  const values = data[0]

  if (!values) c.throw(500, "Failed to generate vector embedding")

	// 3 insert embedding into vectorized index
  const { id } = record
  const inserted = await c.env.VECTORIZE_INDEX.upsert([
    {
			// save id because when returning some items,
			// you want to fetch those items from your D1 database
      id: id.toString(),
      values,
    }
  ]);

  return c.json({ id, text, inserted });
})

export default app
