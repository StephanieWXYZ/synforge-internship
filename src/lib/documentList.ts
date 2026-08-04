export type DocumentListItem = {
  fileName: string;
};

export function filterDocumentsByFileName<TDocument extends DocumentListItem>(
  documents: TDocument[],
  searchTerm: string,
) {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  if (!normalizedSearchTerm) {
    return documents;
  }

  return documents.filter((document) =>
    document.fileName.toLowerCase().includes(normalizedSearchTerm),
  );
}
