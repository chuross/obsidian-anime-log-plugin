import { App, TFile, requestUrl, normalizePath, Notice } from 'obsidian';
import { AnimeNode } from '../api/types';
import { JikanApiClient } from '../api/JikanApiClient';

const ANIME_LOG_DIR = 'animelog';
const ATTACHMENTS_DIR = 'attachments/anime';

export class AnimeFileService {
    app: App;
    jikanApiClient: JikanApiClient;

    constructor(app: App, jikanApiClient: JikanApiClient) {
        this.app = app;
        this.jikanApiClient = jikanApiClient;
    }

    async getAnimeFile(animeId: number): Promise<TFile | null> {
        // Search file starting with {animeId}_
        const files = this.app.vault.getMarkdownFiles();
        const file = files.find(f => f.basename.startsWith(`${animeId}_`));
        return file || null;
    }

    async createAnimeFile(anime: AnimeNode): Promise<TFile> {
        await this.ensureDirectory(ANIME_LOG_DIR);

        // Prefer Japanese title, fallback to default title
        const displayTitle = anime.alternative_titles?.ja || anime.title;
        const sanitizedTitle = this.sanitizeFileName(displayTitle);
        const fileName = `${ANIME_LOG_DIR}/${anime.id}_${sanitizedTitle}.md`;

        let thumbnailPath = '';
        if (anime.main_picture) {
            const imageUrl = anime.main_picture.large || anime.main_picture.medium;
            thumbnailPath = await this.saveThumbnail(anime.id, imageUrl);
        }

        const tags = [
            'animelog',
            `animelog_${this.getYear(anime.start_date)}`,
        ];

        const season = this.getSeason(anime.start_date);
        let yearSeason = '';
        if (season) {
            tags.push(`animelog_${this.getYear(anime.start_date)}_${season}`);

            // Generate year_season property
            const year = this.getYear(anime.start_date);
            const seasonJa = season === 'winter' ? '冬' : season === 'spring' ? '春' : season === 'summer' ? '夏' : '秋';
            yearSeason = `${year}年(${seasonJa})`;
        }

        if (anime.genres) {
            anime.genres.forEach(g => {
                tags.push(`animelog_${this.sanitizeTag(g.name)}`);
            });
        }

        // External links are now handled dynamically in the code block processor


        // Thumbnail with width specification using HTML img tag, wrapped in uneditable div
        const thumbnailEmbed = thumbnailPath
            ? `<div contenteditable="false"><img src="${thumbnailPath}" alt="${displayTitle}" width="300" /></div>`
            : '';

        const yearSeasonProp = yearSeason ? `year_season: "${yearSeason}"\n` : '';

        const content = `---
mal_id: ${anime.id}
title: "${displayTitle}"
${yearSeasonProp}tags:
${tags.map(t => `  - ${t}`).join('\n')}
---

${thumbnailEmbed}

# ${displayTitle}

\`\`\`animeLog
mal_id: ${anime.id}
status: plan_to_watch
\`\`\`
`;

        const file = await this.app.vault.create(fileName, content);

        // Cleanup unused attachments
        this.cleanupAttachments();

        return file;
    }

    async openFile(file: TFile) {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
    }

    private async saveThumbnail(animeId: number, imageUrl: string): Promise<string> {
        await this.ensureDirectory(ATTACHMENTS_DIR);

        // Get extension
        const urlObj = new URL(imageUrl);
        const ext = urlObj.pathname.split('.').pop() || 'jpg';

        const fileName = `${ATTACHMENTS_DIR}/${animeId}_thumbnail.${ext}`;
        const normalizedPath = normalizePath(fileName);

        // Check if exists
        const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
        if (existing) return normalizedPath;

        try {
            const response = await requestUrl({ url: imageUrl });
            await this.app.vault.createBinary(normalizedPath, response.arrayBuffer);
            return normalizedPath;
        } catch (error) {
            console.error('Failed to save thumbnail:', error);
            new Notice('Failed to download thumbnail.');
            return '';
        }
    }

    private async ensureDirectory(path: string) {
        const normalized = normalizePath(path);
        const folder = this.app.vault.getAbstractFileByPath(normalized);
        if (!folder) {
            await this.app.vault.createFolder(normalized);
        }
    }

    private sanitizeFileName(name: string): string {
        return name.replace(/[\\/:*?"<>|]/g, '').trim();
    }

    private sanitizeTag(name: string): string {
        return name.replace(/\s+/g, '_').replace(/[^\w\d_]/g, '');
    }

    private getYear(dateStr?: string): string {
        if (!dateStr) return 'unknown';
        return dateStr.split('-')[0];
    }

    private getSeason(dateStr?: string): string | null {
        if (!dateStr) return null;
        const month = parseInt(dateStr.split('-')[1]);
        if (month >= 1 && month <= 3) return 'winter';
        if (month >= 4 && month <= 6) return 'spring';
        if (month >= 7 && month <= 9) return 'summer';
        if (month >= 10 && month <= 12) return 'fall';
        return null;
    }

    private async cleanupAttachments() {
        try {
            // 1. Get all anime log files and extract valid IDs
            const markdownFiles = this.app.vault.getMarkdownFiles();
            const validIds = new Set<string>();

            markdownFiles.forEach(file => {
                // Check if file is in animelog directory (optional, but safer)
                if (file.path.startsWith(ANIME_LOG_DIR)) {
                    // Extract ID from filename: {ID}_Title.md
                    // Assuming filename format: 12345_SomeTitle.md
                    const match = file.basename.match(/^(\d+)_/);
                    if (match) {
                        validIds.add(match[1]);
                    }
                }
            });

            // 2. Get all images in attachment directory
            const attachmentFolder = this.app.vault.getAbstractFileByPath(ATTACHMENTS_DIR);
            if (attachmentFolder && 'children' in attachmentFolder) {
                // casting to TFolder-like or checking children directly
                const images = (attachmentFolder as any).children;

                for (const img of images) {
                    if (img instanceof TFile) {
                        // Check filename: {ID}_thumbnail.ext
                        const match = img.name.match(/^(\d+)_thumbnail\./);
                        if (match) {
                            const id = match[1];
                            // If ID is not in validIds, delete it
                            if (!validIds.has(id)) {
                                console.log(`Deleting unused thumbnail: ${img.path}`);
                                await this.app.vault.delete(img);
                            }
                        }
                    }
                }
            }

        } catch (e) {
            console.error('Failed to cleanup attachments', e);
        }
    }
}
