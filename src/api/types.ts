export interface AnimeNode {
    id: number;
    title: string;
    alternative_titles?: {
        synonyms?: string[];
        en?: string;
        ja?: string;
    };
    main_picture: {
        medium: string;
        large: string;
    };
    mean?: number; // Score
    rank?: number;
    popularity?: number;
    media_type?: string;
    status?: string;
    num_list_users?: number;
    start_date?: string;
    end_date?: string;
    genres?: { id: number; name: string }[];
}

export interface SeasonalAnimeResponse {
    data: {
        node: AnimeNode;
    }[];
    paging: {
        next: string;
    };
}

export interface AnimePicture {
    medium: string;
    large: string;
}

export interface AnimePicturesResponse {
    pictures: AnimePicture[];
}

export interface RelatedAnimeNode {
    node: AnimeNode;
    relation_type: string;
    relation_type_formatted: string;
}

export interface RecommendationNode {
    node: AnimeNode;
    num_recommendations: number;
}

export interface AnimeRecommendationsResponse {
    recommendations: RecommendationNode[];
}

export interface AnimeStatistics {
    status: {
        watching: string;
        completed: string;
        on_hold: string;
        dropped: string;
        plan_to_watch: string;
    };
    num_list_users: number;
}
