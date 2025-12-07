import { Plugin, WorkspaceLeaf } from 'obsidian';
import { YearSeasonModal } from './ui/YearSeasonModal';
import { AnimeGridModal } from './ui/AnimeGridModal';
import { MalApiClient } from './api/MalApiClient';
import { AnimeFileService } from './services/AnimeFileService';
import { AnimeLogProcessor } from './codeblock/AnimeLogProcessor';
import { AnimeNode } from './api/types';

export default class AnimeLogPlugin extends Plugin {
    apiClient: MalApiClient;
    fileService: AnimeFileService;

    async onload() {
        this.apiClient = new MalApiClient();
        this.fileService = new AnimeFileService(this.app);

        // Register Code Block Processor
        this.registerMarkdownCodeBlockProcessor('animeLog', (source, el, ctx) => {
            AnimeLogProcessor.postProcess(source, el, ctx, this.app, this.apiClient, this.fileService);
        });

        // Add Ribbon Icon
        this.addRibbonIcon('tv', 'Open Anime Log', (evt: MouseEvent) => {
            new YearSeasonModal(this.app, (year, season) => {
                this.openAnimeGrid(year, season);
            }).open();
        });

        // Add Command
        this.addCommand({
            id: 'open-anime-log-modal',
            name: 'Open Anime Selection Modal',
            callback: () => {
                new YearSeasonModal(this.app, (year, season) => {
                    this.openAnimeGrid(year, season);
                }).open();
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
