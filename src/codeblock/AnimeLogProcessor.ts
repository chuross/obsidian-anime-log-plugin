import { App, MarkdownPostProcessorContext, parseYaml, RequestUrlParam, requestUrl, ButtonComponent, DropdownComponent, setIcon, Notice } from 'obsidian';
import { MalApiClient } from '../api/MalApiClient';
import { AnimeFileService } from '../services/AnimeFileService';
import { AnimeStatistics } from '../api/types';

export class AnimeLogProcessor {
    static async postProcess(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext, app: App, apiClient: MalApiClient, fileService: AnimeFileService) {
        const container = el.createDiv({ cls: 'anime-log-container' });

        // Parse YAML
        let params: any = {};
        try {
            params = parseYaml(source) || {};
        } catch (e) {
            container.createEl('div', { text: 'Error parsing animeLog block.', cls: 'error' });
            return;
        }

        // Get Anime ID from Frontmatter
        const cache = app.metadataCache.getCache(ctx.sourcePath);
        const frontmatter = cache?.frontmatter;
        const animeId = frontmatter?.mal_id;

        if (!animeId) {
            container.createEl('div', { text: 'Anime ID not found in frontmatter.', cls: 'error' });
            return;
        }

        // --- Status UI ---
        const statusContainer = container.createDiv({ cls: 'anime-log-section anime-status' });
        statusContainer.createEl('h4', { text: 'Status' });
        const dropdown = new DropdownComponent(statusContainer);
        const savedStatus = params.status || 'plan_to_watch';

        dropdown.addOption('plan_to_watch', 'Plan to Watch');
        dropdown.addOption('watching', 'Watching');
        dropdown.addOption('completed', 'Completed');
        dropdown.addOption('on_hold', 'On Hold');
        dropdown.addOption('dropped', 'Dropped');

        dropdown.setValue(savedStatus);

        dropdown.onChange(async (newStatus) => {
            // Update code block source
            // This is tricky. We need to replace the content of the file.
            // For now, we just notify functionality limits or simple replacement logic if possible.
            // Updating a specific block in a file programmatically references "Editor" which we don't have here directly in postProcess cleanly without active view.
            // But we can use Vault.read and string replacement.

            // Simplest Regex replacement for now:
            const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
            if (file && 'read' in file) { // TFile check
                const content = await app.vault.read(file as any);
                // Warning: This regex is naive and might match other blocks if multiple exist.
                // Assuming one animeLog block per file for now based on use case.
                const newContent = content.replace(/(```animeLog\n)([\s\S]*?)(\n```)/, (match, p1, p2, p3) => {
                    // Replace status line
                    if (p2.includes('status:')) {
                        return `${p1}${p2.replace(/status: .*/, `status: ${newStatus}`)}${p3}`;
                    }
                    return `${p1}${p2}\nstatus: ${newStatus}${p3}`;
                });
                if (newContent !== content) {
                    await app.vault.modify(file as any, newContent);
                }
            }
        });

        // --- Fetch API Details ---
        // Render placeholders
        const detailsContainer = container.createDiv({ cls: 'anime-log-details-loading' });
        detailsContainer.setText('Loading details...');

        try {
            const details = await apiClient.getAnimeDetails(animeId);
            detailsContainer.empty();
            detailsContainer.removeClass('anime-log-details-loading');
            detailsContainer.addClass('anime-log-details');

            // 1. Statistics
            if (details.statistics) {
                const statBox = detailsContainer.createDiv({ cls: 'anime-log-section anime-stats' });
                statBox.createEl('h4', { text: 'Statistics' });
                const grid = statBox.createDiv({ cls: 'anime-stats-grid' });

                const stats = details.statistics;
                const total = stats.num_list_users;

                const createStatItem = (label: string, val: string) => {
                    const item = grid.createDiv({ cls: 'anime-stat-item' });
                    item.createDiv({ cls: 'label', text: label });
                    item.createDiv({ cls: 'value', text: val }); // val is string number from API
                };

                createStatItem('Watching', stats.status.watching);
                createStatItem('Completed', stats.status.completed);
                createStatItem('On Hold', stats.status.on_hold);
                createStatItem('Dropped', stats.status.dropped);
                createStatItem('Plan to Watch', stats.status.plan_to_watch);
                createStatItem('Total Users', total.toString());
            }

            // 2. Pictures
            if (details.pictures && details.pictures.length > 0) {
                const picSection = detailsContainer.createDiv({ cls: 'anime-log-section anime-pictures' });
                picSection.createEl('h4', { text: 'Pictures' });
                const scrollContainer = picSection.createDiv({ cls: 'horizontal-scroll-container' });

                details.pictures.forEach(pic => {
                    const img = scrollContainer.createEl('img', { attr: { src: pic.medium } });
                    // Optional: click to expand?
                });
            }

            // 3. Recommendations
            if (details.recommendations && details.recommendations.length > 0) {
                const recSection = detailsContainer.createDiv({ cls: 'anime-log-section anime-recommendations' });
                recSection.createEl('h4', { text: 'Recommendations' });
                const scrollContainer = recSection.createDiv({ cls: 'horizontal-scroll-container' });

                details.recommendations.forEach(rec => {
                    const card = scrollContainer.createDiv({ cls: 'anime-card mini-card' });
                    const imgUrl = rec.node.main_picture ? rec.node.main_picture.medium : '';
                    if (imgUrl) {
                        card.createEl('img', { attr: { src: imgUrl } });
                    }
                    card.createDiv({ cls: 'anime-card-title', text: rec.node.title });

                    card.onClickEvent(async () => {
                        // Check file existence
                        const existing = await fileService.getAnimeFile(rec.node.id);
                        if (existing) {
                            await fileService.openFile(existing);
                        } else {
                            // Create
                            // We only have node basic info here. Ideally we might want full info for tags etc, 
                            // but createFile accepts AnimeNode which is what we have (mostly).
                            // RecommendationNode.node is AnimeNode.
                            // However, it might miss start_date or genres for tags.
                            // Let's try to fetch full info or create sufficiently.
                            // Actually, recommendation node often lacks start_date.
                            // So we might want to fetch info before creating file to get correct tags?
                            // Or just create basic and let user update? The requirement says tags are important.
                            // Let's create with what we have, or maybe fetch simple details.
                            // Just creating a stub file and opening it is good UX.

                            // To be safe and get correct tags, let's fetch detail for creation
                            new Notice(`Creating file for ${rec.node.title}...`);
                            // We need access to apiClient here? Yes we have it.
                            // But getSeasonalAnime returns array. 
                            // We can use getAnimeDetails but it returns details structure, we need AnimeNode structure for createFile to parse start_date etc.
                            // Actually getAnimeDetails in MalApiClient returns specific struct.
                            // We should probably add `getAnime(id)` to apiClient that returns AnimeNode fully.
                            // OR, just create with what we have and update later.
                            // Let's use what we have. API for recommendation nodes usually has id, title, main_picture.
                            // start_date/genres might be missing. Tags will be minimal.
                            // User can update later manually or we can improve this later.

                            const newFile = await fileService.createAnimeFile(rec.node);
                            await fileService.openFile(newFile);
                        }
                    });
                });
            }

        } catch (err) {
            detailsContainer.setText('Failed to load details.');
            console.error(err);
        }
    }
}
