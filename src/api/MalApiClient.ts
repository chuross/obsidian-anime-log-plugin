import { requestUrl, RequestUrlParam } from 'obsidian';
import { SeasonalAnimeResponse, AnimeNode, AnimePicturesResponse, AnimeRecommendationsResponse, AnimeStatistics } from './types';

const CLIENT_ID = '103cac1c3fd943cd0358e663382bd508';
const API_BASE_URL = 'https://api.myanimelist.net/v2';

export class MalApiClient {

    private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });

        const options: RequestUrlParam = {
            url: url.toString(),
            method: 'GET',
            headers: {
                'X-MAL-CLIENT-ID': CLIENT_ID
            }
        };

        const response = await requestUrl(options);

        if (response.status !== 200) {
            console.error('MAL API Request Failed:', response);
            throw new Error(`MAL API Request failed with status ${response.status}`);
        }

        return response.json as T;
    }

    async getSeasonalAnime(year: number, season: string, sort: string = 'anime_num_list_users'): Promise<AnimeNode[]> {
        // limit 500 to get most anime in the season
        const response = await this.request<SeasonalAnimeResponse>(`/anime/season/${year}/${season}`, {
            limit: 500,
            sort: sort === 'start_date' ? undefined : sort, // start_date is not supported by API directly for sorting in this endpoint effectively usually, but we fallback to API if possible or handle locally.
            // Actually, for season, API supports anime_score, anime_num_list_users.
            // We will request basic fields needed for grid.
            fields: 'alternative_titles,mean,popularity,media_type,status,start_date,genres,num_list_users'
        });

        let animeList = response.data.map(item => item.node);

        // Client-side sorting for start_date if needed
        if (sort === 'start_date_desc') {
            animeList.sort((a, b) => {
                const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                return dateB - dateA;
            });
        } else if (sort === 'start_date_asc') {
            animeList.sort((a, b) => {
                const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                return dateA - dateB;
            });
        }

        return animeList;
    }

    async getYearlyAnime(year: number, sort: string = 'anime_num_list_users'): Promise<AnimeNode[]> {
        const seasons = ['winter', 'spring', 'summer', 'fall'];
        const allAnime: AnimeNode[] = [];
        const seenIds = new Set<number>();

        for (const season of seasons) {
            try {
                const animeList = await this.getSeasonalAnime(year, season, sort);
                for (const anime of animeList) {
                    if (!seenIds.has(anime.id)) {
                        seenIds.add(anime.id);
                        allAnime.push(anime);
                    }
                }
            } catch (e) {
                console.error(`Failed to fetch ${season} season for ${year}`, e);
            }
        }

        // Re-sort the combined list
        if (sort === 'anime_num_list_users') {
            allAnime.sort((a, b) => (b.num_list_users || 0) - (a.num_list_users || 0));
        } else if (sort === 'anime_score') {
            allAnime.sort((a, b) => (b.mean || 0) - (a.mean || 0));
        } else if (sort === 'start_date_desc') {
            allAnime.sort((a, b) => {
                const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                return dateB - dateA;
            });
        } else if (sort === 'start_date_asc') {
            allAnime.sort((a, b) => {
                const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                return dateA - dateB;
            });
        }

        return allAnime;
    }

    async getAnimeDetails(animeId: number): Promise<{
        pictures: AnimePicturesResponse['pictures'],
        recommendations: AnimeRecommendationsResponse['recommendations'],
        statistics: AnimeStatistics | null
    }> {
        // We can fetch pictures, recommendations, and statistics in one call using fields
        // However, `statistics` might be a separate structure or part of main node info?
        // Checking MAL API:
        // fields=pictures,recommendations,my_list_status,num_list_users,statistics

        // Note: 'statistics' field returns 'num_list_users' and 'status' object (watching, completed, etc)
        // But the official documentation says complex usage.
        // Let's try to fetch main anime node with these fields.

        try {
            const response = await this.request<any>(`/anime/${animeId}`, {
                fields: 'pictures,recommendations{node{alternative_titles}},statistics'
            });

            return {
                pictures: response.pictures || [],
                recommendations: response.recommendations ? response.recommendations.map((r: any) => ({ node: r.node, num_recommendations: r.num_recommendations })) : [],
                statistics: response.statistics || null
            };
        } catch (e) {
            console.error("Failed to fetch details", e);
            throw e;
        }
    }
}
