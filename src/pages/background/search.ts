import { pipeline } from '@huggingface/transformers';
import { Voy } from 'voy-search';
import PubSub from 'pubsub-js'

export async function runSimilaritySearch() {
  const phrases = [
    'That is a very happy Person',
    'That is a Happy Dog',
    'Today is a sunny day',
  ];
  const query = 'dogs are awesome';

  // Create text embeddings using Hugging Face transformers
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2'
  );

  // Process all phrases to get embeddings
  const processed = await Promise.all(
    phrases.map(async (phrase) => {
      const output = await extractor(phrase, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    })
  );

  // Index embeddings with voy
  const data = processed.map((embeddings, i) => ({
    id: String(i),
    title: phrases[i],
    url: `/path/${i}`,
    embeddings: embeddings as number[],
  }));
  const resource = { embeddings: data };
  const index = new Voy(resource);

  // Perform similarity search for query embeddings
  const queryOutput = await extractor(query, { pooling: 'mean', normalize: true });
  const queryEmbedding = Array.from(queryOutput.data) as number[];
  const result = index.search(queryEmbedding, 1);

  // Display search result
  result.neighbors.forEach((neighbor) =>
    console.log(`✨ voy similarity search result: "${neighbor.title}"`)
  );
}
PubSub.subscribe('MY TOPIC', runSimilaritySearch);
