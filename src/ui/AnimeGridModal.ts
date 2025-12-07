import { App, Modal, Notice } from 'obsidian';
import { MalApiClient } from '../api/MalApiClient';
import { AnimeNode } from '../api/types';

export class AnimeGridModal extends Modal {
    year: number;
    season: string;
    searchQuery?: string;
    apiClient: MalApiClient;
    animeList: AnimeNode[] = [];
    currentSort: string = 'anime_num_list_users'; // Default popularity
    onAnimeSelect: (anime: AnimeNode) => void;

    constructor(app: App, year: number, season: string, apiClient: MalApiClient, onAnimeSelect: (anime: AnimeNode) => void, searchQuery?: string) {
        super(app);
        this.year = year;
        this.season = season;
        this.apiClient = apiClient;
        this.onAnimeSelect = onAnimeSelect;
        this.searchQuery = searchQuery;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('anime-log-grid-modal'); // For custom styling

        // Header with controls
        const headerDiv = contentEl.createDiv({ cls: 'anime-grid-header' });

        // Back button and title container
        const titleContainer = headerDiv.createDiv({ cls: 'anime-grid-title-container' });

        // Back button
        const backButton = titleContainer.createEl('button', { cls: 'anime-grid-back-button' });
        backButton.setText('← 戻る');
        backButton.addEventListener('click', () => {
            this.close();
            // Re-open YearSeasonModal (Need to import dynamically to avoid circular dependency if any, though here it's fine)
            // But we need the callback logic again.
            // Since we don't have easy access to the original callbacks from here to pass back to YearSeasonModal...
            // Wait, we can construct YearSeasonModal again but we need to pass the same callbacks that main.ts passed.
            // But we don't have them stored.
            // A simple way is to pass a "onBack" callback to AnimeGridModal?
            // Or just re-instantiate YearSeasonModal with the same logic as main.ts?
            // Let's assume the callbacks are consistently:
            // onSubmit: (y, s) => new AnimeGridModal(app, y, s, client, onSelect).open()
            // onSearch: (q) => new AnimeGridModal(app, 0, '', client, onSelect, q).open()
            // We can replicate this.

            const { YearSeasonModal } = require('./YearSeasonModal');
            new YearSeasonModal(
                this.app,
                (year: number, season: string) => {
                    new AnimeGridModal(this.app, year, season, this.apiClient, this.onAnimeSelect).open();
                },
                (query: string) => {
                    new AnimeGridModal(this.app, 0, '', this.apiClient, this.onAnimeSelect, query).open();
                }
            ).open();
        });

        // Title
        let headerTitle: string;
        if (this.searchQuery) {
            headerTitle = `"${this.searchQuery}" の検索結果`;
        } else if (this.season) {
            const seasonJa = this.season === 'winter' ? '冬' : this.season === 'spring' ? '春' : this.season === 'summer' ? '夏' : '秋';
            headerTitle = `${this.year}年 ${seasonJa}アニメ`;
        } else {
            headerTitle = `${this.year}年 アニメ`;
        }
        titleContainer.createEl('h2', { text: headerTitle });

        const controlsDiv = headerDiv.createDiv({ cls: 'anime-grid-controls' });

        // Sort Dropdown
        const sortSelect = controlsDiv.createEl('select');
        const sortOptions = [
            { value: 'anime_num_list_users', label: '人気順' },
            { value: 'anime_score', label: 'スコア順' },
            { value: 'start_date_desc', label: '放送日 (新しい順)' },
            { value: 'start_date_asc', label: '放送日 (古い順)' },
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
        const loadingEl = contentEl.createDiv({ text: 'アニメデータを読み込み中...', cls: 'anime-loading' });

        await this.loadAnime();
        loadingEl.remove();
    }

    async loadAnime() {
        const gridContainer = this.contentEl.querySelector('.anime-grid-container') || this.contentEl.createDiv({ cls: 'anime-grid-container' });
        gridContainer.empty();

        try {
            if (this.searchQuery) {
                this.animeList = await this.apiClient.searchAnime(this.searchQuery);
            } else if (this.season) {
                this.animeList = await this.apiClient.getSeasonalAnime(this.year, this.season, this.currentSort);
            } else {
                this.animeList = await this.apiClient.getYearlyAnime(this.year, this.currentSort);
            }

            if (this.animeList.length === 0) {
                gridContainer.createDiv({ text: 'アニメは見つかりませんでした。' });
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

                // Title - Prefer Japanese
                const displayTitle = anime.alternative_titles?.ja || anime.title;
                const title = card.createDiv({ cls: 'anime-card-title', text: displayTitle });

                // Click event
                card.addEventListener('click', () => {
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
