import { App, Modal, Notice } from 'obsidian';
import { MalApiClient } from '../api/MalApiClient';
import { AnimeNode } from '../api/types';

export class AnimeGridModal extends Modal {
    year: number;
    season: string;
    apiClient: MalApiClient;
    animeList: AnimeNode[] = [];
    currentSort: string = 'anime_num_list_users'; // Default popularity
    onAnimeSelect: (anime: AnimeNode) => void;

    constructor(app: App, year: number, season: string, apiClient: MalApiClient, onAnimeSelect: (anime: AnimeNode) => void) {
        super(app);
        this.year = year;
        this.season = season;
        this.apiClient = apiClient;
        this.onAnimeSelect = onAnimeSelect;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('anime-log-grid-modal'); // For custom styling

        // Header with controls
        const headerDiv = contentEl.createDiv({ cls: 'anime-grid-header' });
        headerDiv.createEl('h2', { text: `${this.year} ${this.season.charAt(0).toUpperCase() + this.season.slice(1)} Anime` });

        const controlsDiv = headerDiv.createDiv({ cls: 'anime-grid-controls' });

        // Sort Dropdown
        const sortSelect = controlsDiv.createEl('select');
        const sortOptions = [
            { value: 'anime_num_list_users', label: 'Most Popular' },
            { value: 'anime_score', label: 'Highest Score' },
            { value: 'start_date_desc', label: 'Start Date (Newest)' }, // Client side
            { value: 'start_date_asc', label: 'Start Date (Oldest)' }, // Client side
        ];
        sortOptions.forEach(opt => {
            const el = sortSelect.createEl('option', { value: opt.value, text: opt.label });
            if (opt.value === this.currentSort) el.selected = true;
        });

        sortSelect.onchange = async (e) => {
            const target = e.target as HTMLSelectElement;
            this.currentSort = target.value;
            await this.loadAnime();
        };

        // Loading Indicator
        const loadingEl = contentEl.createDiv({ text: 'Loading anime data...', cls: 'anime-loading' });

        await this.loadAnime();
        loadingEl.remove();
    }

    async loadAnime() {
        const gridContainer = this.contentEl.querySelector('.anime-grid-container') || this.contentEl.createDiv({ cls: 'anime-grid-container' });
        gridContainer.empty();

        try {
            this.animeList = await this.apiClient.getSeasonalAnime(this.year, this.season, this.currentSort);

            if (this.animeList.length === 0) {
                gridContainer.createDiv({ text: 'No anime found for this season.' });
                return;
            }

            this.animeList.forEach(anime => {
                const card = gridContainer.createDiv({ cls: 'anime-card' });

                // Thumbnail
                const imgContainer = card.createDiv({ cls: 'anime-card-image-container' });
                if (anime.main_picture) {
                    const img = imgContainer.createEl('img', {
                        attr: { src: anime.main_picture.medium || anime.main_picture.large }
                    });
                }

                // Popularity Badge
                if (anime.popularity) {
                    imgContainer.createDiv({
                        cls: 'anime-card-popularity',
                        text: `#${anime.popularity}`
                    });
                }

                // Title
                const title = card.createDiv({ cls: 'anime-card-title', text: anime.title });

                // Click event
                card.onClickEvent(() => {
                    this.close();
                    this.onAnimeSelect(anime);
                });
            });

        } catch (error) {
            new Notice('Failed to load anime data');
            console.error(error);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
