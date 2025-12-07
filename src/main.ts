import { Plugin, WorkspaceLeaf } from 'obsidian';
import { YearSeasonModal } from './ui/YearSeasonModal';
import { AnimeGridModal } from './ui/AnimeGridModal';
import { MalApiClient } from './api/MalApiClient';
import { JikanApiClient } from './api/JikanApiClient';
import { AnimeFileService } from './services/AnimeFileService';
import { AnimeLogProcessor } from './codeblock/AnimeLogProcessor';
import { AnimeNode } from './api/types';

export default class AnimeLogPlugin extends Plugin {
    apiClient: MalApiClient;
    jikanApiClient: JikanApiClient;
    fileService: AnimeFileService;

    async onload() {
        this.apiClient = new MalApiClient();
        this.jikanApiClient = new JikanApiClient();
        this.fileService = new AnimeFileService(this.app, this.jikanApiClient);

        // Register Code Block Processor
        this.registerMarkdownCodeBlockProcessor('animeLog', (source, el, ctx) => {
            AnimeLogProcessor.postProcess(source, el, ctx, this.app, this.apiClient, this.fileService);
        });

        // Add Ribbon Icon
        this.addRibbonIcon('tv', 'Open Anime Log', (evt: MouseEvent) => {
            new YearSeasonModal(
                this.app,
                (year, season) => {
                    this.openAnimeGrid(year, season);
                },
                (query) => {
                    new AnimeGridModal(this.app, 0, '', this.apiClient, async (anime) => {
                        await this.handleAnimeSelection(anime);
                    }, query).open();
                }
            ).open();
        });

        // Add Command
        this.addCommand({
            id: 'open-anime-log-modal',
            name: 'Open Anime Selection Modal',
            callback: () => {
                const onAnimeSelect = async (anime: AnimeNode) => {
                    await this.handleAnimeSelection(anime);
                };

                new YearSeasonModal(
                    this.app,
                    (year: number, season: string) => {
                        new AnimeGridModal(this.app, year, season, this.apiClient, onAnimeSelect).open();
                    },
                    (query: string) => {
                        new AnimeGridModal(this.app, 0, '', this.apiClient, onAnimeSelect, query).open();
                    }
                ).open();
            }
        });
    }

    onunload() {

    }

    openAnimeGrid(year: number, season: string) {
        new AnimeGridModal(this.app, year, season, this.apiClient, async (anime) => {
            await this.handleAnimeSelection(anime);
        }).open();
    }

    async handleAnimeSelection(anime: AnimeNode) {
        const existingFile = await this.fileService.getAnimeFile(anime.id);

        if (existingFile) {
            await this.fileService.openFile(existingFile);
        } else {
            const newFile = await this.fileService.createAnimeFile(anime);
            await this.fileService.openFile(newFile);
        }
    }
}
