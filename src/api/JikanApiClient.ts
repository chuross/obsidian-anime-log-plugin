import { requestUrl, RequestUrlParam } from 'obsidian';

export class JikanApiClient {
    private static BASE_URL = 'https://api.jikan.moe/v4';

    async getAnimeExternalLinks(malId: number): Promise<{ name: string; url: string }[]> {
        try {
            // Need to wait 1 second to avoid rate limit if we make multiple calls, 
            // but here we likely make single call. Jikan API has rate limits (3 requests/second).
            // We'll proceed directly.

            const response = await requestUrl({
                url: `${JikanApiClient.BASE_URL}/anime/${malId}/full`,
                method: 'GET'
            });

            if (response.status !== 200) {
                console.error(`Jikan API Error: ${response.status}`);
                return [];
            }

            const data = response.json;
            if (data && data.data && data.data.external) {
                return data.data.external.map((item: any) => ({
                    name: item.name,
                    url: item.url
                }));
            }

            return [];
        } catch (error) {
            console.error('Failed to fetch external links from Jikan API:', error);
            return [];
        }
    }
}
