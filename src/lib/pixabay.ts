const PIXABAY_ENDPOINT = "https://pixabay.com/api/";

export type PixabayPhoto = {
  id: number;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  tags: string;
  user: string;
};

/**
 * Searches Pixabay's free stock-photo library server-side (the API key must
 * stay off the client). Used as a background-image source for the course
 * thumbnail generator.
 */
export async function searchPixabayPhotos(query: string): Promise<PixabayPhoto[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    throw new Error("Stock-Fotos sind noch nicht eingerichtet (PIXABAY_API_KEY fehlt).");
  }

  const url = new URL(PIXABAY_ENDPOINT);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query.trim() || "business");
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "horizontal");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "24");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Pixabay-Suche fehlgeschlagen (${response.status}).`);
  }
  const data = (await response.json()) as { hits: PixabayPhoto[] };
  return data.hits;
}
