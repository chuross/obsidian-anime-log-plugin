import { App, TFile, requestUrl, normalizePath, Notice } from 'obsidian';
import { AnimeNode } from '../api/types';

const ANIME_LOG_DIR = 'animelog';
const ATTACHMENTS_DIR = 'attachments/anime';

export class AnimeFileService {
    app: App;

    constructor(app: App) {
        this.app = app;
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
        if (season) {
            tags.push(`animelog_${this.getYear(anime.start_date)}_${season}`);
        }

        if (anime.genres) {
            anime.genres.forEach(g => {
                tags.push(`animelog_${this.sanitizeTag(g.name)}`);
            });
        }

        // Thumbnail with width specification using HTML img tag
        const thumbnailEmbed = thumbnailPath
            ? `<img src="${thumbnailPath}" alt="${displayTitle}" width="300" />`
            : '';

        const content = `---
mal_id: ${anime.id}
title: "${displayTitle}"
tags:
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
}
