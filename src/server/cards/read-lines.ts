/**
 * Découpe un flux en lignes, sans rien lire avant que la boucle `for await`
 * ne commence. Contrairement à `readline`, aucune ligne n'est perdue si du
 * code asynchrone (ouverture d'une transaction…) s'exécute entre la création
 * du lecteur et le début de la lecture.
 */
export async function* readLines(
  stream: AsyncIterable<string | Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream) {
    buffer +=
      typeof chunk === "string"
        ? chunk
        : decoder.decode(chunk, { stream: true });
    let end = buffer.indexOf("\n");
    while (end >= 0) {
      yield buffer.slice(0, end).replace(/\r$/, "");
      buffer = buffer.slice(end + 1);
      end = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  if (buffer) yield buffer;
}
