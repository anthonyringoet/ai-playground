# RAG example

> = Retrieval augmented generation

```sh
# create D1 database and schema
npx wrangler d1 create rag-example
# remote schema
npx wrangler d1 execute rag-example --command "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL)"
# local schema
npx wrangler d1 execute rag-example --command "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL)" --local

# create vectorize index
npx wrangler vectorize create rag-example --preset @cf/baai/bge-base-en-v1.5
```
